import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createApp } from './app.js'
import { connectDB, disconnectDB } from './config/db.js'
import { env } from './config/env.js'
import { connectRedis, disconnectRedis } from './config/redis.js'
import { startLoadMonitor, stopLoadMonitor } from './middleware/loadShedding.js'
import { markShuttingDown } from './modules/health/health.routes.js'
import { logger } from './utils/logger.js'

// Lets the load balancer notice "not ready" (via /api/health/ready) before connections close.
const DRAIN_DELAY_MS = env.isProduction ? 5_000 : 0

/** Starts the HTTP server (used directly, or by each worker in cluster mode). */
export const startServer = async () => {
  await connectDB()
  await connectRedis()
  startLoadMonitor()

  const server = createApp().listen(env.PORT, () => {
    logger.info(`LEATCH API listening on :${env.PORT} (pid ${process.pid}, AI ${env.isAiEnabled ? `on: ${env.AI_MODEL}` : 'off'})`)
  })

  // Slow-client protection: keep-alive must outlive the load balancer's idle timeout (~60 s);
  // a whole request must arrive within 30 s and its headers within the keep-alive window.
  server.keepAliveTimeout = 65_000
  server.headersTimeout = 66_000
  server.requestTimeout = 30_000
  server.maxRequestsPerSocket = 1_000

  let stopping = false
  const shutdown = async (signal) => {
    if (stopping) return
    stopping = true
    logger.info(`${signal} received — draining connections`)
    markShuttingDown()
    const force = setTimeout(() => {
      logger.error('Shutdown timed out — forcing exit')
      process.exit(1)
    }, env.SHUTDOWN_TIMEOUT_MS)
    force.unref()

    await new Promise((resolve) => setTimeout(resolve, DRAIN_DELAY_MS))
    server.close(async () => {
      stopLoadMonitor()
      await Promise.allSettled([disconnectDB(), disconnectRedis()])
      logger.info('Shutdown complete')
      process.exit(0)
    })
    server.closeIdleConnections()
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  return server
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason)
})
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception — exiting:', err)
  process.exit(1)
})

const isEntryPoint = Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isEntryPoint) {
  startServer().catch((err) => {
    logger.error('Failed to start server:', err)
    process.exit(1)
  })
}
