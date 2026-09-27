import { z } from 'zod';
import type { StockMovementType } from '../../../generated/prisma/client.js';

/**
 * স্টক (Stock) মডিউল — Zod ভ্যালিডেশন স্কিমাস ও টাইপ ডেফিনিশনস
 */

// ১. স্টক গ্রহণ, বিতরণ ও ফেরত লেনদেনের স্কিমা
export const stockMovementSchema = z.object({
  branchId: z.string().uuid('Invalid branch ID format (must be UUID)'),
  quantity: z.coerce
    .number()
    .int('Quantity must be an integer')
    .positive('Quantity must be greater than 0'),
  note: z.string().trim().max(255, 'Note cannot exceed 255 characters').optional(),
  recordDate: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid recordDate format (must be a valid date string)',
    }),
});

// ২. স্টক মুভমেন্ট হিস্টোরি কোয়েরি স্কিমা
export const stockHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  type: z.enum(['RECEIVED', 'DISTRIBUTED', 'RETURNED'] as const).optional(),
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

// ৩. ব্রাঞ্চ আইডি পাথ প্যারামিটার স্কিমা
export const branchIdParamSchema = z.object({
  branchId: z.string().uuid('Invalid branch ID format (must be UUID)'),
});

/**
 * TypeScript DTOs
 */
export type StockMovementDto = z.infer<typeof stockMovementSchema>;

export type StockHistoryQueryDto = {
  page: number;
  limit: number;
  type?: StockMovementType;
  fromDate?: string;
  toDate?: string;
};

/**
 * ব্রাঞ্চের বর্তমান স্টক স্ট্যাটাস রেসপন্স ইন্টারফেস
 */
export interface BranchStockStatusResponse {
  branch: {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    isActive: boolean;
  };
  currentQty: number;
  totalReceived: number;
  totalDistributed: number;
  totalReturned: number;
  lastRecordDate: Date | null;
  lastMovementType: StockMovementType | null;
}

/**
 * ব্রাঞ্চভিত্তিক স্টক সামারি ব্রেকডাউন আইটেম
 */
export interface BranchStockBreakdownItem {
  branchId: string;
  branchName: string;
  branchPhone: string | null;
  currentQty: number;
  totalReceived: number;
  totalDistributed: number;
  totalReturned: number;
  lastRecordDate: Date | null;
}

/**
 * সামগ্রিক স্টক সামারি রেসপন্স ইন্টারফেস
 */
export interface OverallStockSummaryResponse {
  overall: {
    totalBranches: number;
    totalCurrentStock: number;
    totalReceivedAllTime: number;
    totalDistributedAllTime: number;
    totalReturnedAllTime: number;
  };
  branches: BranchStockBreakdownItem[];
}
