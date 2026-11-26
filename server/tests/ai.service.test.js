import './setup-env.js'

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createAnalysisService } from '../src/modules/ai/ai.service.js'

const createFakes = () => {
  const cache = new Map()
  const lexicon = new Map()
  const calls = { analysis: 0, examples: 0, quota: 0, examplesRequested: [] }

  const complete = async ({ user, schema }) => {
    const input = JSON.parse(user)
    if (schema.required.includes('lines')) {
      calls.analysis += 1
      return {
        data: {
          lines: input.lines.map((line) => ({
            i: line.i,
            translation: `EN(${line.text})`,
            items: [
              { surface: '먹고 싶어요', lemma: '-고 싶다', type: 'grammar', meaning: 'want to', reading: '-go sipda', pos: 'pattern' },
              { surface: 'NOT-IN-LINE', lemma: '먹다', type: 'vocab', meaning: 'to eat', reading: 'meokda', pos: 'verb' },
              { surface: 'extra', lemma: '추가', type: 'vocab', meaning: 'extra', reading: 'chuga', pos: 'noun' },
            ],
          })),
        },
      }
    }
    calls.examples += 1
    calls.examplesRequested.push(...input.items.map((item) => item.lemma))
    return {
      data: {
        entries: input.items.map((item) => ({
          lemma: item.lemma,
          examples: [
            { text: `${item.lemma} 예문 1`, translation: 'example 1' },
            { text: `${item.lemma} 예문 2`, translation: 'example 2' },
            { text: 'third example is dropped', translation: '' },
          ],
        })),
      },
    }
  }

  const service = createAnalysisService({
    complete,
    cacheStore: {
      findByKey: async (key) => cache.get(key) ?? null,
      save: async (doc) => cache.set(doc.key, doc),
      recordHit: async () => {},
    },
    lexiconStore: {
      findMany: async (_lang, _native, lemmas) => new Map(lemmas.filter((l) => lexicon.has(l)).map((l) => [l, lexicon.get(l)])),
      upsertMany: async (_lang, _native, entries) => entries.forEach((entry) => lexicon.set(entry.lemma, entry)),
    },
    consumeQuota: async () => {
      calls.quota += 1
    },
    isEnabled: () => true,
  })

  return { service, calls, cache, lexicon }
}

const request = (overrides = {}) => ({
  userId: 'u1',
  videoId: 'abcdefghijk',
  sourceLang: 'ko',
  nativeLang: 'en',
  needTranslation: false,
  lines: [
    { i: 10, text: '저는 비빔밥을 먹고 싶어요', translation: 'I want to eat bibimbap' },
    { i: 11, text: '같이 갈래요?', translation: 'Shall we go together?' },
  ],
  ...overrides,
})

describe('analysis service', () => {
  it('analyzes a chunk, caps items per line and attaches two examples', async () => {
    const { service, calls } = createFakes()
    const result = await service.analyzeChunk(request())

    assert.equal(result.cached, false)
    assert.equal(calls.analysis, 1)
    assert.equal(calls.quota, 1)
    assert.equal(result.lines.length, 2)
    assert.deepEqual(result.lines.map((line) => line.i), [10, 11])

    const [first] = result.lines
    assert.equal(first.items.length, 2, 'max two items per line')
    assert.equal(first.items[0].surface, '먹고 싶어요')
    assert.equal(first.items[1].surface, '', 'surface not present in the line is cleared')
    assert.equal(first.items[0].examples.length, 2, 'examples are capped at two')
  })

  it('generates examples once per lemma and serves repeats from the lexicon', async () => {
    const { service, calls } = createFakes()
    await service.analyzeChunk(request())
    assert.equal(calls.examples, 1)
    assert.deepEqual([...new Set(calls.examplesRequested)].sort(), ['-고 싶다', '먹다'])

    await service.analyzeChunk(request({ lines: [{ i: 0, text: '완전히 다른 문장이에요', translation: '' }] }))
    assert.equal(calls.analysis, 2)
    assert.equal(calls.examples, 1, 'known lemmas do not trigger another example request')
  })

  it('serves identical chunks from the shared cache without spending quota', async () => {
    const { service, calls } = createFakes()
    await service.analyzeChunk(request())
    const second = await service.analyzeChunk(request({ userId: 'someone-else', lines: request().lines.map((l, k) => ({ ...l, i: 50 + k })) }))

    assert.equal(second.cached, true)
    assert.equal(calls.analysis, 1)
    assert.equal(calls.quota, 1)
    assert.deepEqual(second.lines.map((line) => line.i), [50, 51], 'cached lines are re-indexed for the new request')
    assert.equal(second.lines[0].items[0].examples.length, 2)
  })

  it('re-analyzes a cached chunk when a translation is now required', async () => {
    const { service, calls } = createFakes()
    await service.analyzeChunk(request())
    const withTranslation = await service.analyzeChunk(request({ needTranslation: true }))

    assert.equal(withTranslation.cached, false)
    assert.equal(calls.analysis, 2)
    assert.match(withTranslation.lines[0].translation, /^EN\(/)

    const again = await service.analyzeChunk(request({ needTranslation: false }))
    assert.equal(again.cached, true, 'a translated cache entry also satisfies untranslated requests')
  })

  it('propagates quota errors before calling the model', async () => {
    const { service, calls } = createFakes()
    const limited = createAnalysisService({
      complete: async () => assert.fail('model must not be called'),
      cacheStore: { findByKey: async () => null, save: async () => {}, recordHit: async () => {} },
      lexiconStore: { findMany: async () => new Map(), upsertMany: async () => {} },
      consumeQuota: async () => {
        throw Object.assign(new Error('limit'), { statusCode: 429 })
      },
      isEnabled: () => true,
    })
    await assert.rejects(limited.analyzeChunk(request()), { statusCode: 429 })
    assert.equal(calls.analysis, 0)
    void service
  })
})
