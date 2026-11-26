import mongoose from 'mongoose'

import { ApiError } from '../utils/ApiError.js'

const CONNECTED = 1

/** True when the MongoDB connection is open. */
export const isDatabaseConnected = () => mongoose.connection.readyState === CONNECTED

/**
 * Fails fast with 503 while MongoDB is unreachable (e.g. during a failover/reconnect) instead
 * of letting requests queue on the driver for seconds and pile up under load.
 */
export const requireDatabase = (_req, res, next) => {
  if (isDatabaseConnected()) return next()
  res.setHeader('Retry-After', '5')
  throw new ApiError(503, 'Database temporarily unavailable — please retry shortly')
}
