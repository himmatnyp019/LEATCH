import { monitorEventLoopDelay } from 'node:perf_hooks'

import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'

const SAMPLE_INTERVAL_MS = 500
const RETRY_AFTER_SECONDS = 2

let currentLagMs = 0
let histogram = null
let timer = null

/** Starts measuring event-loop delay (idempotent). */
export const startLoadMonitor = () => {
  if (timer || env.LOAD_SHED_MAX_LAG_MS === 0) return
  histogram = monitorEventLoopDelay({ resolution: 20 })
  histogram.enable()
  timer = setInterval(() => {
    currentLagMs = histogram.percentile(99) / 1e6
    histogram.reset()
  }, SAMPLE_INTERVAL_MS)
  timer.unref()
}

export const stopLoadMonitor = () => {
  clearInterval(timer)
  histogram?.disable()
  timer = null
}

export const currentLag = () => currentLagMs

/**
 * Rejects new work with 503 + Retry-After while the event loop is saturated, so the process
 * keeps serving in-flight requests instead of collapsing under a traffic spike.
 *
 * @param {{ maxLagMs?: number, getLag?: () => number }} [options] - injectable for tests
 */
export const loadShedding = ({ maxLagMs = env.LOAD_SHED_MAX_LAG_MS, getLag = currentLag } = {}) => {
  let lastWarning = 0
  return (req, res, next) => {
    if (!maxLagMs || getLag() <= maxLagMs) return next()
    if (Date.now() - lastWarning > 10_000) {
      lastWarning = Date.now()
      logger.warn({ msg: 'shedding load', lagMs: Math.round(getLag()), requestId: req.id })
    }
    res.setHeader('Retry-After', String(RETRY_AFTER_SECONDS))
    res.status(503).json({ success: false, message: 'Server is busy — please retry in a moment', errors: [] })
  }
}
