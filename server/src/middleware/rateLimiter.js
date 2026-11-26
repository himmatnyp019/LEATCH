import { createHash } from 'node:crypto'

import { ipKeyGenerator, rateLimit } from 'express-rate-limit'
import { slowDown } from 'express-slow-down'
import { RedisStore } from 'rate-limit-redis'

import { env } from '../config/env.js'
import { getRedisClient } from '../config/redis.js'
import { logger } from '../utils/logger.js'

const ONE_MINUTE_MS = 60 * 1000
const FIFTEEN_MINUTES_MS = 15 * ONE_MINUTE_MS

/**
 * Shared Redis store when REDIS_URL is set, so limits hold across all processes and instances.
 * Without Redis each process counts on its own (fine for a single instance).
 */
const storeFor = (name) => {
  const client = getRedisClient()
  if (!client) return undefined
  return new RedisStore({ prefix: `leatch:rl:${name}:`, sendCommand: (...args) => client.sendCommand(args) })
}

const ipKey = (req) => ipKeyGenerator(req.ip ?? '')
const userOrIpKey = (req) => (req.user?._id ? `user:${req.user._id}` : `ip:${ipKey(req)}`)
const emailKey = (req) => `email:${createHash('sha256').update(String(req.body?.email ?? '').trim().toLowerCase()).digest('hex')}`

const handler = (message) => (req, res, _next, options) => {
  logger.warn({ msg: 'rate limit exceeded', limiter: options.identifier, requestId: req.id, ip: req.ip, path: req.originalUrl })
  res.status(options.statusCode).json({ success: false, message, errors: [] })
}

/**
 * Creates a rate limiter with consistent headers/response, and a store per limiter.
 * Store errors fail open (requests pass) so a Redis outage never takes the API down.
 */
const createRateLimiter = ({ name, windowMs, limit, keyGenerator = ipKey, message, ...rest }) =>
  rateLimit({
    windowMs,
    limit,
    keyGenerator,
    identifier: name,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    passOnStoreError: true,
    store: storeFor(name),
    handler: handler(message),
    ...rest,
  })

/** Every API request, per client IP. First line of defence against floods from one source. */
export const globalLimiter = createRateLimiter({
  name: 'global',
  windowMs: ONE_MINUTE_MS,
  limit: env.RATE_LIMIT_GLOBAL_PER_MIN,
  message: 'Too many requests — slow down a little',
})

/** Login / register, per IP. Successful logins do not count. */
export const authLimiter = createRateLimiter({
  name: 'auth',
  windowMs: FIFTEEN_MINUTES_MS,
  limit: env.RATE_LIMIT_AUTH_PER_15_MIN,
  skipSuccessfulRequests: true,
  message: 'Too many attempts — try again in a few minutes',
})

/** Failed logins per target account, across all IPs (stops distributed password guessing). */
export const loginAccountLimiter = createRateLimiter({
  name: 'login-account',
  windowMs: FIFTEEN_MINUTES_MS,
  limit: env.LOGIN_MAX_FAILURES * 2,
  keyGenerator: emailKey,
  skipSuccessfulRequests: true,
  message: 'Too many attempts for this account — try again later',
})

/** Adds growing delays to repeated auth attempts from one IP before the hard limit kicks in. */
export const authSlowDown = slowDown({
  windowMs: FIFTEEN_MINUTES_MS,
  delayAfter: 5,
  delayMs: (hits) => Math.min((hits - 5) * 500, 5_000),
  keyGenerator: ipKey,
  store: storeFor('auth-slow'),
  passOnStoreError: true,
  skipSuccessfulRequests: true,
  validate: { delayMs: false },
})

/** Authenticated traffic per account (keeps one account from hogging capacity). */
export const userLimiter = createRateLimiter({
  name: 'user',
  windowMs: ONE_MINUTE_MS,
  limit: env.RATE_LIMIT_USER_PER_MIN,
  keyGenerator: userOrIpKey,
  message: 'Too many requests for this account — slow down a little',
})

/** Expensive writes (saving whole lessons). */
export const writeLimiter = createRateLimiter({
  name: 'write',
  windowMs: ONE_MINUTE_MS,
  limit: env.RATE_LIMIT_WRITE_PER_MIN,
  keyGenerator: userOrIpKey,
  message: 'Saving too often — wait a moment and try again',
})

/** AI analysis calls per account (on top of the daily quota). */
export const aiLimiter = createRateLimiter({
  name: 'ai',
  windowMs: ONE_MINUTE_MS,
  limit: env.RATE_LIMIT_AI_PER_MIN,
  keyGenerator: userOrIpKey,
  message: 'Too many AI requests — slow down a little',
})
