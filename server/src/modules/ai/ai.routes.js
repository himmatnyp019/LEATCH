import { Router } from 'express'

import { auth } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import * as AiController from './ai.controller.js'
import { analyzeSchema } from './ai.validation.js'

const router = Router()

router.use(auth)

router.get('/status', AiController.status)
router.post('/analyze', validate(analyzeSchema), AiController.analyze)

export default router
