import type { Request, Response } from 'express';
import { KhataService } from './khata.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import type { KhataQueryDto } from './khata.types.js';

/**
 * খাতা (Khata) কন্ট্রোলার হ্যান্ডলারস
 */

// ১. নতুন খাতা তৈরি (POST /api/khatas)
export const createKhata = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const khata = await KhataService.createKhata(req.body, userId);
  sendSuccess(res, 201, 'Khata batch created and distributed successfully', khata);
});

// ২. সব খাতার তালিকা ফিল্টারিং ও পেজিনেশন সহ (GET /api/khatas)
export const getAllKhatas = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as KhataQueryDto;
  const result = await KhataService.getAllKhatas(query);
  sendSuccess(res, 200, 'Khatas retrieved successfully', result.khatas, result.meta);
});

// ৩. একটি খাতার বিস্তারিত তথ্য (GET /api/khatas/:id)
export const getKhataById = asyncHandler(async (req: Request, res: Response) => {
  const khataId = req.params.id as string;
  const khata = await KhataService.getKhataById(khataId);
  sendSuccess(res, 200, 'Khata details retrieved successfully', khata);
});

// ৪. খাতা জমা দেওয়ার মূল বিজনেস রুট (PATCH /api/khatas/:id/submit)
export const submitKhata = asyncHandler(async (req: Request, res: Response) => {
  const khataId = req.params.id as string;
  const userId = req.user!.userId;
  const khata = await KhataService.submitKhata(khataId, req.body, userId);

  const message =
    khata.status === 'COMPLETED'
      ? `Khata '${khata.batchNumber}' submission completed successfully (All ${khata.receivedQty} submitted)`
      : `Submission recorded for '${khata.batchNumber}'. ${khata.pendingQty} khata(s) remaining pending`;

  sendSuccess(res, 200, message, khata);
});

// ৫. খাতা তথ্য আপডেট (PATCH /api/khatas/:id)
export const updateKhata = asyncHandler(async (req: Request, res: Response) => {
  const khataId = req.params.id as string;
  const userId = req.user!.userId;
  const khata = await KhataService.updateKhata(khataId, req.body, userId);
  sendSuccess(res, 200, 'Khata updated successfully', khata);
});

// ৬. খাতা ডিলিট (DELETE /api/khatas/:id)
export const deleteKhata = asyncHandler(async (req: Request, res: Response) => {
  const khataId = req.params.id as string;
  const userId = req.user!.userId;
  const result = await KhataService.deleteKhata(khataId, userId);
  sendSuccess(res, 200, `Khata batch '${result.batchNumber}' deleted successfully`, result);
});

// ৭. নির্দিষ্ট ব্রাঞ্চের খাতা সামারি (GET /api/khatas/branch/:branchId/summary)
export const getBranchKhataSummary = asyncHandler(async (req: Request, res: Response) => {
  const branchId = req.params.branchId as string;
  const summary = await KhataService.getBranchKhataSummary(branchId);
  sendSuccess(res, 200, `Khata summary for branch '${summary.branchName}' retrieved successfully`, summary);
});
