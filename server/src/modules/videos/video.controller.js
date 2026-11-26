import { ApiResponse } from '../../utils/ApiResponse.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import * as VideoService from './video.service.js'

export const listVideos = asyncHandler(async (req, res) => {
  const result = await VideoService.listVideos(req.user._id, req.validQuery)
  res.json(new ApiResponse(200, result))
})

export const getVideo = asyncHandler(async (req, res) => {
  const video = await VideoService.getVideo(req.user._id, req.params.videoId)
  res.json(new ApiResponse(200, video))
})

export const upsertVideo = asyncHandler(async (req, res) => {
  const { video, created } = await VideoService.upsertVideo(req.user._id, req.params.videoId, req.body)
  const status = created ? 201 : 200
  res.status(status).json(new ApiResponse(status, video, created ? 'Saved to your library' : 'Lesson updated'))
})

export const updateProgress = asyncHandler(async (req, res) => {
  const progress = await VideoService.updateProgress(req.user._id, req.params.videoId, req.body)
  res.json(new ApiResponse(200, progress))
})

export const addNote = asyncHandler(async (req, res) => {
  const note = await VideoService.addNote(req.user._id, req.params.videoId, req.body)
  res.status(201).json(new ApiResponse(201, note, 'Note added'))
})

export const updateNote = asyncHandler(async (req, res) => {
  const note = await VideoService.updateNote(req.user._id, req.params.videoId, req.params.noteId, req.body.text)
  res.json(new ApiResponse(200, note, 'Note updated'))
})

export const deleteNote = asyncHandler(async (req, res) => {
  await VideoService.deleteNote(req.user._id, req.params.videoId, req.params.noteId)
  res.json(new ApiResponse(200, null, 'Note deleted'))
})

export const deleteVideo = asyncHandler(async (req, res) => {
  await VideoService.deleteVideo(req.user._id, req.params.videoId)
  res.json(new ApiResponse(200, null, 'Removed from your library'))
})
