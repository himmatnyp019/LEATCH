import { createClient } from 'redis'

import { logger } from '../utils/logger.js'
import { env } from './env.js'

let client = null
let connecting = null

/**
 * Returns the shared Redis client when REDIS_URL is set, otherwise null. The connection starts
 * immediately so commands issued during start-up (e.g. rate-limit script loading) are queued
 * until it is ready. Redis keeps rate-limit counters consistent across processes/instances.
 *
 * @returns {import('redis').RedisClientType|null}
 */
export const getRedisClient = () => {
  if (!env.REDIS_URL) return null
  if (client) return client
  client = createClient({
    url: env.REDIS_URL,
    socket: { reconnectStrategy: (retries) => Math.min(retries * 200, 5_000), connectTimeout: 5_000 },
  })
  client.on('error', (err) => logger.error('Redis error:', err.message))
  client.on('ready', () => logger.info('Redis connected'))
  connecting = client.connect().catch((err) => {
    logger.error('Redis unavailable; rate limits will not be shared across instances:', err.message)
  })
  return client
}

/** Waits for the Redis connection if configured. Failures are logged, not fatal (limits fail open). */
export const connectRedis = async () => {
  if (!getRedisClient()) return
  await connecting
}

export const isRedisReady = () => Boolean(client?.isReady)

export const disconnectRedis = async () => {
  if (client?.isOpen) await client.quit().catch(() => client.disconnect())
}
