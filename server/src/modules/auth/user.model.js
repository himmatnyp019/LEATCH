import mongoose from 'mongoose'

import { hashPassword, verifyPassword } from '../../utils/password.js'

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 60, default: '' },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    password: { type: String, required: true, select: false },
    /** Incremented to revoke every issued token (log out everywhere / password change). */
    tokenVersion: { type: Number, default: 0, select: false },
    security: {
      failedLogins: { type: Number, default: 0 },
      lockUntil: { type: Date, default: null },
      lastLoginAt: { type: Date, default: null },
      passwordChangedAt: { type: Date, default: null },
    },
    preferences: {
      learningLang: { type: String, default: 'ko' },
      nativeLang: { type: String, default: 'en' },
    },
    aiUsage: {
      day: { type: String, default: '' },
      chunks: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.password
        delete ret.tokenVersion
        delete ret.security
        delete ret.aiUsage
        delete ret.__v
        return ret
      },
    },
  },
)

userSchema.pre('save', async function hashModifiedPassword() {
  if (!this.isModified('password')) return
  this.password = await hashPassword(this.password)
})

/**
 * Compares a plain password with the stored hash. Requires `.select('+password')`.
 *
 * @param {string} plain
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = function comparePassword(plain) {
  return verifyPassword(plain, this.password)
}

/** True while the account is temporarily locked after repeated failed logins. */
userSchema.methods.isLocked = function isLocked() {
  return Boolean(this.security?.lockUntil && this.security.lockUntil > new Date())
}

export default mongoose.model('User', userSchema)
