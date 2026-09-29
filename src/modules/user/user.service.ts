import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/apiError.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type {
  CreateUserDto,
  UpdateUserDto,
  ChangePasswordDto,
  UserQueryDto,
  SafeUser,
} from './user.types.js';

export class UserService {
  private static userSelectFields = {
    id: true,
    name: true,
    email: true,
    role: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  /**
   * ১. নতুন ইউজার তৈরি (শুধুমাত্র SUPER_ADMIN)
   */
  static async createUser(dto: CreateUserDto, creatorUserId: string): Promise<SafeUser> {
    const existing = await prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existing) {
      throw ApiError.conflict(`A user with email '${dto.email}' already exists`);
    }

    const hashedPassword = await bcrypt.hash(dto.password, env.BCRYPT_SALT_ROUNDS);

    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: dto.name.trim(),
          email: dto.email.toLowerCase().trim(),
          password: hashedPassword,
          role: dto.role,
        },
        select: UserService.userSelectFields,
      });

      await tx.auditLog.create({
        data: {
          userId: creatorUserId,
          action: 'CREATE_USER',
          entityType: 'User',
          entityId: user.id,
          details: {
            name: user.name,
            email: user.email,
            role: user.role,
          },
        },
      });

      return user;
    });
  }

  /**
   * ২. ইউজারদের তালিকা (পেজিনেশন ও ফিল্টার সহ, পাসওয়ার্ড ব্যতীত)
   */
  static async getAllUsers(query: UserQueryDto) {
    const { page, limit, search, role, isActive } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: UserService.userSelectFields,
      }),
    ]);

    return {
      users,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * ৩. নির্দিষ্ট ইউজারের তথ্য
   */
  static async getUserById(id: string): Promise<SafeUser> {
    const user = await prisma.user.findUnique({
      where: { id },
      select: UserService.userSelectFields,
    });

    if (!user) {
      throw ApiError.notFound(`User not found with ID: ${id}`);
    }

    return user;
  }

  /**
   * ৪. ইউজার আপডেট করা (SUPER_ADMIN)
   */
  static async updateUser(id: string, dto: UpdateUserDto, updaterUserId: string): Promise<SafeUser> {
    const existing = await prisma.user.findUnique({
      where: { id },
    });

    if (!existing) {
      throw ApiError.notFound(`User not found with ID: ${id}`);
    }

    // যদি কোনো SUPER_ADMIN-এর রোল পরিবর্তনের চেষ্টা করা হয়, তবে নিশ্চিত করতে হবে যে অন্তত ১ জন সক্রিয় SUPER_ADMIN যেন থাকে
    if (dto.role && dto.role !== 'SUPER_ADMIN' && existing.role === 'SUPER_ADMIN') {
      const activeSuperAdmins = await prisma.user.count({
        where: { role: 'SUPER_ADMIN', isActive: true },
      });

      if (activeSuperAdmins <= 1) {
        throw ApiError.badRequest('Cannot change role of the last active SUPER_ADMIN account');
      }
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          role: dto.role,
        },
        select: UserService.userSelectFields,
      });

      await tx.auditLog.create({
        data: {
          userId: updaterUserId,
          action: 'UPDATE_USER',
          entityType: 'User',
          entityId: id,
          details: {
            before: { name: existing.name, role: existing.role },
            after: { name: updated.name, role: updated.role },
          },
        },
      });

      return updated;
    });
  }

  /**
   * ৫. ইউজারের অ্যাক্টিভ/ইনঅ্যাক্টিভ স্ট্যাটাস পরিবর্তন
   * - নিজেকে ডিঅ্যাক্টিভেট করা যাবে না
   * - শেষ সক্রিয় SUPER_ADMIN-কে ডিঅ্যাক্টিভেট করা যাবে না
   */
  static async toggleUserStatus(id: string, updaterUserId: string): Promise<SafeUser> {
    if (id === updaterUserId) {
      throw ApiError.badRequest('You cannot deactivate your own account');
    }

    const existing = await prisma.user.findUnique({
      where: { id },
    });

    if (!existing) {
      throw ApiError.notFound(`User not found with ID: ${id}`);
    }

    // যদি কোনো সক্রিয় SUPER_ADMIN-কে ডিঅ্যাক্টিভেট করার চেষ্টা করা হয়
    if (existing.isActive && existing.role === 'SUPER_ADMIN') {
      const activeSuperAdmins = await prisma.user.count({
        where: { role: 'SUPER_ADMIN', isActive: true },
      });

      if (activeSuperAdmins <= 1) {
        throw ApiError.badRequest('Cannot deactivate the last active SUPER_ADMIN account');
      }
    }

    const newStatus = !existing.isActive;

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { isActive: newStatus },
        select: UserService.userSelectFields,
      });

      await tx.auditLog.create({
        data: {
          userId: updaterUserId,
          action: 'TOGGLE_USER_STATUS',
          entityType: 'User',
          entityId: id,
          details: {
            userName: existing.name,
            email: existing.email,
            previousStatus: existing.isActive,
            newStatus: updated.isActive,
          },
        },
      });

      return updated;
    });
  }

  /**
   * ৬. নিজের পাসওয়ার্ড পরিবর্তন
   */
  static async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isMatch) {
      throw ApiError.badRequest('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw ApiError.badRequest('New password cannot be the same as current password');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, env.BCRYPT_SALT_ROUNDS);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CHANGE_PASSWORD',
          entityType: 'User',
          entityId: userId,
          details: {
            message: 'User successfully changed their password',
          },
        },
      });
    });

    return { message: 'Password changed successfully' };
  }
}

export default UserService;
