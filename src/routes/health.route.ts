import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

/**
 * @route   GET /api/health
 * @desc    API এবং ডেটাবেজ কানেকশন হেলথ চেক রুট
 * @access  Public
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    // Supabase PostgreSQL কানেকশন টেস্ট করতে একটি টেস্ট কুয়েরি
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: 'healthy',
      database: 'connected',
      uptime: `${Math.floor(process.uptime())}s`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown database error',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
