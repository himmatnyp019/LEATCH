import mongoose from 'mongoose'

import { createApp } from './app.js'
import { connectDB } from './config/db.js'
import { env } from './config/env.js'
import { logger } from './utils/logger.js'

const start = async () => {
  await connectDB()
  const server = createApp().listen(env.PORT, () => {
    logger.info(`LEATCH API listening on http://localhost:${env.PORT} (AI ${env.isAiEnabled ? `on: ${env.AI_MODEL}` : 'off'})`)
  })

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down`)
    server.close()
    await mongoose.disconnect()
    process.exit(0)
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

start().catch((err) => {
  logger.error('Failed to start server:', err)
  process.exit(1)
})
