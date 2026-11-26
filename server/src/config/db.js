import mongoose from 'mongoose'

import { logger } from '../utils/logger.js'
import { env } from './env.js'

/**
 * Connects Mongoose to MongoDB using MONGODB_URI.
 *
 * @returns {Promise<typeof mongoose>} The connected mongoose instance
 */
export const connectDB = async () => {
  mongoose.set('strictQuery', true)
  const connection = await mongoose.connect(env.MONGODB_URI)
  logger.info(`MongoDB connected: ${connection.connection.host}/${connection.connection.name}`)
  return connection
}
