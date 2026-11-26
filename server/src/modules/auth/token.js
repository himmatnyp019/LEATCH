import jwt from 'jsonwebtoken'

import { env } from '../../config/env.js'

/**
 * Signs an access token for a user id.
 *
 * @param {string} userId
 * @returns {string} JWT
 */
export const signAccessToken = (userId) =>
  jwt.sign({ sub: String(userId) }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES })

/**
 * Verifies a token and returns its payload (throws JsonWebTokenError / TokenExpiredError).
 *
 * @param {string} token
 * @returns {{ sub: string }}
 */
export const verifyAccessToken = (token) => jwt.verify(token, env.JWT_SECRET)
