import { Router } from 'express'

import { auth } from '../../middleware/auth.js'
import { authLimiter, authSlowDown, loginAccountLimiter, userLimiter } from '../../middleware/rateLimiter.js'
import { requireDatabase } from '../../middleware/requireDatabase.js'
import { validate } from '../../middleware/validate.js'
import * as AuthController from './auth.controller.js'
import { changePasswordSchema, loginSchema, registerSchema, updateMeSchema } from './auth.validation.js'

const router = Router()

router.post('/register', authLimiter, authSlowDown, validate(registerSchema), requireDatabase, AuthController.register)
router.post('/login', authLimiter, authSlowDown, validate(loginSchema), loginAccountLimiter, requireDatabase, AuthController.login)

router.get('/me', auth, userLimiter, AuthController.me)
router.patch('/me', auth, userLimiter, validate(updateMeSchema), AuthController.updateMe)
router.post('/password', auth, authLimiter, validate(changePasswordSchema), AuthController.changePassword)
router.post('/logout-all', auth, userLimiter, AuthController.logoutAll)

export default router
