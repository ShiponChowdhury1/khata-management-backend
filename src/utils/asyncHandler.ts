import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncFunction = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * অ্যাসিনক্রোনাস রুট হ্যান্ডলারের এরর স্বয়ংক্রিয়ভাবে নেক্সট মিডলওয়্যারে ক্যাচ করার হায়ার-অর্ডার ফাংশন
 */
export const asyncHandler = (fn: AsyncFunction): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default asyncHandler;
