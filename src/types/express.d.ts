import type { Role } from '../../generated/prisma/client.js';

/**
 * JWT টোকেন থেকে প্রাপ্ত অথেন্টিকেটেড ইউজারের টাইপ
 */
export interface AuthUser {
  userId: string;
  email: string;
  role: Role;
  name?: string;
}

/**
 * Express Request ইন্টারফেসে কাস্টম user প্রপার্টি যুক্ত করা
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
