import { z } from 'zod';

/**
 * Zod ভ্যালিডেশন স্কিমাস
 */

// নতুন ব্রাঞ্চ তৈরির ভ্যালিডেশন স্কিমা
export const createBranchSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Branch name must be at least 2 characters')
    .max(100, 'Branch name cannot exceed 100 characters'),
  address: z.string().trim().max(255, 'Address cannot exceed 255 characters').optional(),
  phone: z
    .string()
    .trim()
    .regex(/^(?:\+?880|0)?1[3-9]\d{8}$/, 'Please provide a valid Bangladeshi phone number')
    .optional()
    .or(z.literal('')),
});

// ব্রাঞ্চ আপডেটের ভ্যালিডেশন স্কিমা
export const updateBranchSchema = z
  .object({
    name: z.string().trim().min(2, 'Branch name must be at least 2 characters').max(100).optional(),
    address: z.string().trim().max(255).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^(?:\+?880|0)?1[3-9]\d{8}$/, 'Please provide a valid Bangladeshi phone number')
      .optional()
      .or(z.literal('')),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
  });

// কুয়েরি প্যারামস স্কিমা (পেজিনেশন ও সার্চ)
export const branchQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10) || 1) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10) || 10)) : 10)),
  search: z.string().trim().optional(),
});

// পাথ প্যারামিটার (UUID) ভ্যালিডেশন স্কিমা
export const branchIdParamSchema = z.object({
  id: z.string().uuid('Invalid branch ID format (must be UUID)'),
});

/**
 * TypeScript DTOs
 */
export type CreateBranchDto = z.infer<typeof createBranchSchema>;
export type UpdateBranchDto = z.infer<typeof updateBranchSchema>;
export type BranchQueryDto = {
  page: number;
  limit: number;
  search?: string;
};

/**
 * ব্রাঞ্চ বিস্তারিত ও স্টক সামারি রেসপন্স টাইপ
 */
export interface BranchStockSummary {
  totalReceivedQty: number;
  totalDistributedQty: number;
  totalReturnedQty: number;
  currentAvailableQty: number;
  lastRecordDate?: Date | null;
}

export interface BranchDetails {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  counts: {
    writers: number;
    khatas: {
      total: number;
      distributed: number;
      partiallySubmitted: number;
      completed: number;
    };
  };
  stocksSummary: BranchStockSummary;
}
