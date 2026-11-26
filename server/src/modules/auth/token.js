import { createSecretKey } from 'node:crypto'

import jwt from 'jsonwebtoken'

import { env } from '../../config/env.js'

const ALGORITHM = 'HS256'
const ISSUER = 'leatch-api'
const AUDIENCE = 'leatch-extension'
// Build the key object once; passing a raw string makes the library re-create it on every call.
const SECRET_KEY = createSecretKey(Buffer.from(env.JWT_SECRET, 'utf8'))

/**
 * Signs an access token. `ver` ties the token to the user's current token version so it can be
 * revoked (log out everywhere, password change).
 *
 * @param {{ _id: unknown, tokenVersion?: number }} user
 * @returns {string} JWT
 */
export const signAccessToken = (user) =>
  jwt.sign({ sub: String(user._id), ver: user.tokenVersion ?? 0 }, SECRET_KEY, {
    algorithm: ALGORITHM,
    expiresIn: env.JWT_EXPIRES,
    issuer: ISSUER,
    audience: AUDIENCE,
  })

/**
 * Verifies signature, algorithm, issuer, audience and expiry (throws JsonWebTokenError / TokenExpiredError).
 *
 * @param {string} token
 * @returns {{ sub: string, ver: number }}
 */
export const verifyAccessToken = (token) => jwt.verify(token, SECRET_KEY, { algorithms: [ALGORITHM], issuer: ISSUER, audience: AUDIENCE })
