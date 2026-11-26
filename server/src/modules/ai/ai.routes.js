import { Router } from 'express'

import { env } from '../../config/env.js'
import { auth } from '../../middleware/auth.js'
import { aiLimiter, userLimiter } from '../../middleware/rateLimiter.js'
import { requestTimeout } from '../../middleware/requestGuards.js'
import { validate } from '../../middleware/validate.js'
import * as AiController from './ai.controller.js'
import { analyzeSchema } from './ai.validation.js'

const router = Router()

router.use(auth, userLimiter)

router.get('/status', AiController.status)
router.post('/analyze', aiLimiter, requestTimeout(env.AI_REQUEST_TIMEOUT_MS), validate(analyzeSchema), AiController.analyze)

export default router
