import type { Request, Response } from 'express';
import { PaymentService } from './payment.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import type { PaymentQueryDto } from './payment.types.js';

/**
 * পেমেন্ট (Payment) কন্ট্রোলার — রিকোয়েস্ট হ্যান্ডলিং ও রেসপন্স ডিসপ্যাচ
 */

// ১. বকেয়া হিসাব (POST /api/payments/calculate-due)
export const calculateDue = asyncHandler(async (req: Request, res: Response) => {
  const { writerId } = req.body;
  const result = await PaymentService.calculateDue(writerId);
  sendSuccess(res, 200, 'Due calculation generated successfully', result);
});

// ২. নতুন পেমেন্ট তৈরি (POST /api/payments)
export const createPayment = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const payment = await PaymentService.createPayment(req.body, userId);
  sendSuccess(res, 201, 'Payment recorded successfully', payment);
});

// ৩. সব পেমেন্টের তালিকা (GET /api/payments)
export const getAllPayments = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as PaymentQueryDto;
  const result = await PaymentService.getAllPayments(query);
  sendSuccess(res, 200, 'Payments retrieved successfully', result.payments, result.meta);
});

// ৪. নির্দিষ্ট পেমেন্টের বিস্তারিত (GET /api/payments/:id)
export const getPaymentById = asyncHandler(async (req: Request, res: Response) => {
  const paymentId = req.params.id as string;
  const payment = await PaymentService.getPaymentById(paymentId);
  sendSuccess(res, 200, 'Payment details retrieved successfully', payment);
});

// ৫. কিস্তিতে বকেয়া পরিশোধ (PATCH /api/payments/:id/add-payment)
export const addPayment = asyncHandler(async (req: Request, res: Response) => {
  const paymentId = req.params.id as string;
  const userId = req.user!.userId;
  const payment = await PaymentService.addPayment(paymentId, req.body, userId);
  sendSuccess(res, 200, 'Payment installment updated successfully', payment);
});

// ৬. লেখকের সম্পূর্ণ পেমেন্ট সামারি (GET /api/payments/writer/:writerId/summary)
export const getWriterPaymentSummary = asyncHandler(async (req: Request, res: Response) => {
  const writerId = req.params.writerId as string;
  const summary = await PaymentService.getWriterPaymentSummary(writerId);
  sendSuccess(res, 200, 'Writer payment summary retrieved successfully', summary);
});
