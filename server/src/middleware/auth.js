import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { verifyAccessToken } from '../modules/auth/token.js'
import User from '../modules/auth/user.model.js'

const readBearerToken = (req) => {
  const header = req.headers.authorization ?? ''
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null
}

/** Requires a valid JWT; attaches the user document to `req.user`. */
export const auth = asyncHandler(async (req, _res, next) => {
  const token = readBearerToken(req)
  if (!token) throw new ApiError(401, 'Please log in to continue')

  const payload = verifyAccessToken(token)
  const user = await User.findById(payload.sub)
  if (!user) throw new ApiError(401, 'Account not found — please log in again')

  req.user = user
  next()
})
