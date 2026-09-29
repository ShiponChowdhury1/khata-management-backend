import { z } from 'zod';
import { normalizeName } from '../class/class.types.js';

// ১. বিষয় তৈরির স্কিমা
export const createSubjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Subject name cannot be empty')
    .max(100, 'Subject name cannot exceed 100 characters')
    .transform(normalizeName),
  isActive: z.boolean().optional().default(true),
});

// ২. বিষয় আপডেটের স্কিমা
export const updateSubjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Subject name cannot be empty')
      .max(100, 'Subject name cannot exceed 100 characters')
      .transform(normalizeName)
      .optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

// ৩. বিষয় কুয়েরি ফিল্টার স্কিমা
export const subjectQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
});

// ৪. প্যারাম স্কিমা
export const subjectIdParamSchema = z.object({
  id: z.string().uuid('Invalid subject ID format'),
});

export type CreateSubjectDto = z.infer<typeof createSubjectSchema>;
export type UpdateSubjectDto = z.infer<typeof updateSubjectSchema>;
export type SubjectQueryDto = z.infer<typeof subjectQuerySchema>;
