import { ApiError } from '../../utils/ApiError.js'
import Video from './video.model.js'

const COMPLETED_THRESHOLD = 0.95

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildProgress = ({ position, duration }, previous = {}) => {
  const total = duration || previous.duration || 0
  const percent = total > 0 ? Math.min(1, position / total) : 0
  return {
    position,
    duration: total,
    percent,
    completed: Boolean(previous.completed) || percent >= COMPLETED_THRESHOLD,
    lastWatchedAt: new Date(),
  }
}

/** Union of old and new vocab keyed by cue + lemma; new entries win. */
const mergeVocab = (previous = [], incoming = []) => {
  const byKey = new Map(previous.map((item) => [`${item.cueIndex}|${item.lemma}`, item]))
  for (const item of incoming) byKey.set(`${item.cueIndex}|${item.lemma}`, item)
  return [...byKey.values()].sort((a, b) => a.cueIndex - b.cueIndex)
}

/** Keeps an older translation when a re-save sends the same cue without one. */
const mergeCues = (previous = [], incoming = []) =>
  incoming.map((cue, index) => {
    const old = previous[index]
    if (!cue.translation && old?.text === cue.text && old.translation) return { ...cue, translation: old.translation }
    return cue
  })

const findOwnedVideo = async (userId, videoId) => {
  const video = await Video.findOne({ user: userId, videoId })
  if (!video) throw new ApiError(404, 'This video is not saved in your library yet')
  return video
}

/**
 * Lists a user's saved videos (without the heavy cue/vocab arrays), most recently watched first.
 *
 * @param {string} userId
 * @param {{ page: number, limit: number, q?: string }} options
 */
export const listVideos = async (userId, { page, limit, q }) => {
  const match = { user: userId }
  if (q) match.title = { $regex: escapeRegex(q), $options: 'i' }

  const [items, total] = await Promise.all([
    Video.aggregate([
      { $match: match },
      { $sort: { 'progress.lastWatchedAt': -1, updatedAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $addFields: {
          cueCount: { $size: { $ifNull: ['$cues', []] } },
          vocabCount: { $size: { $ifNull: ['$vocab', []] } },
          noteCount: { $size: { $ifNull: ['$notes', []] } },
        },
      },
      { $project: { cues: 0, vocab: 0, notes: 0, __v: 0 } },
    ]),
    Video.countDocuments(match),
  ])

  return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit), hasNext: page * limit < total } }
}

/** Full saved lesson. */
export const getVideo = (userId, videoId) => findOwnedVideo(userId, videoId)

/**
 * Creates or updates a saved lesson. Notes are never touched here; vocab is merged.
 *
 * @param {string} userId
 * @param {string} videoId
 * @param {object} data - validated body
 */
export const upsertVideo = async (userId, videoId, data) => {
  const existing = await Video.findOne({ user: userId, videoId })
  const video = existing ?? new Video({ user: userId, videoId })
  const { cues, vocab, progress, ...meta } = data

  Object.assign(video, meta)
  if (!video.url) video.url = `https://www.youtube.com/watch?v=${videoId}`
  if (cues) video.cues = mergeCues(existing?.cues, cues)
  if (vocab) video.vocab = mergeVocab(existing?.vocab?.map((item) => item.toObject()), vocab)
  if (progress) video.progress = buildProgress(progress, existing?.progress)

  await video.save()
  return { video, created: !existing }
}

/** Updates playback progress of a saved lesson. */
export const updateProgress = async (userId, videoId, progress) => {
  const video = await findOwnedVideo(userId, videoId)
  video.progress = buildProgress(progress, video.progress)
  await video.save()
  return video.progress
}

/** Adds a timestamped note to a saved lesson. */
export const addNote = async (userId, videoId, note) => {
  const video = await findOwnedVideo(userId, videoId)
  video.notes.push(note)
  await video.save()
  return video.notes.at(-1)
}

/** Edits the text of a note. */
export const updateNote = async (userId, videoId, noteId, text) => {
  const video = await findOwnedVideo(userId, videoId)
  const note = video.notes.id(noteId)
  if (!note) throw new ApiError(404, 'Note not found')
  note.text = text
  await video.save()
  return note
}

/** Deletes a note. */
export const deleteNote = async (userId, videoId, noteId) => {
  const video = await findOwnedVideo(userId, videoId)
  const note = video.notes.id(noteId)
  if (!note) throw new ApiError(404, 'Note not found')
  note.deleteOne()
  await video.save()
}

/** Removes a saved lesson. */
export const deleteVideo = async (userId, videoId) => {
  const result = await Video.deleteOne({ user: userId, videoId })
  if (result.deletedCount === 0) throw new ApiError(404, 'Video not found')
}
