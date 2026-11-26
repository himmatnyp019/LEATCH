import { z } from 'zod'

import { LANGUAGE_CODE_PATTERN, MAX_CUES_PER_VIDEO, YOUTUBE_ID_PATTERN } from '../../config/constants.js'

const videoIdParams = z.object({ videoId: z.string().regex(YOUTUBE_ID_PATTERN, 'Invalid YouTube video id') })
const optionalLang = z.union([z.literal(''), z.string().regex(LANGUAGE_CODE_PATTERN)]).optional()
const seconds = z.number().min(0).max(60 * 60 * 24)

const exampleSchema = z.object({ text: z.string().max(400), translation: z.string().max(400).default('') })

export const vocabItemSchema = z.object({
  cueIndex: z.number().int().min(0),
  surface: z.string().max(120).default(''),
  lemma: z.string().min(1).max(120),
  type: z.enum(['vocab', 'grammar']).default('vocab'),
  meaning: z.string().max(300).default(''),
  reading: z.string().max(160).default(''),
  pos: z.string().max(40).default(''),
  examples: z.array(exampleSchema).max(4).default([]),
})

const cueSchema = z.object({
  start: seconds,
  end: seconds,
  text: z.string().max(1000),
  translation: z.string().max(1000).default(''),
})

const progressSchema = z.object({ position: seconds, duration: seconds.optional() })

export const listVideosSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    q: z.string().trim().max(100).optional(),
  }),
})

export const videoIdSchema = z.object({ params: videoIdParams })

export const upsertVideoSchema = z.object({
  params: videoIdParams,
  body: z.object({
    url: z.url().max(300).optional(),
    title: z.string().max(300).optional(),
    channel: z.string().max(200).optional(),
    thumbnail: z.string().max(500).optional(),
    durationSec: seconds.optional(),
    sourceLang: optionalLang,
    translationLang: optionalLang,
    trackLabel: z.string().max(120).optional(),
    cues: z.array(cueSchema).max(MAX_CUES_PER_VIDEO).optional(),
    vocab: z.array(vocabItemSchema).max(MAX_CUES_PER_VIDEO * 2).optional(),
    progress: progressSchema.optional(),
  }),
})

export const progressUpdateSchema = z.object({ params: videoIdParams, body: progressSchema })

export const addNoteSchema = z.object({
  params: videoIdParams,
  body: z.object({
    time: seconds.default(0),
    text: z.string().trim().min(1, 'Note cannot be empty').max(2000),
    cueText: z.string().max(1000).default(''),
  }),
})

export const noteIdSchema = z.object({
  params: videoIdParams.extend({ noteId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid note id') }),
})

export const updateNoteSchema = noteIdSchema.extend({
  body: z.object({ text: z.string().trim().min(1).max(2000) }),
})
