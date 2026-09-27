import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { AuthUser } from '../types/express.d.js';

/**
 * এক্সেস টোকেন জেনারেট করার ইউটিলিটি
 */
export const generateAccessToken = (
  payload: AuthUser,
  expiresIn: string | number = env.JWT_EXPIRES_IN
): string => {
  const options: SignOptions = {
    expiresIn: expiresIn as unknown as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
};

/**
 * রিফ্রেশ টোকেন জেনারেট করার ইউটিলিটি
 */
export const generateRefreshToken = (
  payload: { userId: string },
  expiresIn: string | number = env.REFRESH_TOKEN_EXPIRES_IN
): string => {
  const options: SignOptions = {
    expiresIn: expiresIn as unknown as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.REFRESH_TOKEN_SECRET, options);
};

/**
 * JWT টোকেন ভেরিফাই করে পেলোড রিটার্ন করার ইউটিলিটি
 */
export const verifyAccessToken = (token: string): AuthUser => {
  return jwt.verify(token, env.JWT_SECRET) as AuthUser;
};

/**
 * রিফ্রেশ টোকেন ভেরিফাই করার ইউটিলিটি
 */
export const verifyRefreshToken = (token: string): { userId: string } => {
  return jwt.verify(token, env.REFRESH_TOKEN_SECRET) as { userId: string };
};
