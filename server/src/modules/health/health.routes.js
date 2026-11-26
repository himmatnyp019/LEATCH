import mongoose from 'mongoose'
import { Router } from 'express'

import { env } from '../../config/env.js'
import { pingDB } from '../../config/db.js'
import { isRedisReady } from '../../config/redis.js'
import { currentLag } from '../../middleware/loadShedding.js'

const router = Router()
const READY_CACHE_MS = 1_000
let shuttingDown = false
let lastCheck = { at: 0, database: false }

/** DB ping, cached briefly so a flood of probes cannot turn into a flood of DB commands. */
const databaseReady = async () => {
  if (Date.now() - lastCheck.at > READY_CACHE_MS) lastCheck = { at: Date.now(), database: await pingDB() }
  return lastCheck.database
}

/** Called on SIGTERM so load balancers stop routing new traffic here before we close. */
export const markShuttingDown = () => {
  shuttingDown = true
}

/** Liveness: the process is up (used by the extension and container health checks). */
router.get('/', (_req, res) => {
  res.json({ success: true, status: 'ok', ai: env.isAiEnabled, version: '0.2.0' })
})

/** Readiness: dependencies are reachable and the process is not overloaded or draining. */
router.get('/ready', async (_req, res) => {
  const database = await databaseReady()
  const redis = env.REDIS_URL ? isRedisReady() : null
  const lagMs = Math.round(currentLag())
  const ready = database && !shuttingDown
  const checks = { database, databaseState: mongoose.connection.readyState, redis, eventLoopLagMs: lagMs, shuttingDown }
  res.status(ready ? 200 : 503).json({
    success: ready,
    status: ready ? 'ready' : 'not-ready',
    // Internal details are only exposed outside production.
    ...(!env.isProduction && { checks }),
  })
})

export default router
