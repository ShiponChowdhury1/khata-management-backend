import { z } from 'zod';
import type { OrderStatus, OrderPaymentStatus } from '../../../generated/prisma/client.js';
import { BANGLADESH_DISTRICTS } from '../../constants/districts.js';

/**
 * অর্ডার (Order) ও সাবজেক্ট প্রাইসিং মডিউল — Zod ভ্যালিডেশন স্কিমাস ও টাইপ ডেফিনিশনস
 */

import { positiveMoneySchema } from '../../utils/money.js';

// ১. সাবজেক্ট প্রাইসিং তৈরি স্কিমা (Admin)
export const createSubjectPricingSchema = z.object({
  classId: z.string().uuid('Invalid class ID format'),
  subjectId: z.string().uuid('Invalid subject ID format'),
  pricePerKhata: positiveMoneySchema('Price per khata must be positive with at most 2 decimal places'),
  isActive: z.boolean().optional().default(true),
});

// ২. সাবজেক্ট প্রাইসিং আপডেট স্কিমা (Admin)
export const updateSubjectPricingSchema = z
  .object({
    classId: z.string().uuid('Invalid class ID format').optional(),
    subjectId: z.string().uuid('Invalid subject ID format').optional(),
    pricePerKhata: positiveMoneySchema('Price per khata must be positive with at most 2 decimal places').optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

// ২.১ পাবলিক সাবজেক্ট প্রাইসিং ফিল্টার স্কিমা
export const publicSubjectPricingQuerySchema = z.object({
  classId: z.string().uuid('Invalid class ID format').optional(),
});

// ৩. পাবলিক জেলাভিত্তিক লেখক খোঁজার কুয়েরি স্কিমা
export const writersByDistrictQuerySchema = z.object({
  district: z.enum(BANGLADESH_DISTRICTS, {
    message: 'Please provide a valid district name in Bangladesh (e.g. Khulna, Cumilla, Rajshahi)',
  }),
});

// ৪. পাবলিক স্টুডেন্ট অর্ডার তৈরির স্কিমা (Public B2C)
export const createPublicOrderSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(2, 'Customer name must be at least 2 characters')
    .max(100, 'Customer name cannot exceed 100 characters'),
  customerPhone: z
    .string()
    .trim()
    .regex(/^(?:\+?880|0)?1[3-9]\d{8}$/, 'Please provide a valid Bangladeshi phone number (e.g. 01712345678)'),
  customerAddress: z
    .string()
    .trim()
    .min(5, 'Delivery address must be at least 5 characters')
    .max(255, 'Delivery address cannot exceed 255 characters'),
  subjectPricingId: z.string().uuid('Invalid subject pricing ID format (must be UUID)'),
  quantity: z.coerce
    .number()
    .int('Quantity must be an integer')
    .min(1, 'Minimum order quantity is 1 khata')
    .max(5000, 'Order quantity cannot exceed 5000'),
  preferredDistrict: z
    .enum(BANGLADESH_DISTRICTS, {
      message: 'Invalid preferred district. Must be one of 64 districts in Bangladesh.',
    })
    .optional(),
  preferredWriterId: z
    .string()
    .uuid('Invalid preferred writer ID format (must be UUID)')
    .optional(),
});

// ৫. পাবলিক অর্ডার ট্র্যাকিং স্কিমা (Public Track)
export const trackOrderQuerySchema = z.object({
  orderNumber: z.string().trim().min(3, 'Order number is required'),
  customerPhone: z
    .string()
    .trim()
    .regex(/^(?:\+?880|0)?1[3-9]\d{8}$/, 'Please provide a valid Bangladeshi phone number'),
});

// ৬. অ্যাডমিন অর্ডার লিস্ট ফিল্টারিং ও পেজিনেশন স্কিমা
export const orderQuerySchema = z.object({
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
  paymentStatus: z.enum(['PENDING', 'COLLECTED'] as const).optional(),
  branchId: z.string().uuid('Invalid branch ID format').optional(),
  preferredDistrict: z.enum(BANGLADESH_DISTRICTS).optional(),
  search: z.string().trim().optional(),
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

// ৭. সিঙ্গেল রাইটার অ্যাসাইনমেন্ট অবজেক্ট স্কিমা
export const singleAssignmentSchema = z.object({
  branchId: z.string().uuid('Invalid branch ID format (must be UUID)'),
  writerId: z.string().uuid('Invalid writer ID format (must be UUID)'),
  quantity: z.coerce
    .number()
    .int('Quantity must be an integer')
    .min(1, 'Assigned quantity must be at least 1 khata'),
});

// ৮. অর্ডার মাল্টি-রাইটার স্প্লিট অ্যাসাইনমেন্ট স্কিমা (Admin)
export const assignOrderSchema = z.object({
  assignments: z
    .array(singleAssignmentSchema)
    .min(1, 'At least one writer assignment is required'),
});

// ৯. অর্ডার স্ট্যাটাস ম্যানুয়াল পরিবর্তন স্কিমা (Admin)
export const updateOrderStatusSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'READY', 'OUT_FOR_DELIVERY', 'WRITING'] as const, {
    message: 'Manual status update only allows IN_PROGRESS, READY, or OUT_FOR_DELIVERY',
  }),
  deliveryPersonName: z.string().trim().max(100).optional(),
});

// ১০. অর্ডার বাতিল স্কিমা (Admin)
export const cancelOrderSchema = z.object({
  note: z
    .string()
    .trim()
    .min(3, 'Cancellation reason note must be at least 3 characters')
    .max(255),
});

// ১১. পাথ প্যারামিটার স্কিমাস
export const orderIdParamSchema = z.object({
  id: z.string().uuid('Invalid order ID format (must be UUID)'),
});

export const subjectPricingIdParamSchema = z.object({
  id: z.string().uuid('Invalid subject pricing ID format (must be UUID)'),
});

/**
 * TypeScript DTOs
 */
export type CreateSubjectPricingDto = z.infer<typeof createSubjectPricingSchema>;
export type UpdateSubjectPricingDto = z.infer<typeof updateSubjectPricingSchema>;
export type PublicSubjectPricingQueryDto = z.infer<typeof publicSubjectPricingQuerySchema>;
export type WritersByDistrictQueryDto = z.infer<typeof writersByDistrictQuerySchema>;
export type CreatePublicOrderDto = z.infer<typeof createPublicOrderSchema>;
export type TrackOrderQueryDto = z.infer<typeof trackOrderQuerySchema>;
export type OrderQueryDto = {
  page: number;
  limit: number;
  status?: OrderStatus;
  paymentStatus?: OrderPaymentStatus;
  branchId?: string;
  preferredDistrict?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
};
export type SingleAssignmentDto = z.infer<typeof singleAssignmentSchema>;
export type AssignOrderDto = z.infer<typeof assignOrderSchema>;
export type UpdateOrderStatusDto = z.infer<typeof updateOrderStatusSchema>;
export type CancelOrderDto = z.infer<typeof cancelOrderSchema>;
