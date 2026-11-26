import { Router } from 'express'

import { auth } from '../../middleware/auth.js'
import { authLimiter } from '../../middleware/rateLimiter.js'
import { validate } from '../../middleware/validate.js'
import * as AuthController from './auth.controller.js'
import { loginSchema, registerSchema, updateMeSchema } from './auth.validation.js'

const router = Router()

router.post('/register', authLimiter, validate(registerSchema), AuthController.register)
router.post('/login', authLimiter, validate(loginSchema), AuthController.login)
router.get('/me', auth, AuthController.me)
router.patch('/me', auth, validate(updateMeSchema), AuthController.updateMe)

export default router
