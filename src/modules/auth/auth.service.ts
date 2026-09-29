import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/apiError.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import type { RegisterDto, LoginDto, AuthResponseData } from './auth.types.js';

/**
 * অথেন্টিকেশন বিজনেস লজিক সার্ভিস
 */
export class AuthService {
  /**
   * নতুন ইউজার রেজিস্ট্রেশন (শুধু SUPER_ADMIN করতে পারবেন)
   */
  static async register(dto: RegisterDto, creatorUserId?: string): Promise<AuthResponseData> {
    const existingUser = await prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw ApiError.conflict('An account with this email already exists');
    }

    // পাসওয়ার্ড হ্যাশিং
    const hashedPassword = await bcrypt.hash(dto.password, env.BCRYPT_SALT_ROUNDS);

    // ডেটাবেজে ইউজার ও অডিট লগ সংরক্ষণ
    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: dto.name.trim(),
          email: dto.email.toLowerCase().trim(),
          password: hashedPassword,
          role: dto.role || 'MANAGER',
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
        },
      });

      if (creatorUserId) {
        await tx.auditLog.create({
          data: {
            userId: creatorUserId,
            action: 'REGISTER_USER',
            entityType: 'User',
            entityId: createdUser.id,
            details: {
              name: createdUser.name,
              email: createdUser.email,
              role: createdUser.role,
            },
          },
        });
      }

      return createdUser;
    });

    // টোকেন জেনারেশন
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    const refreshToken = generateRefreshToken({ userId: user.id });

    return { user, accessToken, refreshToken };
  }

  /**
   * ইউজার লগইন ভেরিফিকেশন
   */
  static async login(dto: LoginDto): Promise<AuthResponseData> {
    const user = await prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    if (!user.isActive) {
      throw ApiError.forbidden('Your account is inactive. Please contact administrator.');
    }

    // পাসওয়ার্ড ম্যাচিং
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    // টোকেন তৈরি
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    const refreshToken = generateRefreshToken({ userId: user.id });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * রিফ্রেশ টোকেন দিয়ে নতুন এক্সেস টোকেন ইস্যু করা
   */
  static async refreshAccessToken(refreshTokenStr: string) {
    let decoded: { userId: string };
    try {
      decoded = verifyRefreshToken(refreshTokenStr);
    } catch {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      throw ApiError.unauthorized('User not found');
    }

    if (!user.isActive) {
      throw ApiError.unauthorized('Your account has been deactivated. Please contact an administrator.');
    }

    const newAccessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    return {
      accessToken: newAccessToken,
      user,
    };
  }

  /**
   * বর্তমানে লগইন থাকা ইউজারের প্রোফাইল তথ্য পাওয়া
   */
  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    return user;
  }
}

export default AuthService;
