import { z } from 'zod'

import { LANGUAGE_CODE_PATTERN } from '../../config/constants.js'

const lang = z.string().regex(LANGUAGE_CODE_PATTERN, 'Invalid language code')
const status = z.enum(['new', 'learning', 'known'])
const wordIdParams = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid word id') })

export const listWordsSchema = z.object({
  query: z.object({
    lang: lang.optional(),
    status: status.optional(),
    q: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  }),
})

export const lemmaListSchema = z.object({ query: z.object({ lang }) })

export const saveWordSchema = z.object({
  body: z.object({
    lang,
    lemma: z.string().trim().min(1).max(120),
    surface: z.string().max(120).default(''),
    type: z.enum(['vocab', 'grammar']).default('vocab'),
    meaning: z.string().max(300).default(''),
    meaningLang: z.union([z.literal(''), lang]).default(''),
    reading: z.string().max(160).default(''),
    pos: z.string().max(40).default(''),
    examples: z.array(z.object({ text: z.string().max(400), translation: z.string().max(400).default('') })).max(4).default([]),
    context: z
      .object({
        sentence: z.string().max(1000).default(''),
        translation: z.string().max(1000).default(''),
        videoId: z.string().max(20).default(''),
        videoTitle: z.string().max(300).default(''),
        time: z.number().min(0).default(0),
      })
      .optional(),
  }),
})

export const updateWordSchema = z.object({
  params: wordIdParams,
  body: z.object({
    status: status.optional(),
    meaning: z.string().max(300).optional(),
    reviewed: z.boolean().optional(),
  }),
})

export const wordIdSchema = z.object({ params: wordIdParams })
