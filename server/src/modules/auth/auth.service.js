import { env } from '../../config/env.js'
import { ApiError } from '../../utils/ApiError.js'
import { logger } from '../../utils/logger.js'
import { dummyHash, needsRehash, verifyPassword } from '../../utils/password.js'
import { signAccessToken } from './token.js'
import User from './user.model.js'

const LOCK_MS = env.LOGIN_LOCK_MINUTES * 60 * 1000

const buildSession = (user) => ({ user: user.toJSON(), token: signAccessToken(user) })

const lockedError = (lockUntil) => {
  const minutes = Math.max(1, Math.ceil((lockUntil - Date.now()) / 60000))
  return new ApiError(429, `Too many failed attempts. Try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`)
}

/** Records a failed attempt and locks the account after LOGIN_MAX_FAILURES in a row. */
const registerFailure = async (user) => {
  const failures = (user.security?.failedLogins ?? 0) + 1
  const update = { 'security.failedLogins': failures }
  if (failures >= env.LOGIN_MAX_FAILURES) {
    update['security.lockUntil'] = new Date(Date.now() + LOCK_MS)
    update['security.failedLogins'] = 0
    logger.warn({ msg: 'account locked after failed logins', user: String(user._id) })
  }
  await User.updateOne({ _id: user._id }, { $set: update })
}

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
 * Verifies credentials and returns `{ user, token }`. Unknown emails take the same time as wrong
 * passwords (no account enumeration); repeated failures lock the account temporarily.
 *
 * @param {{ email: string, password: string }} credentials
 */
export const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password +tokenVersion')
  if (!user) {
    await verifyPassword(password, await dummyHash())
    throw new ApiError(401, 'Incorrect email or password')
  }
  if (user.isLocked()) throw lockedError(user.security.lockUntil)

  if (!(await user.comparePassword(password))) {
    await registerFailure(user)
    throw new ApiError(401, 'Incorrect email or password')
  }

  user.security.failedLogins = 0
  user.security.lockUntil = null
  user.security.lastLoginAt = new Date()
  if (needsRehash(user.password)) user.password = password // re-hashed with current parameters on save
  await user.save()
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

/** Changes the password and revokes every other session; returns a fresh session. */
export const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findById(userId).select('+password +tokenVersion')
  if (!user || !(await user.comparePassword(currentPassword))) throw new ApiError(401, 'Current password is incorrect')
  user.password = newPassword
  user.tokenVersion = (user.tokenVersion ?? 0) + 1
  user.security.passwordChangedAt = new Date()
  await user.save()
  return buildSession(user)
}

/** Revokes every token issued so far for this account. */
export const logoutEverywhere = async (userId) => {
  await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } })
}
