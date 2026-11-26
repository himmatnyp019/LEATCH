import { z } from 'zod'

import { LANGUAGE_CODE_PATTERN } from '../../config/constants.js'

const email = z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address'))
const newPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password needs a letter')
  .regex(/[0-9]/, 'Password needs a number')
const langCode = z.string().regex(LANGUAGE_CODE_PATTERN, 'Invalid language code')

export const registerSchema = z.object({
  body: z.object({
    email,
    password: newPassword,
    name: z.string().trim().max(60).optional().default(''),
  }),
})

export const loginSchema = z.object({
  body: z.object({ email, password: z.string().min(1, 'Password is required').max(128) }),
})

export const updateMeSchema = z.object({
  body: z.object({
    name: z.string().trim().max(60).optional(),
    preferences: z.object({ learningLang: langCode.optional(), nativeLang: langCode.optional() }).optional(),
  }),
})

export const changePasswordSchema = z.object({
  body: z
    .object({ currentPassword: z.string().min(1).max(128), newPassword })
    .refine((body) => body.currentPassword !== body.newPassword, { message: 'New password must be different', path: ['newPassword'] }),
})
