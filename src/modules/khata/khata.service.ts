import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { formatMoneyString } from '../../utils/money.js';
import type { Prisma, KhataStatus } from '../../../generated/prisma/client.js';
import type {
  CreateKhataDto,
  SubmitKhataDto,
  UpdateKhataDto,
  KhataQueryDto,
  BranchKhataSummary,
} from './khata.types.js';

/**
 * খাতা (Khata) সার্ভিস — কোর বিজনেস লজিক, সাবমিশন ট্রানজিশন ও অডিট লগিং
 */
export class KhataService {
  /**
   * নতুন খাতা/ব্যাচ তৈরি করা (Atomic Transaction সহ)
   */
  static async createKhata(dto: CreateKhataDto, userId: string) {
    // ১. ব্রাঞ্চ আইডি ভ্যালিড এবং সক্রিয় কি না যাচাই
    const branch = await prisma.branch.findUnique({
      where: { id: dto.branchId },
    });

    if (!branch) {
      throw ApiError.notFound(`Branch not found with ID: ${dto.branchId}`);
    }

    if (!branch.isActive) {
      throw ApiError.badRequest(`Cannot create khata under an inactive branch ('${branch.name}')`);
    }

    // ২. লেখক আইডি ভ্যালিড, সক্রিয় এবং এই ব্রাঞ্চের কি না যাচাই
    const writer = await prisma.writer.findUnique({
      where: { id: dto.writerId },
    });

    if (!writer) {
      throw ApiError.notFound(`Writer not found with ID: ${dto.writerId}`);
    }

    if (!writer.isActive) {
      throw ApiError.badRequest(`Cannot assign khata to an inactive writer ('${writer.name}')`);
    }

    if (writer.branchId !== dto.branchId) {
      throw ApiError.badRequest(
        `Writer '${writer.name}' belongs to a different branch. You can only assign khatas within the writer's branch.`
      );
    }

    // ৩. ব্যাচ নম্বর ইউনিক কি না যাচাই
    const existingKhata = await prisma.khata.findFirst({
      where: { batchNumber: dto.batchNumber.trim() },
    });

    if (existingKhata) {
      throw ApiError.conflict(`Khata with batch number '${dto.batchNumber}' already exists`);
    }

    // ৪. ডেটাবেজে ট্রানজ্যাকশনে খাতা তৈরি ও অডিট লগ
    return await prisma.$transaction(async (tx) => {
      const khata = await tx.khata.create({
        data: {
          batchNumber: dto.batchNumber.trim(),
          branchId: dto.branchId,
          writerId: dto.writerId,
          receivedQty: dto.receivedQty,
          submittedQty: 0,
          status: 'DISTRIBUTED',
        },
        include: {
          branch: { select: { id: true, name: true } },
          writer: { select: { id: true, name: true, phone: true, ratePerKhata: true } },
        },
      });

      // অডিট লগ তৈরি (একই ট্রানজ্যাকশনে)
      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE_KHATA',
          entityType: 'Khata',
          entityId: khata.id,
          details: {
            batchNumber: khata.batchNumber,
            branchId: khata.branchId,
            writerId: khata.writerId,
            receivedQty: khata.receivedQty,
          },
        },
      });

