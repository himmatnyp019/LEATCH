import compression from 'compression'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'

import { DEFAULT_BODY_LIMIT } from './config/constants.js'
import { env } from './config/env.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import { loadShedding } from './middleware/loadShedding.js'
import { globalLimiter } from './middleware/rateLimiter.js'
import { noStore, requestId, requestLogger } from './middleware/requestContext.js'
import { rejectDangerousPayload, requestTimeout } from './middleware/requestGuards.js'
import aiRoutes from './modules/ai/ai.routes.js'
import authRoutes from './modules/auth/auth.routes.js'
import healthRoutes from './modules/health/health.routes.js'
import videoRoutes from './modules/videos/video.routes.js'
import wordRoutes from './modules/words/word.routes.js'

const EXTENSION_ORIGIN = /^(chrome|moz|safari-web)-extension:\/\/([\w-]+)$/
const LESSON_UPLOAD = /^\/api\/videos\/[\w-]{11}$/

/**
 * CORS policy: browser extensions (optionally only the IDs in ALLOWED_EXTENSION_IDS) and any
 * explicitly configured web origins. Requests without an Origin (server-to-server, the extension's
 * service worker with host permissions) are not affected by CORS.
 */
export const isAllowedOrigin = (origin) => {
  if (!origin) return true
  if (env.corsOrigins.includes(origin)) return true
  const match = EXTENSION_ORIGIN.exec(origin)
  if (!match) return false
  return env.allowedExtensionIds.length === 0 || env.allowedExtensionIds.includes(match[2])
}

/** Small JSON bodies everywhere; lesson uploads are parsed later by their route (after auth). */
const jsonBody = express.json({
  limit: DEFAULT_BODY_LIMIT,
  type: (req) => !(req.method === 'PUT' && LESSON_UPLOAD.test(req.path)) && /application\/json/i.test(req.headers['content-type'] ?? ''),
})

/**
 * Builds the Express application (no `listen` here, so tests can import it).
 *
 * @returns {import('express').Express}
 */
export const createApp = () => {
  const app = express()

  app.set('trust proxy', env.trustProxy)
  app.disable('x-powered-by')
  app.disable('etag')

  app.use(requestId)
  app.use(requestLogger)

  // Health probes stay outside rate limits / load shedding so orchestrators can always reach them.
  app.use('/api/health', healthRoutes)

  app.use(loadShedding())
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: env.isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
    }),
  )
  app.use(
    cors({
      origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
      maxAge: 600,
    }),
  )
  if (env.COMPRESSION) app.use(compression({ threshold: 1024 }))
  app.use('/api', noStore, globalLimiter)
  app.use(jsonBody)
  app.use(rejectDangerousPayload)
  app.use(requestTimeout(env.REQUEST_TIMEOUT_MS))

  app.use('/api/auth', authRoutes)
  app.use('/api/videos', videoRoutes)
  app.use('/api/words', wordRoutes)
  app.use('/api/ai', aiRoutes)

  app.use(notFound)
  app.use(errorHandler)

  return app
}

export default createApp
