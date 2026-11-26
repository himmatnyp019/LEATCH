import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'

import { BCRYPT_ROUNDS } from '../../config/constants.js'

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 60, default: '' },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
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
        delete ret.__v
        delete ret.aiUsage
        return ret
      },
    },
  },
)

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return
  this.password = await bcrypt.hash(this.password, BCRYPT_ROUNDS)
})

/**
 * Compares a plain password with the stored hash. Requires `.select('+password')`.
 *
 * @param {string} plain
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.password)
}

export default mongoose.model('User', userSchema)
