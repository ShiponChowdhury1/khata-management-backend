import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type {
  CreateBranchDto,
  UpdateBranchDto,
  BranchQueryDto,
  BranchDetails,
  BranchStockSummary,
} from './branch.types.js';

/**
 * ব্রাঞ্চ সার্ভিস — ডেটাবেজ লজিক ও অডিট লগিং
 */
export class BranchService {
  /**
   * নতুন ব্রাঞ্চ তৈরি করা
   */
  static async createBranch(dto: CreateBranchDto, userId: string) {
    // একই নামের ব্রাঞ্চ পূর্বে রয়েছে কি না চেক
    const existingBranch = await prisma.branch.findFirst({
      where: {
        name: {
          equals: dto.name.trim(),
          mode: 'insensitive',
        },
      },
    });

    if (existingBranch) {
      throw ApiError.conflict(`Branch with name '${dto.name}' already exists`);
    }

    // ডেটাবেজে নতুন ব্রাঞ্চ তৈরি ও অডিট লগ (Atomic Transaction)
    return await prisma.$transaction(async (tx) => {
      const branch = await tx.branch.create({
        data: {
          name: dto.name.trim(),
          address: dto.address?.trim() || null,
          phone: dto.phone?.trim() || null,
        },
      });

      // অডিট লগ তৈরি
      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE_BRANCH',
          entityType: 'Branch',
          entityId: branch.id,
          details: {
            name: branch.name,
            address: branch.address,
            phone: branch.phone,
          },
        },
      });

