import type { Request, Response } from 'express';
import { StockService } from './stock.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import type { StockHistoryQueryDto } from './stock.types.js';

/**
 * স্টক (Stock) কন্ট্রোলার — রিকোয়েস্ট হ্যান্ডলিং ও রেসপন্স ডিসপ্যাচ
 */

// ১. কেন্দ্র থেকে ব্রাঞ্চে খাতা গ্রহণ (POST /api/stocks/receive)
export const receiveStock = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const stock = await StockService.receiveStock(req.body, userId);
  sendSuccess(res, 201, 'Stock received and balance updated successfully', stock);
});

// ২. ব্রাঞ্চ থেকে খাতা বিতরণ (POST /api/stocks/distribute)
export const distributeStock = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const stock = await StockService.distributeStock(req.body, userId);
  sendSuccess(res, 201, 'Stock distributed successfully', stock);
});

// ৩. ফেরত আসা খাতা ইনভেন্টরিতে পুনঃযোগ (POST /api/stocks/return)
export const returnStock = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const stock = await StockService.returnStock(req.body, userId);
  sendSuccess(res, 201, 'Returned stock recorded successfully', stock);
});

// ৪. নির্দিষ্ট ব্রাঞ্চের বর্তমান স্টক স্ট্যাটাস (GET /api/stocks/branch/:branchId)
export const getBranchStockStatus = asyncHandler(async (req: Request, res: Response) => {
  const branchId = req.params.branchId as string;
  const status = await StockService.getBranchStockStatus(branchId);
  sendSuccess(res, 200, 'Branch stock status retrieved successfully', status);
});

// ৫. ব্রাঞ্চের স্টক মুভমেন্ট হিস্টোরি (GET /api/stocks/branch/:branchId/history)
export const getBranchStockHistory = asyncHandler(async (req: Request, res: Response) => {
  const branchId = req.params.branchId as string;
  const query = req.query as unknown as StockHistoryQueryDto;
  const result = await StockService.getBranchStockHistory(branchId, query);
  sendSuccess(res, 200, 'Branch stock history retrieved successfully', result.history, result.meta);
});

// ৬. সামগ্রিক ড্যাশবোর্ড স্টক সামারি (GET /api/stocks/summary)
export const getOverallStockSummary = asyncHandler(async (_req: Request, res: Response) => {
  const summary = await StockService.getOverallStockSummary();
  sendSuccess(res, 200, 'Overall stock summary retrieved successfully', summary);
});