      return {
        ...khata,
        writer: {
          ...khata.writer,
          ratePerKhata: formatMoneyString(khata.writer.ratePerKhata),
        },
        pendingQty: khata.receivedQty,
      };
    });
  }

  /**
   * সব খাতার তালিকা — পেজিনেশন, ফিল্টার ও তারিখ রেঞ্জ সহ
   */
  static async getAllKhatas(query: KhataQueryDto) {
    const { page, limit, branchId, writerId, status, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.KhataWhereInput = {};

    if (branchId) where.branchId = branchId;
    if (writerId) where.writerId = writerId;
    if (status) where.status = status;

    if (fromDate || toDate) {
      where.distributedAt = {};
      if (fromDate) where.distributedAt.gte = new Date(fromDate);
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        where.distributedAt.lte = to;
      }
    }

    const [total, rawKhatas] = await Promise.all([
      prisma.khata.count({ where }),
      prisma.khata.findMany({
        where,
        skip,
        take: limit,
        orderBy: { distributedAt: 'desc' },
        include: {
          branch: { select: { id: true, name: true } },
          writer: { select: { id: true, name: true, phone: true, ratePerKhata: true } },
        },
      }),
    ]);

    // প্রতিটি খাতায় pendingQty কম্পিউট করে পাঠানো এবং Decimal স্ট্রিং ফরম্যাটিং
    const khatas = rawKhatas.map((k) => ({
      ...k,
      writer: {
        ...k.writer,
        ratePerKhata: formatMoneyString(k.writer.ratePerKhata),
      },
      pendingQty: Math.max(0, k.receivedQty - k.submittedQty),
    }));

    return {
      khatas,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * একটি নির্দিষ্ট খাতার বিস্তারিত তথ্য
   */
  static async getKhataById(id: string) {
    const khata = await prisma.khata.findUnique({
      where: { id },
      include: {
        branch: true,
        writer: true,
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
        paymentItems: {
          include: {
            payment: {
              select: {
                id: true,
                paymentDate: true,
                status: true,
                amount: true,
                paidAmount: true,
              },
            },
          },
        },
      },
    });

    if (!khata) {
      throw ApiError.notFound(`Khata record not found with ID: ${id}`);
    }

    return {
      ...khata,
      writer: {
        ...khata.writer,
        ratePerKhata: formatMoneyString(khata.writer.ratePerKhata),
      },
      payments: khata.payments.map((p) => ({
        ...p,
        amount: formatMoneyString(p.amount),
        paidAmount: formatMoneyString(p.paidAmount),
        dueAmount: formatMoneyString(p.dueAmount),
      })),
      paymentItems: khata.paymentItems.map((item) => ({
        ...item,
        amount: formatMoneyString(item.amount),
        payment: item.payment
          ? {
              ...item.payment,
              amount: formatMoneyString(item.payment.amount),
              paidAmount: formatMoneyString(item.payment.paidAmount),
            }
          : undefined,
      })),
      pendingQty: Math.max(0, khata.receivedQty - khata.submittedQty),
    };
  }

  /**
   * খাতা জমা দেওয়ার মূল বিজনেস লজিক (Atomic Transaction সহ)
   */
  static async submitKhata(id: string, dto: SubmitKhataDto, userId: string) {
    const khata = await prisma.khata.findUnique({
      where: { id },
    });

    if (!khata) {
      throw ApiError.notFound(`Khata record not found with ID: ${id}`);
    }

    // পূর্বে থেকেই কাজ সম্পন্ন হয়ে থাকলে আর জমা নেওয়া হবে না
    if (khata.status === 'COMPLETED' || khata.submittedQty >= khata.receivedQty) {
      throw ApiError.badRequest(
        `Khata '${khata.batchNumber}' is already fully completed (${khata.submittedQty}/${khata.receivedQty} submitted). No more submissions can be accepted.`
      );
    }

    const newSubmittedQty = khata.submittedQty + dto.submittedQty;
    const currentPending = khata.receivedQty - khata.submittedQty;

    // মোট প্রাপ্ত খাতার বেশি জমা হতে পারবে না
    if (newSubmittedQty > khata.receivedQty) {
      throw ApiError.badRequest(
        `Cannot submit ${dto.submittedQty} khatas. Only ${currentPending} khata(s) are pending (Received: ${khata.receivedQty}, Already Submitted: ${khata.submittedQty}).`
      );
    }

    const isCompleted = newSubmittedQty === khata.receivedQty;
    const newStatus: KhataStatus = isCompleted ? 'COMPLETED' : 'PARTIALLY_SUBMITTED';

    // ট্রানজ্যাকশনে আপডেট ও অডিট লগ
    return await prisma.$transaction(async (tx) => {
      const updatedKhata = await tx.khata.update({
        where: { id },
        data: {
          submittedQty: newSubmittedQty,
          status: newStatus,
          submittedAt: isCompleted ? new Date() : khata.submittedAt,
        },
        include: {
          branch: { select: { id: true, name: true } },
          writer: { select: { id: true, name: true, phone: true, ratePerKhata: true } },
        },
      });

      // অডিট লগ সংরক্ষণ
      await tx.auditLog.create({
        data: {
          userId,
          action: 'SUBMIT_KHATA',
          entityType: 'Khata',
          entityId: id,
          details: {
            batchNumber: khata.batchNumber,
            previousSubmittedQty: khata.submittedQty,
            submittedNow: dto.submittedQty,
            newSubmittedQty,
            remainingPendingQty: khata.receivedQty - newSubmittedQty,
            previousStatus: khata.status,
            newStatus,
            isCompleted,
          },
        },
      });

      return {
        ...updatedKhata,
        writer: {
          ...updatedKhata.writer,
          ratePerKhata: formatMoneyString(updatedKhata.writer.ratePerKhata),
        },
        pendingQty: Math.max(0, updatedKhata.receivedQty - updatedKhata.submittedQty),
      };
    });
  }

  /**
   * খাতা তথ্য আপডেট (batchNumber বা receivedQty) - Atomic Transaction সহ
   */
  static async updateKhata(id: string, dto: UpdateKhataDto, userId: string) {
    const khata = await prisma.khata.findUnique({
      where: { id },
    });

    if (!khata) {
      throw ApiError.notFound(`Khata record not found with ID: ${id}`);
    }

    // বিজনেস রুল: যদি ইতিমধ্যে কোনো খাতা জমা হয়ে থাকে (submittedQty > 0), তবে receivedQty পরিবর্তন করা যাবে না
    if (dto.receivedQty !== undefined && dto.receivedQty !== khata.receivedQty) {
      if (khata.submittedQty > 0) {
        throw ApiError.badRequest(
          `Cannot modify receivedQty because ${khata.submittedQty} khata(s) have already been submitted. Received quantity can only be updated when submitted count is 0.`
        );
      }
    }

    // ব্যাচ নম্বর পরিবর্তন করলে নতুন ব্যাচ নম্বরের ইউনিকনেস চেক
    if (dto.batchNumber && dto.batchNumber.trim() !== khata.batchNumber) {
      const duplicate = await prisma.khata.findFirst({
        where: {
          id: { not: id },
          batchNumber: dto.batchNumber.trim(),
        },
      });

      if (duplicate) {
        throw ApiError.conflict(`Khata with batch number '${dto.batchNumber}' already exists`);
      }
    }

    return await prisma.$transaction(async (tx) => {
      const updatedKhata = await tx.khata.update({
        where: { id },
        data: {
          batchNumber: dto.batchNumber?.trim(),
          receivedQty: dto.receivedQty,
        },
        include: {
          branch: { select: { id: true, name: true } },
          writer: { select: { id: true, name: true, ratePerKhata: true } },
        },
      });

      // অডিট লগ
      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE_KHATA',
          entityType: 'Khata',
          entityId: id,
          details: {
            before: {
              batchNumber: khata.batchNumber,
              receivedQty: khata.receivedQty,
            },
            after: {
              batchNumber: updatedKhata.batchNumber,
              receivedQty: updatedKhata.receivedQty,
            },
          },
        },
      });

      return {
        ...updatedKhata,
        writer: {
          ...updatedKhata.writer,
          ratePerKhata: formatMoneyString(updatedKhata.writer.ratePerKhata),
        },
        pendingQty: Math.max(0, updatedKhata.receivedQty - updatedKhata.submittedQty),
      };
    });
  }

  /**
   * খাতা ডিলিট করা (Atomic Transaction সহ)
   */
  static async deleteKhata(id: string, userId: string) {
    const khata = await prisma.khata.findUnique({
      where: { id },
    });

    if (!khata) {
      throw ApiError.notFound(`Khata record not found with ID: ${id}`);
    }

    // বিজনেস রুল: কোনো খাতা জমা হয়ে থাকলে তা ডিলিট করা যাবে না
    if (khata.submittedQty > 0) {
      throw ApiError.badRequest(
        `Cannot delete khata '${khata.batchNumber}': ${khata.submittedQty} khata(s) have already been submitted. Khatas can only be deleted if no submissions have occurred.`
      );
    }

    // যদি পেমেন্ট রেকর্ড যুক্ত থাকে
    const [paymentsCount, paymentItemsCount] = await Promise.all([
      prisma.payment.count({ where: { khataId: id } }),
      prisma.paymentItem.count({ where: { khataId: id } }),
    ]);

    if (paymentsCount > 0 || paymentItemsCount > 0) {
      throw ApiError.badRequest(
        `Cannot delete khata '${khata.batchNumber}': Associated payment record(s) exist. Please remove or reassign payments first.`
      );
    }

    return await prisma.$transaction(async (tx) => {
      await tx.khata.delete({
        where: { id },
      });

      // অডিট লগ
      await tx.auditLog.create({
        data: {
          userId,
          action: 'DELETE_KHATA',
          entityType: 'Khata',
          entityId: id,
          details: {
            deletedBatchNumber: khata.batchNumber,
            receivedQty: khata.receivedQty,
            deletedAt: new Date().toISOString(),
          },
        },
      });

      return { id, batchNumber: khata.batchNumber };
    });
  }

  /**
   * একটি নির্দিষ্ট ব্রাঞ্চের সব খাতার সামারি স্ট্যাটিস্টিকস
   */
  static async getBranchKhataSummary(branchId: string): Promise<BranchKhataSummary> {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, name: true },
    });

    if (!branch) {
      throw ApiError.notFound(`Branch not found with ID: ${branchId}`);
    }

    const [
      totalKhatas,
      distributedCount,
      partiallySubmittedCount,
      completedCount,
      aggregateQty,
    ] = await Promise.all([
      prisma.khata.count({ where: { branchId } }),
      prisma.khata.count({ where: { branchId, status: 'DISTRIBUTED' } }),
      prisma.khata.count({ where: { branchId, status: 'PARTIALLY_SUBMITTED' } }),
      prisma.khata.count({ where: { branchId, status: 'COMPLETED' } }),
      prisma.khata.aggregate({
        where: { branchId },
        _sum: {
          receivedQty: true,
          submittedQty: true,
        },
      }),
    ]);

    const totalReceived = aggregateQty._sum.receivedQty ?? 0;
    const totalSubmitted = aggregateQty._sum.submittedQty ?? 0;
    const totalPending = Math.max(0, totalReceived - totalSubmitted);

    return {
      branchId: branch.id,
      branchName: branch.name,
      totalKhatas,
      totalReceived,
      totalSubmitted,
      totalPending,
      byStatus: {
        distributed: distributedCount,
        partiallySubmitted: partiallySubmittedCount,
        completed: completedCount,
      },
    };
  }
}

export default KhataService;
