import mongoose from 'mongoose'

import { logger } from '../utils/logger.js'
import { env } from './env.js'

const PASSWORD_PLACEHOLDER = /<(db_)?password>/i
const HAS_CREDENTIALS = /^mongodb(?:\+srv)?:\/\/[^/@]+@/
const MAX_BACKOFF_MS = 30_000
const PING_TIMEOUT_MS = 2_000

/** Replaces credentials in a connection string so it is safe to log. */
export const redactUri = (uri) => uri.replace(/^(mongodb(?:\+srv)?:\/\/)[^@/]+@/, '$1***:***@')

/**
 * Builds the connection string and driver options from the environment.
 * Supports an Atlas URI that already contains credentials, one with a `<db_password>`
 * placeholder, or a credential-less URI combined with MONGODB_USERNAME / MONGODB_PASSWORD.
 *
 * @param {object} config - the validated env
 * @returns {{ uri: string, options: import('mongoose').ConnectOptions }}
 */
export const buildMongoConfig = (config) => {
  let uri = config.MONGODB_URI.trim()
  const options = {
    dbName: config.MONGODB_DB_NAME,
    appName: 'leatch-api',
    maxPoolSize: config.MONGODB_MAX_POOL_SIZE,
    minPoolSize: Math.min(config.MONGODB_MIN_POOL_SIZE, config.MONGODB_MAX_POOL_SIZE),
    maxIdleTimeMS: 60_000,
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
    heartbeatFrequencyMS: 10_000,
    retryWrites: true,
    retryReads: true,
    writeConcern: { w: 'majority' },
    ...(config.MONGODB_COMPRESSORS && { compressors: config.MONGODB_COMPRESSORS.split(',') }),
    autoIndex: config.MONGODB_AUTO_INDEX,
  }

  if (PASSWORD_PLACEHOLDER.test(uri) && config.MONGODB_PASSWORD) {
    uri = uri.replace(PASSWORD_PLACEHOLDER, encodeURIComponent(config.MONGODB_PASSWORD))
  }
  if (!HAS_CREDENTIALS.test(uri) && config.MONGODB_USERNAME && config.MONGODB_PASSWORD) {
    options.auth = { username: config.MONGODB_USERNAME, password: config.MONGODB_PASSWORD }
  }
  return { uri, options }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

let listenersAttached = false
const attachListeners = () => {
  if (listenersAttached) return
  listenersAttached = true
  const { connection } = mongoose
  connection.on('disconnected', () => logger.warn('MongoDB disconnected'))
  connection.on('reconnected', () => logger.info('MongoDB reconnected'))
  connection.on('error', (err) => logger.error('MongoDB connection error:', err.message))
}

/**
 * Connects Mongoose with exponential-backoff retries (the driver handles reconnects afterwards).
 *
 * @returns {Promise<typeof mongoose>}
 */
export const connectDB = async () => {
  mongoose.set('strictQuery', true)
  // Defense in depth against NoSQL injection: `$`-operators inside query filters are neutralised
  // unless the code explicitly marks them with mongoose.trusted().
  mongoose.set('sanitizeFilter', true)
  attachListeners()

  const { uri, options } = buildMongoConfig(env)
  for (let attempt = 1; ; attempt++) {
    try {
      await mongoose.connect(uri, options)
      const { host, name } = mongoose.connection
      logger.info(`MongoDB connected: ${host}/${name} (pool ${options.minPoolSize}-${options.maxPoolSize})`)
      return mongoose
    } catch (err) {
      if (attempt > env.MONGODB_CONNECT_RETRIES) {
        logger.error(`MongoDB connection failed after ${attempt} attempts (${redactUri(uri)}):`, err.message)
        throw err
      }
      const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** (attempt - 1))
      logger.warn(`MongoDB connection attempt ${attempt} failed (${err.message}); retrying in ${delay} ms`)
      await sleep(delay)
    }
  }
}

/** True when the connection is open and answers a ping quickly. */
export const pingDB = async () => {
  if (mongoose.connection.readyState !== 1) return false
  try {
    await Promise.race([
      mongoose.connection.db.admin().command({ ping: 1 }),
      sleep(PING_TIMEOUT_MS).then(() => {
        throw new Error('ping timeout')
      }),
    ])
    return true
  } catch {
    return false
  }
}

/** Closes the connection pool. */
export const disconnectDB = () => mongoose.disconnect()
