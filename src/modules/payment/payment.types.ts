import { z } from 'zod';
import type { PaymentStatus } from '../../../generated/prisma/client.js';

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
  amount: z.coerce.number().positive('Allocated amount must be greater than 0'),
  note: z.string().trim().max(255).optional(),
});

// ৩. নতুন পেমেন্ট রেকর্ড করার ভ্যালিডেশন স্কিমা
export const createPaymentSchema = z
  .object({
    writerId: z.string().uuid('Invalid writer ID format (must be UUID)'),
    khataId: z.string().uuid('Invalid khata ID format (must be UUID)').optional().nullable(),
    amount: z.coerce.number().positive('Payment amount must be greater than 0'),
    paidAmount: z.coerce.number().nonnegative('Paid amount cannot be negative').default(0),
    paymentDate: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'Invalid paymentDate format (must be valid date string)',
      }),
    khataAllocations: z.array(khataAllocationSchema).optional().default([]),
  })
  .refine((data) => data.paidAmount <= data.amount, {
    message: 'Paid amount cannot be greater than total amount',
    path: ['paidAmount'],
  });

// ৪. কিস্তি বা বকেয়া পরিশোধ (Add Payment) স্কিমা
export const addPaymentSchema = z.object({
  additionalPaidAmount: z.coerce
    .number()
    .positive('Additional paid amount must be greater than 0'),
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
 * আনপেইড/বকেয়া খাতার আইটেম রেসপন্স ইন্টারফেস
 */
export interface UnpaidKhataItem {
  khataId: string;
  batchNumber: string;
  submittedQty: number;
  ratePerKhata: number;
  earnedAmount: number;
  allocatedPaid: number;
  dueAmount: number;
}

/**
 * বকেয়া ক্যালকুলেশন রেসপন্স ইন্টারফেস
 */
export interface CalculateDueResponse {
  writerId: string;
  writerName: string;
  ratePerKhata: number;
  completedKhatasCount: number;
  totalSubmittedQty: number;
  totalEarned: number;
  totalAlreadyPaid: number;
  netDue: number;
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
    ratePerKhata: number;
  };
  khataMetrics: {
    completedKhatasCount: number;
    totalSubmittedQty: number;
  };
  financialMetrics: {
    totalEarned: number;
    totalBilled: number;
    totalPaid: number;
    totalDue: number;
  };
  paymentCounts: {
    total: number;
    paid: number;
    partial: number;
    due: number;
  };
  recentPayments: Array<{
    id: string;
    amount: number;
    paidAmount: number;
    dueAmount: number;
    status: PaymentStatus;
    paymentDate: Date;
  }>;
}
