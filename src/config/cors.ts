import type { CorsOptions } from 'cors';
import { env } from './env.js';

/**
 * Next.js ফ্রন্টএন্ডের জন্য CORS কনফিগারেশন অপশনস
 */
export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // পোস্টম্যান, কার্ল বা কোনো অরিজিন ছাড়া সরাসরি রিকোয়েস্ট গ্রহণযোগ্য করা
    if (!origin) return callback(null, true);

    const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());

    if (allowedOrigins.includes(origin) || !env.isProduction) {
      callback(null, true);
    } else {
      callback(new Error(`CORS Error: Origin '${origin}' is not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400, // 24 hours
};

export default corsOptions;
