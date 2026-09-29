import { z } from 'zod';

/**
 * স্ট্রিং নর্মালাইজেশন ইউটিলিটি:
 * সামনে/পেছনের স্পেস ছাঁটাই (trim) এবং ভেতরের একাধিক স্পেসকে একটি একক স্পেসে রূপান্তর করে।
 */
export const normalizeName = (val: string): string => {
  return val.trim().replace(/\s+/g, ' ');
};

// ১. ক্লাস তৈরির স্কিমা
export const createClassSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Class name cannot be empty')
    .max(100, 'Class name cannot exceed 100 characters')
    .transform(normalizeName),
  displayOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().optional().default(true),
});

// ২. ক্লাস আপডেটের স্কিমা
export const updateClassSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Class name cannot be empty')
      .max(100, 'Class name cannot exceed 100 characters')
      .transform(normalizeName)
      .optional(),
    displayOrder: z.coerce.number().int().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

// ৩. ক্লাস কুয়েরি ফিল্টার স্কিমা
export const classQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
});

// ৪. প্যারাম স্কিমা
export const classIdParamSchema = z.object({
  id: z.string().uuid('Invalid class ID format'),
});

export type CreateClassDto = z.infer<typeof createClassSchema>;
export type UpdateClassDto = z.infer<typeof updateClassSchema>;
export type ClassQueryDto = z.infer<typeof classQuerySchema>;
