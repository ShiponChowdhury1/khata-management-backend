import type { Response } from 'express';

/**
 * স্ট্যান্ডার্ড API রেসপন্স ইন্টারফেস
 */
export interface IApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
  timestamp: string;
}

/**
 * সফল API রেসপন্স পাঠানোর স্ট্যান্ডার্ড ফাংশন
 */
export const sendSuccess = <T>(
  res: Response,
  statusCode = 200,
  message = 'Success',
  data?: T,
  meta?: Record<string, unknown>
): Response => {
  const responsePayload: IApiResponse<T> = {
    success: true,
    message,
    ...(data !== undefined && { data }),
    ...(meta !== undefined && { meta }),
    timestamp: new Date().toISOString(),
  };

  return res.status(statusCode).json(responsePayload);
};

export default sendSuccess;
