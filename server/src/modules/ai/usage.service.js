import mongoose from 'mongoose'

import { env } from '../../config/env.js'
import { ApiError } from '../../utils/ApiError.js'
import { utcDay } from '../../utils/hash.js'
import User from '../auth/user.model.js'

/**
 * Atomically consumes one uncached AI analysis from the user's daily quota.
 * AI_DAILY_CHUNK_LIMIT=0 disables the limit.
 *
 * @param {string} userId
 * @throws {ApiError} 429 when the daily limit is reached
 */
export const consumeAiQuota = async (userId) => {
  const limit = env.AI_DAILY_CHUNK_LIMIT
  const today = utcDay()

  if (limit === 0) return

  const sameDay = await User.updateOne(
    { _id: userId, 'aiUsage.day': today, 'aiUsage.chunks': mongoose.trusted({ $lt: limit }) },
    { $inc: { 'aiUsage.chunks': 1 } },
  )
  if (sameDay.modifiedCount === 1) return

  const newDay = await User.updateOne(
    { _id: userId, 'aiUsage.day': mongoose.trusted({ $ne: today }) },
    { $set: { 'aiUsage.day': today, 'aiUsage.chunks': 1 } },
  )
  if (newDay.modifiedCount === 1) return

  throw new ApiError(429, `Daily AI limit reached (${limit} sections). Already-analyzed videos still work.`)
}

/**
 * Remaining AI analyses for today.
 *
 * @param {{ aiUsage?: { day: string, chunks: number } }} user
 * @returns {number|null} null when unlimited
 */
export const remainingAiQuota = (user) => {
  const limit = env.AI_DAILY_CHUNK_LIMIT
  if (limit === 0) return null
  const used = user.aiUsage?.day === utcDay() ? user.aiUsage.chunks : 0
  return Math.max(0, limit - used)
}
