import type { Request, Response } from 'express';
import { ReportService } from './report.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import type {
  BranchWiseReportQueryDto,
  WriterWiseReportQueryDto,
  KhataDistributionReportQueryDto,
  KhataSubmissionReportQueryDto,
  PendingKhataReportQueryDto,
  PaymentReportQueryDto,
  DueReportQueryDto,
  StockReportQueryDto,
} from './report.types.js';

/**
 * রিপোর্ট (Report) কন্ট্রোলার — বিভিন্ন ড্যাশবোর্ড ও অ্যানালিটিক্স রিকোয়েস্ট হ্যান্ডলিং
 */

// ১. মেইন ড্যাশবোর্ড ওভারভিউ সামারি (GET /api/reports/dashboard-summary)
export const getDashboardSummary = asyncHandler(async (_req: Request, res: Response) => {
  const summary = await ReportService.getDashboardSummary();
  sendSuccess(res, 200, 'Dashboard summary retrieved successfully', summary);
});

// ২. ব্রাঞ্চভিত্তিক তুলনামূলক রিপোর্ট (GET /api/reports/branch-wise)
export const getBranchWiseReport = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as BranchWiseReportQueryDto;
  const report = await ReportService.getBranchWiseReport(query);
  sendSuccess(res, 200, 'Branch-wise comparative report retrieved successfully', report);
});

// ৩. লেখকভিত্তিক পারফরম্যান্স রিপোর্ট (GET /api/reports/writer-wise)
export const getWriterWiseReport = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as WriterWiseReportQueryDto;
  const result = await ReportService.getWriterWiseReport(query);
  sendSuccess(res, 200, 'Writer performance report retrieved successfully', result.report, result.meta);
});

// ৪. খাতা বিতরণ রিপোর্ট (GET /api/reports/khata-distribution)
export const getKhataDistributionReport = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as KhataDistributionReportQueryDto;
  const result = await ReportService.getKhataDistributionReport(query);
  sendSuccess(res, 200, 'Khata distribution report retrieved successfully', {
    summary: result.summary,
    khatas: result.khatas,
  }, result.meta);
});

// ৫. খাতা জমা রিপোর্ট (GET /api/reports/khata-submission)
export const getKhataSubmissionReport = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as KhataSubmissionReportQueryDto;
  const result = await ReportService.getKhataSubmissionReport(query);
  sendSuccess(res, 200, 'Khata submission report retrieved successfully', {
    summary: result.summary,
    khatas: result.khatas,
  }, result.meta);
});

// ৬. পেন্ডিং খাতা রিপোর্ট (GET /api/reports/pending-khata)
export const getPendingKhataReport = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as PendingKhataReportQueryDto;
  const result = await ReportService.getPendingKhataReport(query);
  sendSuccess(res, 200, 'Pending khata report retrieved successfully', {
    summary: result.summary,
    khatas: result.khatas,
  }, result.meta);
});

// ৭. পেমেন্ট রিপোর্ট (GET /api/reports/payment-report)
export const getPaymentReport = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as PaymentReportQueryDto;
  const result = await ReportService.getPaymentReport(query);
  sendSuccess(res, 200, 'Payment report retrieved successfully', {
    summary: result.summary,
    payments: result.payments,
  }, result.meta);
});

// ৮. বকেয়া (Due) রিপোর্ট (GET /api/reports/due-report)
export const getDueReport = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as DueReportQueryDto;
  const result = await ReportService.getDueReport(query);
  sendSuccess(res, 200, 'Outstanding due report retrieved successfully', result);
});

// ৯. স্টক রিপোর্ট (GET /api/reports/stock-report)
export const getStockReport = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as StockReportQueryDto;
  const result = await ReportService.getStockReport(query);
  sendSuccess(res, 200, 'Stock movement and snapshot report retrieved successfully', {
    summary: result.summary,
    branchSnapshots: result.branchSnapshots,
    movements: result.movements,
  }, result.meta);
});
