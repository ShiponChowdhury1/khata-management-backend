import { z } from 'zod';
import type { KhataStatus } from '../../../generated/prisma/client.js';

/**
 * Zod ভ্যালিডেশন স্কিমাস
 */

// ১. নতুন খাতা/ব্যাচ তৈরি স্কিমা
export const createKhataSchema = z.object({
  batchNumber: z
    .string()
    .trim()
    .min(2, 'Batch number must be at least 2 characters')
    .max(100, 'Batch number cannot exceed 100 characters'),
  branchId: z.string().uuid('Invalid branch ID format (must be UUID)'),
  writerId: z.string().uuid('Invalid writer ID format (must be UUID)'),
  receivedQty: z.coerce
    .number()
    .int('Received quantity must be an integer')
    .positive('Received quantity must be greater than 0'),
});

// ২. খাতা জমা দেওয়ার স্কিমা (ইনক্রিমেন্টাল সাবমিশন)
export const submitKhataSchema = z.object({
  submittedQty: z.coerce
    .number()
    .int('Submitted quantity must be an integer')
    .positive('Submitted quantity must be greater than 0'),
});

// ৩. খাতা তথ্য আপডেট স্কিমা (batchNumber বা receivedQty)
export const updateKhataSchema = z
  .object({
    batchNumber: z
      .string()
      .trim()
      .min(2, 'Batch number must be at least 2 characters')
      .max(100)
      .optional(),
    receivedQty: z.coerce
      .number()
      .int('Received quantity must be an integer')
      .positive('Received quantity must be greater than 0')
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field (batchNumber or receivedQty) must be provided to update',
  });

// ৪. খাতা তালিকা কুয়েরি ও ফিল্টারিং স্কিমা
export const khataQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10) || 1) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10) || 10)) : 10)),
  branchId: z.string().uuid('Invalid branch ID format').optional(),
  writerId: z.string().uuid('Invalid writer ID format').optional(),
  status: z.enum(['DISTRIBUTED', 'PARTIALLY_SUBMITTED', 'COMPLETED'] as const).optional(),
  fromDate: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid fromDate format (must be valid date string)',
    }),
  toDate: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid toDate format (must be valid date string)',
    }),
});

// ৫. পাথ প্যারামিটার স্কিমা (Khata ID)
export const khataIdParamSchema = z.object({
  id: z.string().uuid('Invalid khata ID format (must be UUID)'),
});

// ৬. ব্রাঞ্চ পাথ প্যারামিটার স্কিমা
export const branchIdParamSchema = z.object({
  branchId: z.string().uuid('Invalid branch ID format (must be UUID)'),
});

/**
 * TypeScript DTOs
 */
export type CreateKhataDto = z.infer<typeof createKhataSchema>;
export type SubmitKhataDto = z.infer<typeof submitKhataSchema>;
export type UpdateKhataDto = z.infer<typeof updateKhataSchema>;

export type KhataQueryDto = {
  page: number;
  limit: number;
  branchId?: string;
  writerId?: string;
  status?: KhataStatus;
  fromDate?: string;
  toDate?: string;
};

/**
 * ব্রাঞ্চ খাতা সামারি টাইপ
 */
export interface BranchKhataSummary {
  branchId: string;
  branchName: string;
  totalKhatas: number;
  totalReceived: number;
  totalSubmitted: number;
  totalPending: number;
  byStatus: {
    distributed: number;
    partiallySubmitted: number;
    completed: number;
  };
}
