import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'

import { env } from './config/env.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import { apiLimiter } from './middleware/rateLimiter.js'
import aiRoutes from './modules/ai/ai.routes.js'
import authRoutes from './modules/auth/auth.routes.js'
import videoRoutes from './modules/videos/video.routes.js'
import wordRoutes from './modules/words/word.routes.js'

const EXTENSION_ORIGIN = /^(chrome|moz|safari-web)-extension:\/\//

const isAllowedOrigin = (origin) =>
  !origin || EXTENSION_ORIGIN.test(origin) || env.corsOrigins.includes(origin)

/**
 * Builds the Express application (no `listen` here, so tests can import it).
 *
 * @returns {import('express').Express}
 */
export const createApp = () => {
  const app = express()

  app.disable('x-powered-by')
  app.use(helmet())
  app.use(
    cors({
      origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  )
  // Saved lessons include full subtitle tracks, so allow a generous body size.
  app.use(express.json({ limit: '10mb' }))
  if (env.NODE_ENV !== 'test') app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'))

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, status: 'ok', ai: env.isAiEnabled, version: '0.1.0' })
  })

  app.use('/api', apiLimiter)
  app.use('/api/auth', authRoutes)
  app.use('/api/videos', videoRoutes)
  app.use('/api/words', wordRoutes)
  app.use('/api/ai', aiRoutes)

  app.use(notFound)
  app.use(errorHandler)

  return app
}

export default createApp