      return branch;
    });
  }

  /**
   * সব ব্রাঞ্চের তালিকা — পেজিনেশন ও সার্চ ফিল্টারিং সহ
   */
  static async getAllBranches(query: BranchQueryDto) {
    const { page, limit, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.BranchWhereInput = search
      ? {
          name: {
            contains: search.trim(),
            mode: 'insensitive',
          },
        }
      : {};

    const [total, branches] = await Promise.all([
      prisma.branch.count({ where }),
      prisma.branch.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              writers: true,
              khatas: true,
              stocks: true,
            },
          },
        },
      }),
    ]);

    return {
      branches,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * একটি নির্দিষ্ট ব্রাঞ্চের বিস্তারিত ও পরিসংখ্যান (Writers, Khatas, Stocks summary)
   */
  static async getBranchById(id: string): Promise<BranchDetails> {
    const branch = await prisma.branch.findUnique({
      where: { id },
    });

    if (!branch) {
      throw ApiError.notFound(`Branch not found with ID: ${id}`);
    }

    // রাইটার্স ও খাতা স্ট্যাটাস অনুযায়ী কাউন্ট
    const [
      writersCount,
      totalKhatas,
      distributedKhatas,
      partiallySubmittedKhatas,
      completedKhatas,
      stocksAggregate,
      latestStock,
    ] = await Promise.all([
      prisma.writer.count({ where: { branchId: id } }),
      prisma.khata.count({ where: { branchId: id } }),
      prisma.khata.count({ where: { branchId: id, status: 'DISTRIBUTED' } }),
      prisma.khata.count({ where: { branchId: id, status: 'PARTIALLY_SUBMITTED' } }),
      prisma.khata.count({ where: { branchId: id, status: 'COMPLETED' } }),
      prisma.stock.aggregate({
        where: { branchId: id },
        _sum: {
          receivedQty: true,
          distributedQty: true,
          returnedQty: true,
        },
      }),
      prisma.stock.findFirst({
        where: { branchId: id },
        orderBy: { recordDate: 'desc' },
      }),
    ]);

    const stocksSummary: BranchStockSummary = {
      totalReceivedQty: stocksAggregate._sum.receivedQty ?? 0,
      totalDistributedQty: stocksAggregate._sum.distributedQty ?? 0,
      totalReturnedQty: stocksAggregate._sum.returnedQty ?? 0,
      currentAvailableQty: latestStock?.currentQty ?? 0,
      lastRecordDate: latestStock?.recordDate ?? null,
    };

    return {
      id: branch.id,
      name: branch.name,
      address: branch.address,
      phone: branch.phone,
      isActive: branch.isActive,
      createdAt: branch.createdAt,
      updatedAt: branch.updatedAt,
      counts: {
        writers: writersCount,
        khatas: {
          total: totalKhatas,
          distributed: distributedKhatas,
          partiallySubmitted: partiallySubmittedKhatas,
          completed: completedKhatas,
        },
      },
      stocksSummary,
    };
  }

  /**
   * ব্রাঞ্চ আপডেট করা
   */
  static async updateBranch(id: string, dto: UpdateBranchDto, userId: string) {
    const existingBranch = await prisma.branch.findUnique({
      where: { id },
    });

    if (!existingBranch) {
      throw ApiError.notFound(`Branch not found with ID: ${id}`);
    }

    // যদি নাম পরিবর্তন করতে চায়, তবে অন্য কোনো ব্রাঞ্চে এই নাম ইতিমধ্যে ব্যবহৃত হয়েছে কি না চেক
    if (dto.name && dto.name.trim() !== existingBranch.name) {
      const duplicate = await prisma.branch.findFirst({
        where: {
          id: { not: id },
          name: {
            equals: dto.name.trim(),
            mode: 'insensitive',
          },
        },
      });

      if (duplicate) {
        throw ApiError.conflict(`Another branch with name '${dto.name}' already exists`);
      }
    }

    return prisma.$transaction(async (tx) => {
      const updatedBranch = await tx.branch.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          address: dto.address !== undefined ? dto.address?.trim() || null : undefined,
          phone: dto.phone !== undefined ? dto.phone?.trim() || null : undefined,
          isActive: dto.isActive,
        },
      });

      // অডিট লগ
      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE_BRANCH',
          entityType: 'Branch',
          entityId: id,
          details: {
            before: {
              name: existingBranch.name,
              address: existingBranch.address,
              phone: existingBranch.phone,
              isActive: existingBranch.isActive,
            },
            after: {
              name: updatedBranch.name,
              address: updatedBranch.address,
              phone: updatedBranch.phone,
              isActive: updatedBranch.isActive,
            },
          },
        },
      });

      return updatedBranch;
    });
  }

  /**
   * ব্রাঞ্চের সক্রিয়/নিষ্ক্রিয় স্ট্যাটাস টগল করা (isActive)
   */
  static async toggleBranchStatus(id: string, userId: string) {
    const existingBranch = await prisma.branch.findUnique({
      where: { id },
    });

    if (!existingBranch) {
      throw ApiError.notFound(`Branch not found with ID: ${id}`);
    }

    const newStatus = !existingBranch.isActive;

    return prisma.$transaction(async (tx) => {
      const updatedBranch = await tx.branch.update({
        where: { id },
        data: { isActive: newStatus },
      });

      // অডিট লগ তৈরি
      await tx.auditLog.create({
        data: {
          userId,
          action: 'TOGGLE_BRANCH_STATUS',
          entityType: 'Branch',
          entityId: id,
          details: {
            previousStatus: existingBranch.isActive,
            newStatus: updatedBranch.isActive,
          },
        },
      });

      return updatedBranch;
    });
  }

  /**
   * ব্রাঞ্চ ডিলিট করা (যদি active writer বা khata থাকে তবে ডিলিট ব্লক করা হবে)
   */
  static async deleteBranch(id: string, userId: string) {
    const existingBranch = await prisma.branch.findUnique({
      where: { id },
    });

    if (!existingBranch) {
      throw ApiError.notFound(`Branch not found with ID: ${id}`);
    }

    // ১. ব্রাঞ্চে কোনো একটিভ লেখক বা পেন্ডিং খাতা রয়েছে কি না যাচাই
    const [activeWritersCount, pendingKhatasCount, totalWritersCount, totalKhatasCount] =
      await Promise.all([
        prisma.writer.count({ where: { branchId: id, isActive: true } }),
        prisma.khata.count({ where: { branchId: id, status: { not: 'COMPLETED' } } }),
        prisma.writer.count({ where: { branchId: id } }),
        prisma.khata.count({ where: { branchId: id } }),
      ]);

    if (activeWritersCount > 0 || pendingKhatasCount > 0) {
      throw ApiError.badRequest(
        `Cannot delete branch '${existingBranch.name}': Branch currently has ${activeWritersCount} active writer(s) and ${pendingKhatasCount} uncompleted/pending khata(s). Please settle or reassign them before deletion.`
      );
    }

    // ২. হিস্টোরিক্যাল বা পূর্বের হিসাব-নিকাশ সংরক্ষণ করতে যদি কোনো খাতা বা লেখক থাকে
    if (totalWritersCount > 0 || totalKhatasCount > 0) {
      throw ApiError.badRequest(
        `Cannot delete branch '${existingBranch.name}': Branch contains historical records (${totalWritersCount} writer(s) and ${totalKhatasCount} khata(s)). To protect financial audit logs, please deactivate this branch (isActive: false) instead of permanently deleting it.`
      );
    }

    return prisma.$transaction(async (tx) => {
      // ৩. সম্পূর্ণ পরিষ্কার থাকলে ডিলিট করা
      await tx.branch.delete({
        where: { id },
      });

      // অডিট লগ
      await tx.auditLog.create({
        data: {
          userId,
          action: 'DELETE_BRANCH',
          entityType: 'Branch',
          entityId: id,
          details: {
            deletedBranchName: existingBranch.name,
            deletedAt: new Date().toISOString(),
          },
        },
      });

      return { id, name: existingBranch.name };
    });
  }
}

export default BranchService;
