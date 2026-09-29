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

// ১০. অর্ডার রিপোর্ট কুয়েরি স্কিমা
export const orderReportQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  status: z
    .enum([
      'PENDING',
      'CONFIRMED',
      'ASSIGNED',
      'IN_PROGRESS',
      'WRITING',
      'READY',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED',
    ] as const)
    .optional(),
  branchId: z.string().uuid('Invalid branch ID format').optional(),
  district: z.string().trim().optional(),
  fromDate: dateValidator,
  toDate: dateValidator,
});

// ১১. প্রফিট সামারি রিপোর্ট কুয়েরি স্কিমা
export const profitSummaryQuerySchema = z.object({
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
export type OrderReportQueryDto = z.infer<typeof orderReportQuerySchema>;
export type ProfitSummaryQueryDto = z.infer<typeof profitSummaryQuerySchema>;

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
    totalPaymentAmount: string;
    totalPaidAmount: string;
    totalDueAmount: string;
  };
  stocks: {
    currentTotalStock: number;
  };
  orders: {
    totalOrders: number;
    ordersByStatus: Record<string, number>;
    pendingDeliveries: number;
    totalOrderRevenue: string;
    codCollected: string;
    codPending: string;
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
  totalPayment: string;
  totalPaid: string;
  totalDue: string;
  currentStock: number;
}

/**
 * ৩. লেখকভিত্তিক পারফরম্যান্স রিপোর্ট আইটেম ইন্টারফেস
 */
export interface WriterWiseReportItem {
  writerId: string;
  writerName: string;
  phone: string;
  ratePerKhata: string;
  isActive: boolean;
  branch: {
    id: string;
    name: string;
  };
  totalBatches: number;
  totalReceivedQty: number;
  totalSubmittedQty: number;
  totalPendingQty: number;
  totalEarned: string;
  totalPaid: string;
  totalDue: string;
}

/**
 * ৮. বকেয়া লেখক আইটেম ইন্টারফেস
 */
export interface WriterDueReportItem {
  writerId: string;
  writerName: string;
  phone: string;
  branchName: string;
  ratePerKhata: string;
  unpaidPaymentsCount: number;
  totalBilled: string;
  totalPaid: string;
  totalDue: string;
  payments: Array<{
    id: string;
    amount: string;
    paidAmount: string;
    dueAmount: string;
    status: PaymentStatus;
    paymentDate: Date;
  }>;
}

/**
 * ১০. অর্ডার রিপোর্ট রেসপন্স ইন্টারফেস
 */
export interface OrderReportResponse {
  summary: {
    totalOrders: number;
    totalRevenue: string;
    collectedRevenue: string;
    pendingRevenue: string;
    cancelledOrdersCount: number;
  };
  orders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    preferredDistrict: string | null;
    subjectName: string;
    className: string;
    quantity: number;
    unitPrice: string;
    totalAmount: string;
    status: string;
    paymentStatus: string;
    orderDate: Date;
    deliveredAt: Date | null;
    assignmentsCount: number;
  }>;
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * ১১. প্রফিট সামারি রিপোর্ট রেসপন্স ইন্টারফেস
 */
export interface ProfitSummaryResponse {
  dateRange: {
    fromDate: string | null;
    toDate: string | null;
  };
  deliveredOrdersCount: number;
  totalRevenue: string;
  totalWriterRemuneration: string;
  netProfit: string;
  profitMarginPercentage: string;
  deliveredOrders: Array<{
    orderId: string;
    orderNumber: string;
    customerName: string;
    deliveredAt: Date | null;
    orderRevenue: string;
    writerCost: string;
    orderProfit: string;
  }>;
}
