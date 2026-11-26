import { Router } from 'express'

import { auth } from '../../middleware/auth.js'
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

router.use(auth)

router.get('/', validate(listVideosSchema), VideoController.listVideos)
router.get('/:videoId', validate(videoIdSchema), VideoController.getVideo)
router.put('/:videoId', validate(upsertVideoSchema), VideoController.upsertVideo)
router.delete('/:videoId', validate(videoIdSchema), VideoController.deleteVideo)
router.patch('/:videoId/progress', validate(progressUpdateSchema), VideoController.updateProgress)
router.post('/:videoId/notes', validate(addNoteSchema), VideoController.addNote)
router.patch('/:videoId/notes/:noteId', validate(updateNoteSchema), VideoController.updateNote)
router.delete('/:videoId/notes/:noteId', validate(noteIdSchema), VideoController.deleteNote)

export default router
