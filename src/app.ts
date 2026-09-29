import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { corsOptions } from './config/cors.js';
import rootRouter from './routes/index.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { ApiError } from './utils/apiError.js';
import { logger } from './utils/logger.js';

// Express অ্যাপ ইনিশিয়ালাইজেশন
const app: Express = express();

// ==========================================
// গ্লোবাল মিডলওয়্যার কনফিগারেশন
// ==========================================

// সিকিউরিটি হেডার্স (Helmet)
app.use(helmet());

// CORS মিডলওয়্যার
app.use(cors(corsOptions));

// JSON বডি পার্সিং
app.use(express.json());

// URL-encoded ফর্ম ডাটা পার্সিং
app.use(express.urlencoded({ extended: true }));

// রিকোয়েস্ট লগিং মিডলওয়্যার (ডেভেলপমেন্টের জন্য)
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.debug(`Incoming Request: ${req.method} ${req.path}`);
  next();
});

// ==========================================
// রুটস মাউন্টিং
// ==========================================

// রুট টেস্ট এন্ডপয়েন্ট
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Khata Management System API',
    version: '1.0.0',
    documentation: '/api/health',
  });
});

// সমস্ত API রুট মাউন্ট (/api/auth, /api/branches, ইত্যাদি)
app.use('/api', rootRouter);

// ৪০৪ নট ফাউন্ড হ্যান্ডলার (যদি কোনো রুট না মেলে)
app.use((req: Request, _res: Response, next: NextFunction) => {
  next(ApiError.notFound(`Cannot find route '${req.method} ${req.originalUrl}' on this server`));
});

// সেন্ট্রালাইজড গ্লোবাল এরর হ্যান্ডলার মিডলওয়্যার
app.use(errorHandler);

export default app;
