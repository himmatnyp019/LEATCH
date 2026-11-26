import { EXAMPLES_PER_ITEM, MAX_ITEMS_PER_LINE } from '../../config/constants.js'

const LANGUAGE_NAMES = {
  ko: 'Korean',
  en: 'English',
  ja: 'Japanese',
  'zh-Hans': 'Simplified Chinese',
  'zh-Hant': 'Traditional Chinese',
  zh: 'Chinese',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  it: 'Italian',
  ru: 'Russian',
  vi: 'Vietnamese',
  th: 'Thai',
  id: 'Indonesian',
  hi: 'Hindi',
  ne: 'Nepali',
  ar: 'Arabic',
  tr: 'Turkish',
}

/** Human readable language name for prompts. */
export const languageName = (code) => LANGUAGE_NAMES[code] ?? LANGUAGE_NAMES[code?.split('-')[0]] ?? code

const readingRule = (sourceLang) => {
  if (sourceLang === 'ko') return 'Revised Romanization of the lemma (e.g. "meokda").'
  if (sourceLang === 'en') return 'IPA of the lemma between slashes (e.g. "/ˈfɪɡjər aʊt/").'
  return 'a pronunciation guide for the lemma if the script is not Latin, otherwise an empty string.'
}

const itemStrings = { type: 'string' }

/** JSON schema for phase 1: per-line item selection (+ optional translation). */
export const ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['lines'],
  properties: {
    lines: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['i', 'translation', 'items'],
        properties: {
          i: { type: 'integer' },
          translation: itemStrings,
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['surface', 'lemma', 'type', 'meaning', 'reading', 'pos'],
              properties: {
                surface: itemStrings,
                lemma: itemStrings,
                type: { type: 'string', enum: ['vocab', 'grammar'] },
                meaning: itemStrings,
                reading: itemStrings,
                pos: itemStrings,
              },
            },
          },
        },
      },
    },
  },
}

/** JSON schema for phase 2: example sentences per lemma. */
export const EXAMPLES_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['entries'],
  properties: {
    entries: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['lemma', 'examples'],
        properties: {
          lemma: itemStrings,
          examples: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['text', 'translation'],
              properties: { text: itemStrings, translation: itemStrings },
            },
          },
        },
      },
    },
  },
}

/**
 * System prompt for phase 1 (choose the 1–2 most useful items per subtitle line).
 *
 * @param {{ sourceLang: string, nativeLang: string, needTranslation: boolean }} options
 * @returns {string}
 */
export const buildAnalysisSystemPrompt = ({ sourceLang, nativeLang, needTranslation }) => {
  const source = languageName(sourceLang)
  const native = languageName(nativeLang)
  return [
    `You annotate video subtitles for language learners. The learner is studying ${source}; their native language is ${native}.`,
    `For each subtitle line, pick at most ${MAX_ITEMS_PER_LINE} items that are most worth learning:`,
    `- "vocab": useful content words or set expressions. Skip names, numbers, interjections, fillers and very basic words (e.g. 나, 저, 이거, 있다, 하다, 네; I, you, the, be, do).`,
    `- "grammar": a grammar pattern used in the line (e.g. -고 싶다, -(으)ㄹ 수 있다, -는데 for Korean; used to, be supposed to, present perfect for English).`,
    'Rules:',
    '- Prefer items not already chosen for an earlier line in this batch so the learner sees variety. A line may have zero items (music, sound effects, one-word lines).',
    '- surface: copy the exact substring from the line as written, so it can be highlighted.',
    '- lemma: dictionary form (Korean verbs/adjectives end in 다; English base form; grammar as pattern notation like -아/어서).',
    `- meaning: short ${native} gloss that fits this line (max 8 words).`,
    `- reading: ${readingRule(sourceLang)}`,
    '- pos: one of noun, verb, adjective, adverb, expression, particle, ending, pattern.',
    needTranslation
      ? `- translation: a natural ${native} translation of the whole line (use neighbouring lines for context).`
      : '- translation: return an empty string (a translation is already provided as context).',
    'Return exactly one entry per input line, with the same "i".',
  ].join('\n')
}

/**
 * System prompt for phase 2 (example sentences for lemmas not yet in the shared lexicon).
 *
 * @param {{ sourceLang: string, nativeLang: string }} options
 * @returns {string}
 */
export const buildExamplesSystemPrompt = ({ sourceLang, nativeLang }) => {
  const source = languageName(sourceLang)
  const native = languageName(nativeLang)
  return [
    `You write example sentences for learners studying ${source} (native language: ${native}).`,
    `For each item write exactly ${EXAMPLES_PER_ITEM} short, natural ${source} sentences (max 12 words, everyday situations, beginner-to-intermediate level) that use the item, conjugated as needed.`,
    `Give each sentence a natural ${native} translation.`,
    'Return one entry per item with the same "lemma".',
  ].join('\n')
}
