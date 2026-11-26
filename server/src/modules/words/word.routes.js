import { Router } from 'express'

import { auth } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import * as WordController from './word.controller.js'
import { lemmaListSchema, listWordsSchema, saveWordSchema, updateWordSchema, wordIdSchema } from './word.validation.js'

const router = Router()

router.use(auth)

router.get('/', validate(listWordsSchema), WordController.listWords)
router.get('/lemmas', validate(lemmaListSchema), WordController.listLemmas)
router.post('/', validate(saveWordSchema), WordController.saveWord)
router.patch('/:id', validate(updateWordSchema), WordController.updateWord)
router.delete('/:id', validate(wordIdSchema), WordController.deleteWord)

export default router
