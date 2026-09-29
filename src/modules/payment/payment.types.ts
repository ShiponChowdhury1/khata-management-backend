import { z } from 'zod';
import type { PaymentStatus } from '../../../generated/prisma/client.js';
import { positiveMoneySchema, nonNegativeMoneySchema } from '../../utils/money.js';
import { Decimal } from '../../lib/prisma.js';

/**
 * পেমেন্ট (Payment) মডিউল — Zod ভ্যালিডেশন স্কিমাস ও টাইপ ডেফিনিশনস
 */

// ১. বকেয়া হিসাব (Calculate Due) স্কিমা
export const calculateDueSchema = z.object({
  writerId: z.string().uuid('Invalid writer ID format (must be UUID)'),
});

// ২. একটি নির্দিষ্ট খাতার জন্য পেমেন্ট বণ্টন (Khata Allocation) স্কিমা
export const khataAllocationSchema = z.object({
  khataId: z.string().uuid('Invalid khata ID format (must be UUID)'),
  amount: positiveMoneySchema('Allocated amount must be positive with at most 2 decimal places'),
  note: z.string().trim().max(255).optional(),
});

// ৩. নতুন পেমেন্ট রেকর্ড করার ভ্যালিডেশন স্কিমা
export const createPaymentSchema = z
  .object({
    writerId: z.string().uuid('Invalid writer ID format (must be UUID)'),
    khataId: z.string().uuid('Invalid khata ID format (must be UUID)').optional().nullable(),
    amount: positiveMoneySchema('Payment amount must be positive with at most 2 decimal places'),
    paidAmount: nonNegativeMoneySchema('Paid amount cannot be negative and must have at most 2 decimal places').default(
      new Decimal('0.00')
    ),
    paymentDate: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'Invalid paymentDate format (must be valid date string)',
      }),
    khataAllocations: z.array(khataAllocationSchema).optional().default([]),
  })
  .refine((data) => data.paidAmount.lte(data.amount), {
    message: 'Paid amount cannot be greater than total amount',
    path: ['paidAmount'],
  });

// ৪. কিস্তি বা বকেয়া পরিশোধ (Add Payment) স্কিমা
export const addPaymentSchema = z.object({
  additionalPaidAmount: positiveMoneySchema(
    'Additional paid amount must be positive with at most 2 decimal places'
  ),
});

// ৫. পেমেন্ট তালিকা ফিল্টারিং ও পেজিনেশন কোয়েরি স্কিমা
export const paymentQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  writerId: z.string().uuid('Invalid writer ID format').optional(),
  status: z.enum(['PAID', 'PARTIAL', 'DUE'] as const).optional(),
  fromDate: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid fromDate format',
    }),
  toDate: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid toDate format',
    }),
});

// ৬. পেমেন্ট আইডি পাথ প্যারামিটার স্কিমা
export const paymentIdParamSchema = z.object({
  id: z.string().uuid('Invalid payment ID format (must be UUID)'),
});

// ৭. লেখক আইডি পাথ প্যারামিটার স্কিমা
export const writerIdParamSchema = z.object({
  writerId: z.string().uuid('Invalid writer ID format (must be UUID)'),
});

/**
 * TypeScript DTOs
 */
export type CalculateDueDto = z.infer<typeof calculateDueSchema>;
export type KhataAllocationDto = z.infer<typeof khataAllocationSchema>;
export type CreatePaymentDto = z.infer<typeof createPaymentSchema>;
export type AddPaymentDto = z.infer<typeof addPaymentSchema>;

export type PaymentQueryDto = {
  page: number;
  limit: number;
  writerId?: string;
  status?: PaymentStatus;
  fromDate?: string;
  toDate?: string;
};

/**
 * আনপেইড/বকেয়া খাতার আইটেম রেসপন্স ইন্টারফেস (Decimal মানসমূহ string হিসেবে উপস্থাপিত)
 */
export interface UnpaidKhataItem {
  khataId: string;
  batchNumber: string;
  submittedQty: number;
  ratePerKhata: string;
  earnedAmount: string;
  allocatedPaid: string;
  dueAmount: string;
}

/**
 * বকেয়া ক্যালকুলেশন রেসপন্স ইন্টারফেস (Decimal মানসমূহ string হিসেবে উপস্থাপিত)
 */
export interface CalculateDueResponse {
  writerId: string;
  writerName: string;
  ratePerKhata: string;
  completedKhatasCount: number;
  totalSubmittedQty: number;
  totalEarned: string;
  totalAlreadyPaid: string;
  netDue: string;
  unpaidKhatas: UnpaidKhataItem[];
}

/**
 * লেখকের সম্পূর্ণ পেমেন্ট সামারি রেসপন্স ইন্টারফেস
 */
export interface WriterPaymentSummaryResponse {
  writer: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    branch: {
      id: string;
      name: string;
    };
    ratePerKhata: string;
  };
  khataMetrics: {
    completedKhatasCount: number;
    totalSubmittedQty: number;
  };
  financialMetrics: {
    totalEarned: string;
    totalBilled: string;
    totalPaid: string;
    totalDue: string;
  };
  paymentCounts: {
    total: number;
    paid: number;
    partial: number;
    due: number;
  };
  recentPayments: Array<{
    id: string;
    amount: string;
    paidAmount: string;
    dueAmount: string;
    status: PaymentStatus;
    paymentDate: Date;
  }>;
}
