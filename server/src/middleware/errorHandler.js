import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'

const KNOWN_ERRORS = [
  [(err) => err.code === 11000, (err) => [409, `Already exists: ${Object.keys(err.keyValue ?? {}).join(', ')}`]],
  [(err) => err.name === 'CastError', (err) => [400, `Invalid ${err.path}`]],
  [(err) => err.name === 'ValidationError', () => [422, 'Invalid data']],
  [(err) => err.name === 'JsonWebTokenError' || err.name === 'NotBeforeError', () => [401, 'Invalid session — please log in again']],
  [(err) => err.name === 'TokenExpiredError', () => [401, 'Session expired — please log in again']],
  [(err) => err.type === 'entity.too.large', () => [413, 'Request body too large']],
  [(err) => err.type === 'entity.parse.failed', () => [400, 'Malformed JSON body']],
  [(err) => err.type === 'encoding.unsupported' || err.type === 'charset.unsupported', () => [415, 'Unsupported content encoding']],
  [(err) => err.type === 'request.aborted', () => [400, 'Request aborted']],
  [
    (err) => ['MongoServerSelectionError', 'MongoNetworkError', 'MongoNetworkTimeoutError'].includes(err.name) || /buffering timed out/.test(err.message ?? ''),
    () => [503, 'Database temporarily unavailable — please retry'],
  ],
]

/** 404 for unknown routes. */
export const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found`, errors: [] })
}

/** Global error handler — must be registered last. Never leaks internals in production. */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  const known = KNOWN_ERRORS.find(([matches]) => matches(err))?.[1](err)
  const statusCode = known?.[0] ?? err.statusCode ?? 500
  const message = known?.[1] ?? (statusCode >= 500 ? 'Internal server error' : err.message)

  if (statusCode === 503) logger.warn({ msg: 'service unavailable', requestId: req.id, path: req.originalUrl, error: err.message })
  else if (statusCode >= 500) logger.error({ msg: 'request failed', requestId: req.id, path: req.originalUrl, error: err.message, stack: err.stack })

  // A timeout (or another middleware) may already have answered.
  if (res.headersSent) return

  res.status(statusCode).json({
    success: false,
    message,
    errors: statusCode < 500 && Array.isArray(err.errors) ? err.errors : [],
    requestId: req.id,
    ...(env.NODE_ENV === 'development' && statusCode >= 500 && { stack: err.stack }),
  })
}
