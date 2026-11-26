import mongoose from 'mongoose'

/**
 * Shared dictionary of example sentences per lemma and language pair.
 * Example sentences are generated once per lemma and reused across all videos/users.
 */
const lexiconSchema = new mongoose.Schema(
  {
    lang: { type: String, required: true },
    nativeLang: { type: String, required: true },
    lemma: { type: String, required: true },
    type: { type: String, enum: ['vocab', 'grammar'], default: 'vocab' },
    meaning: { type: String, default: '' },
    reading: { type: String, default: '' },
    examples: [{ _id: false, text: String, translation: String }],
    hits: { type: Number, default: 0 },
  },
  { timestamps: true },
)

lexiconSchema.index({ lang: 1, nativeLang: 1, lemma: 1 }, { unique: true })

export default mongoose.model('Lexicon', lexiconSchema)
