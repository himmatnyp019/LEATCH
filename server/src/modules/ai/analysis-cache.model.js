import mongoose from 'mongoose'

/**
 * Shared (cross-user) cache of AI subtitle analyses. One document per chunk of
 * subtitle lines, keyed by a hash of the language pair + line texts, so the same
 * video section is never paid for twice — no matter which user watches it.
 */
const analysisCacheSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    videoId: { type: String, default: '' },
    sourceLang: { type: String, required: true },
    nativeLang: { type: String, required: true },
    hasTranslations: { type: Boolean, default: false },
    lines: { type: mongoose.Schema.Types.Mixed, default: [] },
    model: { type: String, default: '' },
    hits: { type: Number, default: 0 },
  },
  { timestamps: true },
)

analysisCacheSchema.index({ videoId: 1 })

export default mongoose.model('AnalysisCache', analysisCacheSchema)
