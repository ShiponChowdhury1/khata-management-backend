import type { Request, Response } from 'express';
import { BranchService } from './branch.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import type { BranchQueryDto } from './branch.types.js';

/**
 * ব্রাঞ্চ কন্ট্রোলার হ্যান্ডলারস
 */

// ১. নতুন ব্রাঞ্চ তৈরি (POST /api/branches)
export const createBranch = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const branch = await BranchService.createBranch(req.body, userId);
  sendSuccess(res, 201, 'Branch created successfully', branch);
});

// ২. সব ব্রাঞ্চের তালিকা — পেজিনেশন ও সার্চ সহ (GET /api/branches)
export const getAllBranches = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as BranchQueryDto;
  const result = await BranchService.getAllBranches(query);
  sendSuccess(res, 200, 'Branches retrieved successfully', result.branches, result.meta);
});

// ৩. একটি নির্দিষ্ট ব্রাঞ্চের বিস্তারিত (GET /api/branches/:id)
export const getBranchById = asyncHandler(async (req: Request, res: Response) => {
  const branchId = req.params.id as string;
  const branch = await BranchService.getBranchById(branchId);
  sendSuccess(res, 200, 'Branch details retrieved successfully', branch);
});

// ৪. ব্রাঞ্চ আপডেট (PATCH /api/branches/:id)
export const updateBranch = asyncHandler(async (req: Request, res: Response) => {
  const branchId = req.params.id as string;
  const userId = req.user!.userId;
  const branch = await BranchService.updateBranch(branchId, req.body, userId);
  sendSuccess(res, 200, 'Branch updated successfully', branch);
});

// ৫. ব্রাঞ্চ স্ট্যাটাস টগল (PATCH /api/branches/:id/toggle-status)
export const toggleBranchStatus = asyncHandler(async (req: Request, res: Response) => {
  const branchId = req.params.id as string;
  const userId = req.user!.userId;
  const branch = await BranchService.toggleBranchStatus(branchId, userId);
  const statusMessage = branch.isActive ? 'Branch activated successfully' : 'Branch deactivated successfully';
  sendSuccess(res, 200, statusMessage, branch);
});

// ৬. ব্রাঞ্চ ডিলিট (DELETE /api/branches/:id)
export const deleteBranch = asyncHandler(async (req: Request, res: Response) => {
  const branchId = req.params.id as string;
  const userId = req.user!.userId;
  const result = await BranchService.deleteBranch(branchId, userId);
  sendSuccess(res, 200, `Branch '${result.name}' deleted successfully`, result);
});
