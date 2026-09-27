import 'dotenv/config';

/**
 * সেন্ট্রালাইজড এবং টাইপ-সেফ এনভায়রনমেন্ট কনফিগারেশন
 */
export const env = {
  PORT: Number(process.env.PORT) || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV !== 'production',

  // ফ্রন্টএন্ড CORS অরিজিন (Next.js)
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',

  // ডেটাবেজ কানেকশন স্ট্রিং
  DATABASE_URL: process.env.DATABASE_URL || '',
  DIRECT_URL: process.env.DIRECT_URL || '',

  // JWT কনফিগারেশন
  JWT_SECRET: process.env.JWT_SECRET || 'fallback-super-secret-jwt-key-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // রিফ্রেশ টোকেন কনফিগারেশন
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || 'fallback-refresh-secret-key',
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',

  // পাসওয়ার্ড হ্যাশ রাউন্ড
  BCRYPT_SALT_ROUNDS: Number(process.env.BCRYPT_SALT_ROUNDS) || 10,
} as const;

export default env;
