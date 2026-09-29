import type { Request, Response } from 'express';
import { ClassService } from './class.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import type { ClassQueryDto } from './class.types.js';

/**
 * ক্লাস কন্ট্রোলার — শ্রেণি সংক্রান্ত যাবতীয় API রিকোয়েস্ট হ্যান্ডলিং
 */

// ১. নতুন ক্লাস তৈরি (POST /api/classes)
export const createClass = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const created = await ClassService.createClass(req.body, userId);
  sendSuccess(res, 201, 'Academic class created successfully', created);
});

// ২. সব ক্লাসের তালিকা (GET /api/classes)
export const getAllClasses = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ClassQueryDto;
  const result = await ClassService.getAllClasses(query);
  sendSuccess(res, 200, 'Academic classes retrieved successfully', result.classes, result.meta);
});

// ৩. একটি নির্দিষ্ট ক্লাসের বিবরণ (GET /api/classes/:id)
export const getClassById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const academicClass = await ClassService.getClassById(id as string);
  sendSuccess(res, 200, 'Academic class details retrieved successfully', academicClass);
});

// ৪. ক্লাস আপডেট করা (PATCH /api/classes/:id)
export const updateClass = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const updated = await ClassService.updateClass(id as string, req.body, userId);
  sendSuccess(res, 200, 'Academic class updated successfully', updated);
});

// ৫. ক্লাসের স্ট্যাটাস টগল (PATCH /api/classes/:id/toggle-status)
export const toggleClassStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const updated = await ClassService.toggleClassStatus(id as string, userId);
  sendSuccess(
    res,
    200,
    `Class '${updated.name}' is now ${updated.isActive ? 'active' : 'inactive'}`,
    updated
  );
});

// ৬. ক্লাস মুছে ফেলা (DELETE /api/classes/:id)
export const deleteClass = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const result = await ClassService.deleteClass(id as string, userId);
  sendSuccess(res, 200, result.message, null);
});
