import { z } from 'zod';
import type { KhataStatus, PaymentStatus } from '../../../generated/prisma/client.js';
import { BANGLADESH_DISTRICTS } from '../../constants/districts.js';

/**
 * Zod ভ্যালিডেশন স্কিমাস
 */

// নতুন লেখক (Writer) তৈরির ভ্যালিডেশন স্কিমা
export const createWriterSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Writer name must be at least 2 characters')
    .max(100, 'Writer name cannot exceed 100 characters'),
  phone: z
    .string()
    .trim()
    .regex(/^(?:\+?880|0)?1[3-9]\d{8}$/, 'Please provide a valid Bangladeshi phone number (e.g. 01711223344)'),
  email: z
    .string()
    .trim()
    .email('Please provide a valid email address')
    .optional()
    .or(z.literal('')),
  district: z.enum(BANGLADESH_DISTRICTS, {
    message: 'Invalid district. Please provide a valid district in Bangladesh.',
  }).default('Dhaka'),
  branchId: z.string().uuid('Invalid branch ID format (must be UUID)'),
  ratePerKhata: z.coerce
    .number()
    .positive('Rate per khata must be greater than 0'),
});

// লেখক তথ্য আপডেটের ভ্যালিডেশন স্কিমা
export const updateWriterSchema = z
  .object({
    name: z.string().trim().min(2, 'Writer name must be at least 2 characters').max(100).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^(?:\+?880|0)?1[3-9]\d{8}$/, 'Please provide a valid Bangladeshi phone number')
      .optional(),
    email: z
      .string()
      .trim()
      .email('Please provide a valid email address')
      .optional()
      .or(z.literal('')),
    district: z.enum(BANGLADESH_DISTRICTS, {
      message: 'Invalid district. Please provide a valid district in Bangladesh.',
    }).optional(),
    branchId: z.string().uuid('Invalid branch ID format (must be UUID)').optional(),
    ratePerKhata: z.coerce
      .number()
      .positive('Rate per khata must be greater than 0')
      .optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  });

// লেখক তালিকা ফিল্টারিং ও পেজিনেশন স্কিমা
export const writerQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10) || 1) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10) || 10)) : 10)),
  search: z.string().trim().optional(),
  branchId: z.string().uuid('Invalid branch ID format').optional(),
  district: z.enum(BANGLADESH_DISTRICTS).optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    }),
});

// পাথ প্যারামিটার (UUID) ভ্যালিডেশন স্কিমা
export const writerIdParamSchema = z.object({
  id: z.string().uuid('Invalid writer ID format (must be UUID)'),
});

// খাতা হিস্টোরি ফিল্টারিং স্কিমা
export const khataHistoryQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10) || 1) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10) || 10)) : 10)),
  status: z.enum(['DISTRIBUTED', 'PARTIALLY_SUBMITTED', 'COMPLETED'] as const).optional(),
});

// পেমেন্ট হিস্টোরি ফিল্টারিং স্কিমা
export const paymentHistoryQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10) || 1) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10) || 10)) : 10)),
  status: z.enum(['PAID', 'PARTIAL', 'DUE'] as const).optional(),
});

/**
 * TypeScript DTOs
 */
export type CreateWriterDto = z.infer<typeof createWriterSchema>;
export type UpdateWriterDto = z.infer<typeof updateWriterSchema>;
export type WriterQueryDto = {
  page: number;
  limit: number;
  search?: string;
  branchId?: string;
  district?: string;
  isActive?: boolean;
};

export type KhataHistoryQueryDto = {
  page: number;
  limit: number;
  status?: KhataStatus;
};

export type PaymentHistoryQueryDto = {
  page: number;
  limit: number;
  status?: PaymentStatus;
};

/**
 * লেখকের বিস্তারিত ও এগ্রিগেশন সামারি রেসপন্স টাইপ
 */
export interface WriterKhataSummary {
  totalKhatas: number;
  totalReceivedQty: number;
  totalSubmittedQty: number;
  totalPendingQty: number;
  byStatus: {
    distributed: number;
    partiallySubmitted: number;
    completed: number;
  };
}

export interface WriterPaymentSummary {
  totalBillAmount: number;
  totalPaidAmount: number;
  totalDueAmount: number;
  byStatus: {
    paid: number;
    partial: number;
    due: number;
  };
}

export interface WriterDetails {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  district: string;
  ratePerKhata: number;
  isActive: boolean;
  branch: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    isActive: boolean;
  };
  khataSummary: WriterKhataSummary;
  paymentSummary: WriterPaymentSummary;
  createdAt: Date;
  updatedAt: Date;
}
