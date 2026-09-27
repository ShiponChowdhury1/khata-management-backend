import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { ApiError } from '../utils/apiError.js';

/**
 * রিকোয়েস্টের Authorization হেডার থেকে Bearer টোকেন যাচাই করে req.user সেট করার মিডলওয়্যার
 */
export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Authentication required: Missing or invalid Bearer token');
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw ApiError.unauthorized('Authentication required: Token not provided');
    }

    // JWT ভেরিফাই করে ইউজার ইনফরমেশন রিকোয়েস্টে এটাচ করা
    const decodedUser = verifyAccessToken(token);
    req.user = decodedUser;

    next();
  } catch (error) {
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      next(ApiError.unauthorized('Access token has expired'));
      return;
    }

    if (error instanceof Error && error.name === 'JsonWebTokenError') {
      next(ApiError.unauthorized('Invalid access token'));
      return;
    }

    next(error);
  }
};

export default authenticate;
