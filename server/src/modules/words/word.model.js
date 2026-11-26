import mongoose from 'mongoose'

const { Schema } = mongoose

/** A vocabulary item or grammar pattern the user saved for review. */
const wordSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lang: { type: String, required: true },
    lemma: { type: String, required: true, trim: true },
    surface: { type: String, default: '' },
    type: { type: String, enum: ['vocab', 'grammar'], default: 'vocab' },
    meaning: { type: String, default: '' },
    meaningLang: { type: String, default: '' },
    reading: { type: String, default: '' },
    pos: { type: String, default: '' },
    examples: [{ _id: false, text: String, translation: String }],
    context: {
      sentence: { type: String, default: '' },
      translation: { type: String, default: '' },
      videoId: { type: String, default: '' },
      videoTitle: { type: String, default: '' },
      time: { type: Number, default: 0 },
    },
    status: { type: String, enum: ['new', 'learning', 'known'], default: 'new' },
    reviewCount: { type: Number, default: 0 },
    lastReviewedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v
        return ret
      },
    },
  },
)

wordSchema.index({ user: 1, lang: 1, lemma: 1 }, { unique: true })
wordSchema.index({ user: 1, createdAt: -1 })

export default mongoose.model('Word', wordSchema)
