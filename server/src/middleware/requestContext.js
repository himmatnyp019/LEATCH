import { randomUUID } from 'node:crypto'

import { logger } from '../utils/logger.js'

const SAFE_REQUEST_ID = /^[\w.:-]{8,64}$/

/** Assigns `req.id` (reusing a well-formed incoming X-Request-Id from the load balancer). */
export const requestId = (req, res, next) => {
  const incoming = req.get('x-request-id')
  req.id = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID()
  res.setHeader('X-Request-Id', req.id)
  next()
}

/** One structured access-log line per request (no bodies, no auth headers). */
export const requestLogger = (req, res, next) => {
  const startedAt = process.hrtime.bigint()
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6
    const entry = {
      msg: 'request',
      requestId: req.id,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      durationMs: Math.round(durationMs),
      ip: req.ip,
      user: req.user?._id?.toString(),
    }
    if (res.statusCode >= 500) logger.error(entry)
    else if (req.originalUrl.startsWith('/api/health')) logger.debug(entry)
    else logger.info(entry)
  })
  next()
}

/** API responses contain personal data: never let browsers or proxies cache them. */
export const noStore = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  next()
}
