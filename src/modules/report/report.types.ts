import { z } from 'zod';
import type { KhataStatus, PaymentStatus, StockMovementType } from '../../../generated/prisma/client.js';

/**
 * রিপোর্ট (Report) মডিউল — Zod ভ্যালিডেশন স্কিমাস ও টাইপ ডেফিনিশনস
 */

const dateValidator = z
  .string()
  .optional()
  .refine((val) => !val || !isNaN(Date.parse(val)), {
    message: 'Invalid date format (must be a valid ISO/date string)',
  });

// ১. সাধারণ তারিখ রেঞ্জ কুয়েরি স্কিমা
export const dateRangeQuerySchema = z.object({
  fromDate: dateValidator,
  toDate: dateValidator,
});

// ২. ব্রাঞ্চভিত্তিক রিপোর্ট কুয়েরি স্কিমা
export const branchWiseReportQuerySchema = z.object({
  fromDate: dateValidator,
  toDate: dateValidator,
});

// ৩. লেখকভিত্তিক পারফরম্যান্স রিপোর্ট কুয়েরি স্কিমা
export const writerWiseReportQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  branchId: z.string().uuid('Invalid branch ID format').optional(),
  search: z.string().trim().optional(),
  fromDate: dateValidator,
  toDate: dateValidator,
});

// ৪. খাতা বিতরণ রিপোর্ট কুয়েরি স্কিমা
export const khataDistributionReportQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  branchId: z.string().uuid('Invalid branch ID format').optional(),
  writerId: z.string().uuid('Invalid writer ID format').optional(),
  fromDate: dateValidator,
  toDate: dateValidator,
});

// ৫. খাতা জমা রিপোর্ট কুয়েরি স্কিমা
export const khataSubmissionReportQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  branchId: z.string().uuid('Invalid branch ID format').optional(),
  writerId: z.string().uuid('Invalid writer ID format').optional(),
  status: z.enum(['PARTIALLY_SUBMITTED', 'COMPLETED'] as const).optional(),
  fromDate: dateValidator,
  toDate: dateValidator,
});

// ৬. পেন্ডিং খাতা রিপোর্ট কুয়েরি স্কিমা
export const pendingKhataReportQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  branchId: z.string().uuid('Invalid branch ID format').optional(),
  writerId: z.string().uuid('Invalid writer ID format').optional(),
});

// ৭. পেমেন্ট রিপোর্ট কুয়েরি স্কিমা
export const paymentReportQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  writerId: z.string().uuid('Invalid writer ID format').optional(),
  status: z.enum(['PAID', 'PARTIAL', 'DUE'] as const).optional(),
  fromDate: dateValidator,
  toDate: dateValidator,
});

// ৮. বকেয়া (Due) রিপোর্ট কুয়েরি স্কিমা
export const dueReportQuerySchema = z.object({
  branchId: z.string().uuid('Invalid branch ID format').optional(),
});

// ৯. স্টক রিপোর্ট কুয়েরি স্কিমা
export const stockReportQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  branchId: z.string().uuid('Invalid branch ID format').optional(),
  type: z.enum(['RECEIVED', 'DISTRIBUTED', 'RETURNED'] as const).optional(),
  fromDate: dateValidator,
  toDate: dateValidator,
});

/**
 * TypeScript DTOs
 */
export type DateRangeQueryDto = z.infer<typeof dateRangeQuerySchema>;
export type BranchWiseReportQueryDto = z.infer<typeof branchWiseReportQuerySchema>;
export type WriterWiseReportQueryDto = z.infer<typeof writerWiseReportQuerySchema>;
export type KhataDistributionReportQueryDto = z.infer<typeof khataDistributionReportQuerySchema>;
export type KhataSubmissionReportQueryDto = z.infer<typeof khataSubmissionReportQuerySchema>;
export type PendingKhataReportQueryDto = z.infer<typeof pendingKhataReportQuerySchema>;
export type PaymentReportQueryDto = z.infer<typeof paymentReportQuerySchema>;
export type DueReportQueryDto = z.infer<typeof dueReportQuerySchema>;
export type StockReportQueryDto = z.infer<typeof stockReportQuerySchema>;

/**
 * ১. ড্যাশবোর্ড ওভারভিউ সামারি ইন্টারফেস
 */
export interface DashboardSummaryResponse {
  branches: {
    total: number;
    active: number;
  };
  writers: {
    total: number;
    active: number;
  };
  khatas: {
    totalBatches: number;
    totalDistributedQty: number;
    totalSubmittedQty: number;
    totalPendingQty: number;
  };
  financials: {
    totalPaymentAmount: number;
    totalPaidAmount: number;
    totalDueAmount: number;
  };
  stocks: {
    currentTotalStock: number;
  };
}

/**
 * ২. ব্রাঞ্চভিত্তিক রিপোর্ট আইটেম ইন্টারফেস
 */
export interface BranchWiseReportItem {
  branchId: string;
  branchName: string;
  phone: string | null;
  isActive: boolean;
  writersCount: number;
  totalBatches: number;
  totalReceivedQty: number;
  totalSubmittedQty: number;
  totalPendingQty: number;
  totalPayment: number;
  totalPaid: number;
  totalDue: number;
  currentStock: number;
}

/**
 * ৩. লেখকভিত্তিক পারফরম্যান্স রিপোর্ট আইটেম ইন্টারফেস
 */
export interface WriterWiseReportItem {
  writerId: string;
  writerName: string;
  phone: string;
  ratePerKhata: number;
  isActive: boolean;
  branch: {
    id: string;
    name: string;
  };
  totalBatches: number;
  totalReceivedQty: number;
  totalSubmittedQty: number;
  totalPendingQty: number;
  totalEarned: number;
  totalPaid: number;
  totalDue: number;
}

/**
 * ৮. বকেয়া লেখক আইটেম ইন্টারফেস
 */
export interface WriterDueReportItem {
  writerId: string;
  writerName: string;
  phone: string;
  branchName: string;
  ratePerKhata: number;
  unpaidPaymentsCount: number;
  totalBilled: number;
  totalPaid: number;
  totalDue: number;
  payments: Array<{
    id: string;
    amount: number;
    paidAmount: number;
    dueAmount: number;
    status: PaymentStatus;
    paymentDate: Date;
  }>;
}
