import { ApiResponse } from '../../utils/ApiResponse.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import * as WordService from './word.service.js'

export const listWords = asyncHandler(async (req, res) => {
  res.json(new ApiResponse(200, await WordService.listWords(req.user._id, req.validQuery)))
})

export const listLemmas = asyncHandler(async (req, res) => {
  res.json(new ApiResponse(200, await WordService.listLemmas(req.user._id, req.validQuery.lang)))
})

export const saveWord = asyncHandler(async (req, res) => {
  const { word, created } = await WordService.saveWord(req.user._id, req.body)
  const status = created ? 201 : 200
  res.status(status).json(new ApiResponse(status, word, created ? 'Word saved' : 'Word updated'))
})

export const updateWord = asyncHandler(async (req, res) => {
  res.json(new ApiResponse(200, await WordService.updateWord(req.user._id, req.params.id, req.body)))
})

export const deleteWord = asyncHandler(async (req, res) => {
  await WordService.deleteWord(req.user._id, req.params.id)
  res.json(new ApiResponse(200, null, 'Word removed'))
})
