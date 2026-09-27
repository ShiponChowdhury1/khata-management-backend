import type { Request, Response } from 'express';
import { WriterService } from './writer.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import type {
  WriterQueryDto,
  KhataHistoryQueryDto,
  PaymentHistoryQueryDto,
} from './writer.types.js';

/**
 * লেখক (Writer) কন্ট্রোলার হ্যান্ডলারস
 */

// ১. নতুন লেখক তৈরি (POST /api/writers)
export const createWriter = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const writer = await WriterService.createWriter(req.body, userId);
  sendSuccess(res, 201, 'Writer created successfully', writer);
});

// ২. সব লেখকের তালিকা — ফিল্টারিং ও পেজিনেশন সহ (GET /api/writers)
export const getAllWriters = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as WriterQueryDto;
  const result = await WriterService.getAllWriters(query);
  sendSuccess(res, 200, 'Writers retrieved successfully', result.writers, result.meta);
});

// ৩. একজন লেখকের বিস্তারিত পরিসংখ্যান ও প্রোফাইল (GET /api/writers/:id)
export const getWriterById = asyncHandler(async (req: Request, res: Response) => {
  const writerId = req.params.id as string;
  const writer = await WriterService.getWriterById(writerId);
  sendSuccess(res, 200, 'Writer details retrieved successfully', writer);
});

// ৪. লেখক তথ্য আপডেট (PATCH /api/writers/:id)
export const updateWriter = asyncHandler(async (req: Request, res: Response) => {
  const writerId = req.params.id as string;
  const userId = req.user!.userId;
  const writer = await WriterService.updateWriter(writerId, req.body, userId);
  sendSuccess(res, 200, 'Writer updated successfully', writer);
});

// ৫. লেখক স্ট্যাটাস টগল (PATCH /api/writers/:id/toggle-status)
export const toggleWriterStatus = asyncHandler(async (req: Request, res: Response) => {
  const writerId = req.params.id as string;
  const userId = req.user!.userId;
  const writer = await WriterService.toggleWriterStatus(writerId, userId);
  const statusMessage = writer.isActive
    ? 'Writer activated successfully'
    : 'Writer deactivated successfully';
  sendSuccess(res, 200, statusMessage, writer);
});

// ৬. লেখক ডিলিট (DELETE /api/writers/:id)
export const deleteWriter = asyncHandler(async (req: Request, res: Response) => {
  const writerId = req.params.id as string;
  const userId = req.user!.userId;
  const result = await WriterService.deleteWriter(writerId, userId);
  sendSuccess(res, 200, `Writer '${result.name}' deleted successfully`, result);
});

// ৭. লেখকের খাতা হিস্টোরি (GET /api/writers/:id/khata-history)
export const getWriterKhataHistory = asyncHandler(async (req: Request, res: Response) => {
  const writerId = req.params.id as string;
  const query = req.query as unknown as KhataHistoryQueryDto;
  const result = await WriterService.getWriterKhataHistory(writerId, query);
  sendSuccess(
    res,
    200,
    `Khata history for '${result.writer.name}' retrieved successfully`,
    result.khatas,
    result.meta
  );
});

// ৮. লেখকের পেমেন্ট হিস্টোরি (GET /api/writers/:id/payment-history)
export const getWriterPaymentHistory = asyncHandler(async (req: Request, res: Response) => {
  const writerId = req.params.id as string;
  const query = req.query as unknown as PaymentHistoryQueryDto;
  const result = await WriterService.getWriterPaymentHistory(writerId, query);
  sendSuccess(
    res,
    200,
    `Payment history for '${result.writer.name}' retrieved successfully`,
    result.payments,
    result.meta
  );
});
