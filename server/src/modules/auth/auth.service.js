import { ApiError } from '../../utils/ApiError.js'
import { signAccessToken } from './token.js'
import User from './user.model.js'

const buildSession = (user) => ({ user: user.toJSON(), token: signAccessToken(user._id) })

/**
 * Creates an account and returns `{ user, token }`.
 *
 * @param {{ email: string, password: string, name?: string }} data
 */
export const register = async ({ email, password, name }) => {
  const existing = await User.exists({ email })
  if (existing) throw new ApiError(409, 'An account with this email already exists')
  const user = await User.create({ email, password, name })
  return buildSession(user)
}

/**
 * Verifies credentials and returns `{ user, token }`.
 *
 * @param {{ email: string, password: string }} credentials
 */
export const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password')
  const isValid = user ? await user.comparePassword(password) : false
  if (!isValid) throw new ApiError(401, 'Incorrect email or password')
  return buildSession(user)
}

/**
 * Updates the profile name / language preferences.
 *
 * @param {import('mongoose').Document} user
 * @param {{ name?: string, preferences?: object }} changes
 */
export const updateProfile = async (user, { name, preferences }) => {
  if (name !== undefined) user.name = name
  if (preferences?.learningLang) user.preferences.learningLang = preferences.learningLang
  if (preferences?.nativeLang) user.preferences.nativeLang = preferences.nativeLang
  await user.save()
  return user.toJSON()
}
