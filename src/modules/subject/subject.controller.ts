import type { Request, Response } from 'express';
import { SubjectService } from './subject.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import type { SubjectQueryDto } from './subject.types.js';

/**
 * বিষয় (Subject) কন্ট্রোলার
 */

// ১. নতুন বিষয় তৈরি (POST /api/subjects)
export const createSubject = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const created = await SubjectService.createSubject(req.body, userId);
  sendSuccess(res, 201, 'Subject created successfully', created);
});

// ২. সব বিষয়ের তালিকা (GET /api/subjects)
export const getAllSubjects = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as SubjectQueryDto;
  const result = await SubjectService.getAllSubjects(query);
  sendSuccess(res, 200, 'Subjects retrieved successfully', result.subjects, result.meta);
});

// ৩. একটি নির্দিষ্ট বিষয়ের বিবরণ (GET /api/subjects/:id)
export const getSubjectById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const subject = await SubjectService.getSubjectById(id as string);
  sendSuccess(res, 200, 'Subject details retrieved successfully', subject);
});

// ৪. বিষয় আপডেট করা (PATCH /api/subjects/:id)
export const updateSubject = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const updated = await SubjectService.updateSubject(id as string, req.body, userId);
  sendSuccess(res, 200, 'Subject updated successfully', updated);
});

// ৫. বিষয়ের স্ট্যাটাস টগল (PATCH /api/subjects/:id/toggle-status)
export const toggleSubjectStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const updated = await SubjectService.toggleSubjectStatus(id as string, userId);
  sendSuccess(
    res,
    200,
    `Subject '${updated.name}' is now ${updated.isActive ? 'active' : 'inactive'}`,
    updated
  );
});

// ৬. বিষয় মুছে ফেলা (DELETE /api/subjects/:id)
export const deleteSubject = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const result = await SubjectService.deleteSubject(id as string, userId);
  sendSuccess(res, 200, result.message, null);
});
