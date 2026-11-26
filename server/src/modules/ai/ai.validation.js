import { z } from 'zod'

import {
  ANALYZABLE_LANGUAGES,
  LANGUAGE_CODE_PATTERN,
  MAX_LINE_LENGTH,
  MAX_LINES_PER_ANALYSIS,
  YOUTUBE_ID_PATTERN,
} from '../../config/constants.js'

export const analyzeSchema = z.object({
  body: z
    .object({
      videoId: z.string().regex(YOUTUBE_ID_PATTERN).optional(),
      sourceLang: z.enum(ANALYZABLE_LANGUAGES),
      nativeLang: z.string().regex(LANGUAGE_CODE_PATTERN, 'Invalid language code'),
      needTranslation: z.boolean().default(false),
      lines: z
        .array(
          z.object({
            i: z.number().int().min(0),
            text: z.string().trim().min(1).max(MAX_LINE_LENGTH),
            translation: z.string().max(MAX_LINE_LENGTH * 2).default(''),
          }),
        )
        .min(1)
        .max(MAX_LINES_PER_ANALYSIS),
    })
    .refine((body) => body.sourceLang !== body.nativeLang, { message: 'Source and native language must differ' }),
})
