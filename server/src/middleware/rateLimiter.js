import { rateLimit } from 'express-rate-limit'

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000
const ONE_MINUTE_MS = 60 * 1000

const limitMessage = (message) => ({ success: false, message, errors: [] })

/** General API limiter. */
export const apiLimiter = rateLimit({
  windowMs: ONE_MINUTE_MS,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: limitMessage('Too many requests — slow down a little'),
})

/** Strict limiter for login / register to slow down credential stuffing. */
export const authLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES_MS,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: limitMessage('Too many login attempts — try again in a few minutes'),
})
