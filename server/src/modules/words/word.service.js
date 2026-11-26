import { ApiError } from '../../utils/ApiError.js'
import Word from './word.model.js'

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Lists saved words with optional filters.
 *
 * @param {string} userId
 * @param {{ lang?: string, status?: string, q?: string, page: number, limit: number }} options
 */
export const listWords = async (userId, { lang, status, q, page, limit }) => {
  const filter = { user: userId }
  if (lang) filter.lang = lang
  if (status) filter.status = status
  if (q) {
    const pattern = { $regex: escapeRegex(q), $options: 'i' }
    filter.$or = [{ lemma: pattern }, { meaning: pattern }, { surface: pattern }]
  }

  const [items, total] = await Promise.all([
    Word.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Word.countDocuments(filter),
  ])
  return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit), hasNext: page * limit < total } }
}

/** Returns just the saved lemmas for a language (used to mark ★ in the player UI). */
export const listLemmas = async (userId, lang) => {
  const words = await Word.find({ user: userId, lang }, { lemma: 1, _id: 0 }).lean()
  return words.map((word) => word.lemma)
}

/**
 * Saves (or refreshes) a word. Status and review history are preserved on re-save.
 *
 * @returns {Promise<{ word: object, created: boolean }>}
 */
export const saveWord = async (userId, data) => {
  const filter = { user: userId, lang: data.lang, lemma: data.lemma }
  const existing = await Word.exists(filter)
  const word = await Word.findOneAndUpdate(
    filter,
    { $set: data },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
  )
  return { word, created: !existing }
}

/** Updates status / meaning, or records a review. */
export const updateWord = async (userId, wordId, { status, meaning, reviewed }) => {
  const word = await Word.findOne({ _id: wordId, user: userId })
  if (!word) throw new ApiError(404, 'Word not found')
  if (status) word.status = status
  if (meaning !== undefined) word.meaning = meaning
  if (reviewed) {
    word.reviewCount += 1
    word.lastReviewedAt = new Date()
  }
  await word.save()
  return word
}

/** Deletes a saved word. */
export const deleteWord = async (userId, wordId) => {
  const result = await Word.deleteOne({ _id: wordId, user: userId })
  if (result.deletedCount === 0) throw new ApiError(404, 'Word not found')
}
