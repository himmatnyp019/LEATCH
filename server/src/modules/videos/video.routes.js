import express, { Router } from 'express'

import { LESSON_BODY_LIMIT } from '../../config/constants.js'
import { auth } from '../../middleware/auth.js'
import { userLimiter, writeLimiter } from '../../middleware/rateLimiter.js'
import { rejectDangerousPayload } from '../../middleware/requestGuards.js'
import { validate } from '../../middleware/validate.js'
import * as VideoController from './video.controller.js'
import {
  addNoteSchema,
  listVideosSchema,
  noteIdSchema,
  progressUpdateSchema,
  updateNoteSchema,
  upsertVideoSchema,
  videoIdSchema,
} from './video.validation.js'

const router = Router()

// Large lesson bodies are parsed only after the caller is authenticated and rate-limited.
const lessonBody = [express.json({ limit: LESSON_BODY_LIMIT }), rejectDangerousPayload]

router.use(auth, userLimiter)

router.get('/', validate(listVideosSchema), VideoController.listVideos)
router.get('/:videoId', validate(videoIdSchema), VideoController.getVideo)
router.put('/:videoId', writeLimiter, ...lessonBody, validate(upsertVideoSchema), VideoController.upsertVideo)
router.delete('/:videoId', writeLimiter, validate(videoIdSchema), VideoController.deleteVideo)
router.patch('/:videoId/progress', validate(progressUpdateSchema), VideoController.updateProgress)
router.post('/:videoId/notes', writeLimiter, validate(addNoteSchema), VideoController.addNote)
router.patch('/:videoId/notes/:noteId', writeLimiter, validate(updateNoteSchema), VideoController.updateNote)
router.delete('/:videoId/notes/:noteId', writeLimiter, validate(noteIdSchema), VideoController.deleteNote)

export default router
