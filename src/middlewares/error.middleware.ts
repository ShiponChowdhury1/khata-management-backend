import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ApiError } from '../utils/apiError.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * গ্লোবাল সেন্ট্রালাইজড এরর হ্যান্ডলার মিডলওয়্যার
 */
export const errorHandler: ErrorRequestHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details: unknown = undefined;

  // কাস্টম ApiError হ্যান্ডলিং
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  }
  // Prisma ইউনিক কনস্ট্রেইন্ট বা পরিচিত এরর হ্যান্ডলিং
  else if (err.name === 'PrismaClientKnownRequestError') {
    statusCode = 400;
    message = 'Database constraint error';
    details = (err as unknown as { code?: string }).code;
  }
  // JSON পার্সিং সিনট্যাক্স এরর হ্যান্ডলিং
  else if (err instanceof SyntaxError && 'status' in err && err.status === 400) {
    statusCode = 400;
    message = 'Malformed JSON request body';
  } else if (err.message) {
    message = err.message;
  }

  // এরর লগিং
  logger.error(`[${req.method} ${req.originalUrl}] ${statusCode} - ${message}`, {
    stack: err.stack,
    details,
  });

  res.status(statusCode).json({
    success: false,
    message,
    ...(details !== undefined && { details }),
    ...(env.isDevelopment && { stack: err.stack }),
    timestamp: new Date().toISOString(),
  });
};

export default errorHandler;
