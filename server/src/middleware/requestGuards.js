import { ApiError } from '../utils/ApiError.js'

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const MAX_DEPTH = 12

/** Returns the first dangerous key path in a parsed payload, or null. */
export const findDangerousKey = (value, path = '', depth = 0) => {
  if (depth > MAX_DEPTH) return `${path || '(root)'} (nested too deeply)`
  if (!value || typeof value !== 'object') return null
  for (const key of Object.keys(value)) {
    const keyPath = path ? `${path}.${key}` : key
    if (key.startsWith('$') || key.includes('.') || FORBIDDEN_KEYS.has(key)) return keyPath
    const nested = findDangerousKey(value[key], keyPath, depth + 1)
    if (nested) return nested
  }
  return null
}

/**
 * Rejects payloads carrying MongoDB operators (`$where`, `$gt`…), dotted keys or
 * prototype-pollution keys anywhere in the body or query (defence in depth on top of zod).
 */
export const rejectDangerousPayload = (req, _res, next) => {
  const offending = findDangerousKey(req.body) || findDangerousKey(req.query)
  if (offending) throw new ApiError(400, `Invalid field name: ${offending}`)
  next()
}

/**
 * Answers 503 if a handler has not responded within `ms` (protects clients and the connection
 * pool from requests stuck on a slow dependency). A route-level timeout replaces the global one.
 *
 * @param {number} ms
 */
export const requestTimeout = (ms) => (req, res, next) => {
  clearTimeout(res.locals.timeoutTimer)
  const timer = setTimeout(() => {
    if (res.headersSent) return
    req.timedOut = true
    res.status(503).json({ success: false, message: 'The request took too long — please try again', errors: [] })
  }, ms)
  timer.unref()
  res.locals.timeoutTimer = timer
  const clear = () => clearTimeout(timer)
  res.on('finish', clear)
  res.on('close', clear)
  next()
}
