import type { Role } from '../../../generated/prisma/client.js';

/**
 * ইউজার রেজিস্ট্রেশন ইনপুট DTO
 */
export interface RegisterDto {
  name: string;
  email: string;
  password: string;
  role?: Role;
}

/**
 * ইউজার লগইন ইনপুট DTO
 */
export interface LoginDto {
  email: string;
  password: string;
}

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
