import type { Request, Response } from 'express';
import { UserService } from './user.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import type { UserQueryDto } from './user.types.js';

/**
 * ইউজার কন্ট্রোলার হ্যান্ডলারস
 */

// ১. নতুন ইউজার তৈরি (POST /api/users)
export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const creatorUserId = req.user!.userId;
  const user = await UserService.createUser(req.body, creatorUserId);
  sendSuccess(res, 201, `User '${user.name}' created successfully`, user);
});

// ২. সব ইউজারের তালিকা (GET /api/users)
export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as UserQueryDto;
  const result = await UserService.getAllUsers(query);
  sendSuccess(res, 200, 'Users retrieved successfully', result.users, result.meta);
});

// ৩. নির্দিষ্ট ইউজারের বিস্তারিত (GET /api/users/:id)
export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.id as string;
  const user = await UserService.getUserById(userId);
  sendSuccess(res, 200, 'User details retrieved successfully', user);
});

// ৪. ইউজার তথ্য আপডেট (PATCH /api/users/:id)
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.id as string;
  const updaterUserId = req.user!.userId;
  const updatedUser = await UserService.updateUser(userId, req.body, updaterUserId);
  sendSuccess(res, 200, `User '${updatedUser.name}' updated successfully`, updatedUser);
});

// ৫. ইউজারের অ্যাক্টিভ স্ট্যাটাস টগল (PATCH /api/users/:id/toggle-status)
export const toggleUserStatus = asyncHandler(async (req: Request, res: Response) => {
  const targetUserId = req.params.id as string;
  const updaterUserId = req.user!.userId;
  const user = await UserService.toggleUserStatus(targetUserId, updaterUserId);
  sendSuccess(
    res,
    200,
    `User '${user.name}' status changed to ${user.isActive ? 'ACTIVE' : 'DEACTIVATED'}`,
    user
  );
});

// ৬. নিজের পাসওয়ার্ড পরিবর্তন (PATCH /api/users/me/password)
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const currentUserId = req.user!.userId;
  const result = await UserService.changePassword(currentUserId, req.body);
  sendSuccess(res, 200, result.message);
});
