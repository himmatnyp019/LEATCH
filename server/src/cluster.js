import cluster from 'node:cluster'
import os from 'node:os'

import { env } from './config/env.js'
import { logger } from './utils/logger.js'

const MAX_RESTART_DELAY_MS = 30_000

/**
 * Runs one API worker per CPU core (or WEB_CONCURRENCY) on the same port and restarts crashed
 * workers with backoff. Use with REDIS_URL so rate limits are shared between workers.
 * In Kubernetes/containers prefer one process per container and scale replicas instead.
 */
if (cluster.isPrimary) {
  const workers = env.WEB_CONCURRENCY || os.availableParallelism()
  let restarts = 0
  let stopping = false
  logger.info(`Primary ${process.pid} starting ${workers} workers`)
  if (!env.REDIS_URL) logger.warn('REDIS_URL not set: each worker keeps its own rate-limit counters')

  for (let i = 0; i < workers; i++) cluster.fork()

  cluster.on('exit', (worker, code, signal) => {
    if (stopping) return
    restarts += 1
    const delay = Math.min(MAX_RESTART_DELAY_MS, 500 * 2 ** Math.min(restarts, 6))
    logger.error(`Worker ${worker.process.pid} exited (${signal || code}); restarting in ${delay} ms`)
    setTimeout(() => cluster.fork(), delay)
  })

  const stop = (signal) => {
    stopping = true
    logger.info(`${signal} received — stopping workers`)
    for (const worker of Object.values(cluster.workers)) worker?.process.kill(signal)
  }
  process.on('SIGTERM', () => stop('SIGTERM'))
  process.on('SIGINT', () => stop('SIGINT'))
} else {
  const { startServer } = await import('./server.js')
  await startServer()
}
