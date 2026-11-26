import mongoose from 'mongoose'

import { EXAMPLES_PER_ITEM, MAX_ITEMS_PER_LINE } from '../../config/constants.js'
import { env } from '../../config/env.js'
import { createLimiter, createSingleFlight } from '../../utils/concurrency.js'
import { hashOf } from '../../utils/hash.js'
import { logger } from '../../utils/logger.js'
import {
  ANALYSIS_SCHEMA,
  EXAMPLES_SCHEMA,
  buildAnalysisSystemPrompt,
  buildExamplesSystemPrompt,
} from './ai.prompts.js'
import AnalysisCache from './analysis-cache.model.js'
import { createJsonCompletion } from './claude.client.js'
import Lexicon from './lexicon.model.js'
import { consumeAiQuota } from './usage.service.js'

/** Bump when prompts/schemas change in a way that should invalidate cached analyses. */
const CACHE_VERSION = 1
const EXAMPLE_BATCH_SIZE = 30

const clip = (value, max) => String(value ?? '').trim().slice(0, max)
const uniqueBy = (list, keyOf) => [...new Map(list.map((entry) => [keyOf(entry), entry])).values()]
const chunk = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size))

const sanitizeItems = (items, lineText) =>
  items
    .filter((item) => clip(item?.lemma, 120))
    .slice(0, MAX_ITEMS_PER_LINE)
    .map((item) => ({
      surface: item.surface && lineText.includes(item.surface) ? item.surface : '',
      lemma: clip(item.lemma, 120),
      type: item.type === 'grammar' ? 'grammar' : 'vocab',
      meaning: clip(item.meaning, 300),
      reading: clip(item.reading, 160),
      pos: clip(item.pos, 40),
    }))

/** Aligns model output to the requested lines (by `i`) and drops anything malformed. */
const sanitizeAnalysis = (data, lines) => {
  const byIndex = new Map((data?.lines ?? []).map((line) => [line.i, line]))
  return lines.map((line) => {
    const result = byIndex.get(line.i)
    return {
      i: line.i,
      translation: clip(result?.translation, 1000),
      items: sanitizeItems(Array.isArray(result?.items) ? result.items : [], line.text),
    }
  })
}

const sanitizeExamples = (examples) =>
  (Array.isArray(examples) ? examples : [])
    .map((example) => ({ text: clip(example?.text, 400), translation: clip(example?.translation, 400) }))
    .filter((example) => example.text)
    .slice(0, EXAMPLES_PER_ITEM)

/**
 * Builds the analysis service. Dependencies are injected so the logic is testable without
 * MongoDB or network access.
 *
 * @param {object} deps
 * @param {Function} deps.complete - `({ system, user, schema }) => Promise<{ data }>`
 * @param {object} deps.cacheStore - `{ findByKey, save, recordHit }`
 * @param {object} deps.lexiconStore - `{ findMany, upsertMany }`
 * @param {Function} deps.consumeQuota - `(userId) => Promise<void>`, throws when exhausted
 * @param {() => boolean} deps.isEnabled - whether AI calls are allowed
 * @param {string} [deps.model]
 * @param {number} [deps.maxConcurrent] - max simultaneous model calls in this process
 */
