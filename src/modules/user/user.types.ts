import { z } from 'zod';
import type { Role } from '../../../generated/prisma/client.js';

/**
 * ইউজার ম্যানেজমেন্ট Zod স্কিমাস ও টাইপ ডেফিনিশনস
 */

// ১. নতুন ইউজার তৈরি স্কিমা (শুধু ADMIN বা MANAGER তৈরি করার অনুমতি)
export const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['ADMIN', 'MANAGER'] as const, {
    error: 'Role must be either ADMIN or MANAGER',
  }),
});

// ২. ইউজার আপডেট স্কিমা (নাম ও রোল)
export const updateUserSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER'] as const).optional(),
});

// ৩. পাসওয়ার্ড পরিবর্তনের স্কিমা (নিজের পাসওয়ার্ড)
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

// ৪. ইউজার লিস্ট ফিল্টারিং স্কিমা
export const userQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER'] as const).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
});

// ৫. প্যারামিটার ভ্যালিডেশন
export const userIdParamSchema = z.object({
  id: z.string().uuid('Invalid user ID format'),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
export type UserQueryDto = z.infer<typeof userQuerySchema>;

/**
 * পাসওয়ার্ড ছাড়া নিরাপদ ইউজার অবজেক্ট
 */
export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
