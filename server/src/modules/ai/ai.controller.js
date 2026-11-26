import { env } from '../../config/env.js'
import { ApiResponse } from '../../utils/ApiResponse.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { analysisService } from './ai.service.js'
import { remainingAiQuota } from './usage.service.js'

export const status = asyncHandler(async (req, res) => {
  res.json(
    new ApiResponse(200, {
      enabled: env.isAiEnabled,
      model: env.isAiEnabled ? env.AI_MODEL : null,
      remainingToday: remainingAiQuota(req.user),
    }),
  )
})

export const analyze = asyncHandler(async (req, res) => {
  const result = await analysisService.analyzeChunk({ userId: req.user._id, ...req.body })
  res.json(new ApiResponse(200, result))
})
