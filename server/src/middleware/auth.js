import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { verifyAccessToken } from '../modules/auth/token.js'
import User from '../modules/auth/user.model.js'
import { requireDatabase } from './requireDatabase.js'

const readBearerToken = (req) => {
  const header = req.headers.authorization ?? ''
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null
}

/**
 * Requires a valid access token; attaches the user to `req.user`.
 * Tokens are rejected after "log out everywhere" or a password change (token version bump).
 */
export const auth = asyncHandler(async (req, _res, next) => {
  const token = readBearerToken(req)
  if (!token) throw new ApiError(401, 'Please log in to continue')

  const payload = verifyAccessToken(token)
  requireDatabase(req, _res, () => {})
  const user = await User.findById(payload.sub).select('+tokenVersion')
  if (!user) throw new ApiError(401, 'Account not found — please log in again')
  if ((payload.ver ?? 0) !== (user.tokenVersion ?? 0)) throw new ApiError(401, 'Session expired — please log in again')

  req.user = user
  next()
})
