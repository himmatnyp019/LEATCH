import { ApiResponse } from '../../utils/ApiResponse.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import * as AuthService from './auth.service.js'

export const register = asyncHandler(async (req, res) => {
  const session = await AuthService.register(req.body)
  res.status(201).json(new ApiResponse(201, session, 'Account created'))
})

export const login = asyncHandler(async (req, res) => {
  const session = await AuthService.login(req.body)
  res.json(new ApiResponse(200, session, 'Logged in'))
})

export const me = asyncHandler(async (req, res) => {
  res.json(new ApiResponse(200, req.user.toJSON()))
})

export const updateMe = asyncHandler(async (req, res) => {
  const user = await AuthService.updateProfile(req.user, req.body)
  res.json(new ApiResponse(200, user, 'Profile updated'))
})

export const changePassword = asyncHandler(async (req, res) => {
  const session = await AuthService.changePassword(req.user._id, req.body)
  res.json(new ApiResponse(200, session, 'Password changed — other devices were logged out'))
})

export const logoutAll = asyncHandler(async (req, res) => {
  await AuthService.logoutEverywhere(req.user._id)
  res.json(new ApiResponse(200, null, 'Logged out on all devices'))
})
