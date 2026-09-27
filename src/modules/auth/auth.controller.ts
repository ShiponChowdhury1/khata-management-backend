import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { ApiError } from '../../utils/apiError.js';

/**
 * অথেন্টিকেশন কন্ট্রোলার হ্যান্ডলারস
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    throw ApiError.badRequest('Name, email, and password are required fields');
  }

  const result = await AuthService.register({ name, email, password, role });
  sendSuccess(res, 201, 'User registered successfully', result);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw ApiError.badRequest('Email and password are required');
  }

  const result = await AuthService.login({ email, password });
  sendSuccess(res, 200, 'Login successful', result);
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.userId) {
    throw ApiError.unauthorized('User not authenticated');
  }

  const user = await AuthService.getMe(req.user.userId);
  sendSuccess(res, 200, 'User profile fetched successfully', user);
});
