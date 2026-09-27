import type { Request } from 'express';
import type { Role } from '../../generated/prisma/client.js';

// JWT টোকেনে সংরক্ষিত ইউজার পেলোড টাইপ
export interface JwtUserPayload {
  userId: string;
  email: string;
  role: Role;
  branchId?: string | null;
}

// Express Request ইন্টারফেসে অথেন্টিকেটেড ইউজার যুক্ত করার জন্য কাস্টম ইন্টারফেস
export interface AuthenticatedRequest extends Request {
  user?: JwtUserPayload;
}

// স্ট্যান্ডার্ড API রেসপন্স ফরম্যাট
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  timestamp: string;
}
