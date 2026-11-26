import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'

const mapKnownError = (err) => {
  if (err.code === 11000) {
    return { statusCode: 409, message: `Already exists: ${Object.keys(err.keyValue ?? {}).join(', ')}` }
  }
  if (err.name === 'CastError') return { statusCode: 400, message: `Invalid ${err.path}` }
  if (err.name === 'ValidationError') return { statusCode: 422, message: err.message }
  if (err.name === 'JsonWebTokenError') return { statusCode: 401, message: 'Invalid session — please log in again' }
  if (err.name === 'TokenExpiredError') return { statusCode: 401, message: 'Session expired — please log in again' }
  if (err.type === 'entity.too.large') return { statusCode: 413, message: 'Request body too large' }
  if (err.type === 'entity.parse.failed') return { statusCode: 400, message: 'Malformed JSON body' }
  return null
}

/** 404 for unknown routes. */
export const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found`, errors: [] })
}

/** Global error handler — must be registered last. */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  const known = mapKnownError(err)
  const statusCode = known?.statusCode ?? err.statusCode ?? 500
  const message = known?.message ?? (statusCode >= 500 ? 'Internal server error' : err.message)

  if (statusCode >= 500) logger.error(`[${req.method} ${req.originalUrl}]`, err)

  res.status(statusCode).json({
    success: false,
    message,
    errors: err.errors ?? [],
    ...(env.NODE_ENV === 'development' && statusCode >= 500 && { stack: err.stack }),
  })
}
