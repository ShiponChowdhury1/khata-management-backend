import { z } from 'zod';
import type { Role } from '../../../generated/prisma/client.js';

/**
 * Zod ভ্যালিডেশন স্কিমাস
 */
export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER'] as const).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().trim().min(1, 'Refresh token is required'),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;

/**
 * অথেন্টিকেশন সফল হলে রেসপন্স ডাটার টাইপ
 */
export interface AuthResponseData {
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    isActive: boolean;
  };
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenResponseData {
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    isActive: boolean;
  };
  accessToken: string;
}