export const createAnalysisService = ({ complete: rawComplete, cacheStore, lexiconStore, consumeQuota, isEnabled, model = '', maxConcurrent = 16 }) => {
  // Bound simultaneous model calls, and make identical concurrent work (e.g. many viewers of the
  // same new video) share a single call instead of paying for it N times.
  const modelLimiter = createLimiter({ concurrency: maxConcurrent, maxQueue: 500, name: 'AI' })
  const complete = (request) => modelLimiter.run(() => rawComplete(request))
  const analysisFlight = createSingleFlight()
  const examplesFlight = createSingleFlight()

  const generateExamples = async ({ sourceLang, nativeLang, items }) => {
    const system = buildExamplesSystemPrompt({ sourceLang, nativeLang })
    const generated = []

    for (const batch of chunk(items, EXAMPLE_BATCH_SIZE)) {
      const user = JSON.stringify({ items: batch.map(({ lemma, type, meaning }) => ({ lemma, type, meaning })) })
      const { data } = await complete({ system, user, schema: EXAMPLES_SCHEMA })
      const entries = Array.isArray(data?.entries) ? data.entries : []
      const byLemma = new Map(entries.map((entry) => [clip(entry?.lemma, 120), entry]))

      batch.forEach((item, index) => {
        const examples = sanitizeExamples((byLemma.get(item.lemma) ?? entries[index])?.examples)
        if (examples.length) generated.push({ ...item, examples })
      })
    }
    return generated
  }

  /** Adds example sentences from the shared lexicon, generating only the missing ones. */
  const attachExamples = async ({ sourceLang, nativeLang, lines, allowGenerate }) => {
    const items = uniqueBy(lines.flatMap((line) => line.items), (item) => item.lemma)
    if (!items.length) return lines

    const known = await lexiconStore.findMany(sourceLang, nativeLang, items.map((item) => item.lemma))
    const missing = items.filter((item) => !known.get(item.lemma)?.examples?.length)

    if (missing.length && allowGenerate) {
      try {
        const flightKey = `${sourceLang}:${nativeLang}:${missing.map((item) => item.lemma).sort().join('|')}`
        const generated = await examplesFlight(flightKey, async () => {
          const entries = await generateExamples({ sourceLang, nativeLang, items: missing })
          if (entries.length) await lexiconStore.upsertMany(sourceLang, nativeLang, entries)
          return entries
        })
        generated.forEach((entry) => known.set(entry.lemma, entry))
      } catch (err) {
        logger.warn('[ai] Example generation failed; returning items without examples:', err.message)
      }
    }

    return lines.map((line) => ({
      ...line,
      items: line.items.map((item) => ({ ...item, examples: known.get(item.lemma)?.examples ?? [] })),
    }))
  }

  /**
   * Analyzes one chunk of subtitle lines: picks 1–2 key vocab/grammar items per line,
   * optionally translates, and attaches two example sentences per item.
   * Results are cached across users by content hash, so each chunk is paid for once.
   *
   * @param {object} request
   * @param {string} request.userId
   * @param {string} [request.videoId]
   * @param {string} request.sourceLang
   * @param {string} request.nativeLang
   * @param {boolean} request.needTranslation
   * @param {Array<{ i: number, text: string, translation?: string }>} request.lines
   * @returns {Promise<{ cached: boolean, lines: Array<object> }>}
   */
  const analyzeChunk = async ({ userId, videoId = '', sourceLang, nativeLang, needTranslation, lines }) => {
    const key = hashOf({ v: CACHE_VERSION, sourceLang, nativeLang, texts: lines.map((line) => line.text) })
    const cached = await cacheStore.findByKey(key)

    if (cached && (!needTranslation || cached.hasTranslations)) {
      cacheStore.recordHit(key).catch(() => {})
      // Cached lines are stored positionally; re-map them onto this request's indexes.
      const remapped = lines.map((line, position) => ({ ...cached.lines[position], i: line.i }))
      return { cached: true, lines: await attachExamples({ sourceLang, nativeLang, lines: remapped, allowGenerate: isEnabled() }) }
    }

    // Only the request that actually triggers the model call spends the caller's daily quota.
    const analyzed = await analysisFlight(`${key}:${needTranslation ? 1 : 0}`, async () => {
      await consumeQuota(userId)
      const payload = lines.map(({ i, text, translation }) => (needTranslation || !translation ? { i, text } : { i, text, translation }))
      const { data } = await complete({
        system: buildAnalysisSystemPrompt({ sourceLang, nativeLang, needTranslation }),
        user: JSON.stringify({ lines: payload }),
        schema: ANALYSIS_SCHEMA,
      })
      const result = sanitizeAnalysis(data, lines)
      await cacheStore.save({ key, videoId, sourceLang, nativeLang, hasTranslations: needTranslation, lines: result, model })
      return result
    })

    const remapped = lines.map((line, position) => ({ ...analyzed[position], i: line.i }))
    return { cached: false, lines: await attachExamples({ sourceLang, nativeLang, lines: remapped, allowGenerate: true }) }
  }

  return { analyzeChunk }
}

const mongoCacheStore = {
  findByKey: (key) => AnalysisCache.findOne({ key }).lean(),
  save: (doc) => AnalysisCache.updateOne({ key: doc.key }, { $set: doc }, { upsert: true }),
  recordHit: (key) => AnalysisCache.updateOne({ key }, { $inc: { hits: 1 } }),
}

const mongoLexiconStore = {
  findMany: async (lang, nativeLang, lemmas) => {
    const entries = await Lexicon.find({ lang, nativeLang, lemma: mongoose.trusted({ $in: lemmas }) }).lean()
    return new Map(entries.map((entry) => [entry.lemma, entry]))
  },
  upsertMany: (lang, nativeLang, entries) =>
    Lexicon.bulkWrite(
      entries.map(({ lemma, type, meaning, reading, examples }) => ({
        updateOne: {
          filter: { lang, nativeLang, lemma },
          update: { $set: { type, meaning, reading, examples }, $inc: { hits: 1 } },
          upsert: true,
        },
      })),
    ),
}

/** MongoDB-backed stores (exported for integration tests). */
export const mongoStores = { cacheStore: mongoCacheStore, lexiconStore: mongoLexiconStore }

/** Production instance wired to MongoDB and Claude. */
export const analysisService = createAnalysisService({
  complete: createJsonCompletion,
  cacheStore: mongoCacheStore,
  lexiconStore: mongoLexiconStore,
  consumeQuota: consumeAiQuota,
  isEnabled: () => env.isAiEnabled,
  model: env.AI_MODEL,
  maxConcurrent: env.AI_MAX_CONCURRENT_REQUESTS,
})
