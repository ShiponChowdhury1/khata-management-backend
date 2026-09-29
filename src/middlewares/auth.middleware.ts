import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { ApiError } from '../utils/apiError.js';
import { prisma } from '../lib/prisma.js';

/**
 * রিকোয়েস্টের Authorization হেডার থেকে Bearer টোকেন যাচাই এবং প্রতিবার ডেটাবেজে isActive স্ট্যাটাস চেক করার মিডলওয়্যার
 */
export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Authentication required: Missing or invalid Bearer token');
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw ApiError.unauthorized('Authentication required: Token not provided');
    }

    // JWT ভেরিফাই করে ইউজার আইডি ও পেলোড নেওয়া
    const decodedUser = verifyAccessToken(token);

    // ডেটাবেজ থেকে ব্যবহারকারীর বর্তমান স্ট্যাটাস যাচাই
    const dbUser = await prisma.user.findUnique({
      where: { id: decodedUser.userId },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        isActive: true,
      },
    });

    if (!dbUser) {
      throw ApiError.unauthorized('Authentication failed: User no longer exists');
    }

    if (!dbUser.isActive) {
      throw ApiError.unauthorized('Your account has been deactivated. Please contact an administrator.');
    }

    req.user = {
      userId: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      name: dbUser.name,
    };

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
