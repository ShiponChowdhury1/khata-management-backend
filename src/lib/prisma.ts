import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../../generated/prisma/client.js';

export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;
export { Prisma };

// Global object-এ PrismaClient এবং Pool সংরক্ষণ করা হচ্ছে যেন dev মোডে hot reload-এ একাধিক কানেকশন না খুলে
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: pg.Pool | undefined;
};

// Supabase PostgreSQL কানেকশন স্ট্রিং
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('⚠️ WARNING: DATABASE_URL is not set in environment variables.');
}

// pg Connection Pool তৈরি (কানেকশন সংখ্যা ও টাইমআউট অপ্টিমাইজেশনসহ)
const pool =
  globalForPrisma.pool ??
  new pg.Pool({
    connectionString: connectionString ?? '',
    // Supabase ও অন্যান্য ক্লাউড ডেটাবেজে কানেক্ট করার জন্য SSL অপশন
    ssl:
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: true }
        : { rejectUnauthorized: false }, // Development মোডে সেলফ-সাইনড সার্টিফিকেট গ্রহণযোগ্য করতে
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

// Prisma 7 এর জন্য ড্রাইভার অ্যাডাপ্টার ইনস্ট্যান্স
const adapter = new PrismaPg(pool);

// Singleton PrismaClient ইনস্ট্যান্স তৈরি
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

// Development মোডে গ্লোবাল রেফারেন্স সেভ রাখা হচ্ছে
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pool = pool;
}

export default prisma;
