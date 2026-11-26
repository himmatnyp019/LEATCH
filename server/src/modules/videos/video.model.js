import mongoose from 'mongoose'

const { Schema } = mongoose

const exampleSchema = new Schema({ text: String, translation: String }, { _id: false })

const vocabItemSchema = new Schema(
  {
    cueIndex: { type: Number, required: true },
    surface: String,
    lemma: { type: String, required: true },
    type: { type: String, enum: ['vocab', 'grammar'], default: 'vocab' },
    meaning: String,
    reading: String,
    pos: String,
    examples: [exampleSchema],
  },
  { _id: false },
)

const cueSchema = new Schema(
  { start: Number, end: Number, text: String, translation: { type: String, default: '' } },
  { _id: false },
)

const noteSchema = new Schema(
  { time: { type: Number, default: 0 }, text: { type: String, required: true }, cueText: { type: String, default: '' } },
  { timestamps: true },
)

/** A YouTube video saved by a user as a lesson: subtitles, vocabulary, notes and progress. */
const videoSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    videoId: { type: String, required: true },
    url: String,
    title: { type: String, default: '' },
    channel: { type: String, default: '' },
    thumbnail: { type: String, default: '' },
    durationSec: { type: Number, default: 0 },
    sourceLang: { type: String, default: '' },
    translationLang: { type: String, default: '' },
    trackLabel: { type: String, default: '' },
    cues: [cueSchema],
    vocab: [vocabItemSchema],
    notes: [noteSchema],
    // Denormalised counts so the library list never has to load the heavy arrays.
    cueCount: { type: Number, default: 0 },
    vocabCount: { type: Number, default: 0 },
    noteCount: { type: Number, default: 0 },
    progress: {
      position: { type: Number, default: 0 },
      duration: { type: Number, default: 0 },
      percent: { type: Number, default: 0 },
      completed: { type: Boolean, default: false },
      lastWatchedAt: { type: Date, default: Date.now },
    },
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

videoSchema.index({ user: 1, videoId: 1 }, { unique: true })
videoSchema.index({ user: 1, 'progress.lastWatchedAt': -1 })

videoSchema.pre('save', function syncCounts() {
  this.cueCount = this.cues.length
  this.vocabCount = this.vocab.length
  this.noteCount = this.notes.length
})

export default mongoose.model('Video', videoSchema)
