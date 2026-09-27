import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type {
  CreateWriterDto,
  UpdateWriterDto,
  WriterQueryDto,
  KhataHistoryQueryDto,
  PaymentHistoryQueryDto,
  WriterDetails,
  WriterKhataSummary,
  WriterPaymentSummary,
} from './writer.types.js';

/**
 * লেখক (Writer) সার্ভিস — কোর বিজনেস লজিক, এগ্রিগেশন ও অডিট ট্র্যাকিং
 */
export class WriterService {
  /**
   * নতুন লেখক তৈরি করা
   */
  static async createWriter(dto: CreateWriterDto, userId: string) {
    // ১. ব্রাঞ্চ আইডি ভ্যালিড এবং একটিভ কি না যাচাই
    const branch = await prisma.branch.findUnique({
      where: { id: dto.branchId },
    });

    if (!branch) {
      throw ApiError.notFound(`Branch not found with ID: ${dto.branchId}`);
    }

    if (!branch.isActive) {
      throw ApiError.badRequest(`Cannot assign writer to an inactive branch ('${branch.name}')`);
    }

    // ২. একই ফোন নম্বরের লেখক ইতিমধ্যে আছে কি না চেক
    const existingWriter = await prisma.writer.findFirst({
      where: { phone: dto.phone.trim() },
    });

    if (existingWriter) {
      throw ApiError.conflict(`Writer with phone number '${dto.phone}' already exists`);
    }

    // ৩. নতুন লেখক তৈরি
    const writer = await prisma.writer.create({
      data: {
        name: dto.name.trim(),
        phone: dto.phone.trim(),
        email: dto.email?.trim() || null,
        district: dto.district || 'Dhaka',
        branchId: dto.branchId,
        ratePerKhata: dto.ratePerKhata,
      },
      include: {
        branch: {
          select: { id: true, name: true },
        },
      },
    });

    // ৪. অডিট লগ তৈরি
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CREATE_WRITER',
        entityType: 'Writer',
        entityId: writer.id,
        details: {
          name: writer.name,
          phone: writer.phone,
          branchId: writer.branchId,
          ratePerKhata: Number(writer.ratePerKhata),
        },
      },
    });

    return writer;
  }

  /**
   * সব লেখকের তালিকা — পেজিনেশন, ব্রাঞ্চ ফিল্টারিং, স্ট্যাটাস ফিল্টারিং ও সার্চ সহ
   */
  static async getAllWriters(query: WriterQueryDto) {
    const { page, limit, search, branchId, isActive } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.WriterWhereInput = {};

    if (branchId) {
      where.branchId = branchId;
    }

    if (query.district) {
      where.district = query.district;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      const searchTrimmed = search.trim();
      where.OR = [
        { name: { contains: searchTrimmed, mode: 'insensitive' } },
        { phone: { contains: searchTrimmed } },
      ];
    }

    const [total, writers] = await Promise.all([
      prisma.writer.count({ where }),
      prisma.writer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          branch: {
            select: { id: true, name: true, phone: true },
          },
          _count: {
            select: {
              khatas: true,
              payments: true,
            },
          },
        },
      }),
    ]);

    return {
      writers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * একজন লেখকের বিস্তারিত প্রোফাইল, সাথে খাতা ও পেমেন্ট এগ্রিগেশন পরিসংখ্যান
   */
  static async getWriterById(id: string): Promise<WriterDetails> {
    const writer = await prisma.writer.findUnique({
      where: { id },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
            isActive: true,
          },
        },
      },
    });

    if (!writer) {
      throw ApiError.notFound(`Writer not found with ID: ${id}`);
    }

    // খাতা পরিসংখ্যান এগ্রিগেশন
    const [
      totalKhatas,
      distributedKhatas,
      partiallySubmittedKhatas,
      completedKhatas,
      khatasAggregate,
    ] = await Promise.all([
      prisma.khata.count({ where: { writerId: id } }),
      prisma.khata.count({ where: { writerId: id, status: 'DISTRIBUTED' } }),
      prisma.khata.count({ where: { writerId: id, status: 'PARTIALLY_SUBMITTED' } }),
      prisma.khata.count({ where: { writerId: id, status: 'COMPLETED' } }),
      prisma.khata.aggregate({
        where: { writerId: id },
        _sum: {
          receivedQty: true,
          submittedQty: true,
        },
      }),
    ]);

    const totalReceived = khatasAggregate._sum.receivedQty ?? 0;
    const totalSubmitted = khatasAggregate._sum.submittedQty ?? 0;
    const totalPending = totalReceived - totalSubmitted;

    const khataSummary: WriterKhataSummary = {
      totalKhatas,
      totalReceivedQty: totalReceived,
      totalSubmittedQty: totalSubmitted,
      totalPendingQty: Math.max(0, totalPending),
      byStatus: {
        distributed: distributedKhatas,
        partiallySubmitted: partiallySubmittedKhatas,
        completed: completedKhatas,
      },
    };

    // পেমেন্ট পরিসংখ্যান এগ্রিগেশন
    const [paidPayments, partialPayments, duePayments, paymentsAggregate] =
      await Promise.all([
        prisma.payment.count({ where: { writerId: id, status: 'PAID' } }),
        prisma.payment.count({ where: { writerId: id, status: 'PARTIAL' } }),
        prisma.payment.count({ where: { writerId: id, status: 'DUE' } }),
        prisma.payment.aggregate({
          where: { writerId: id },
          _sum: {
            amount: true,
            paidAmount: true,
            dueAmount: true,
          },
        }),
      ]);

    const paymentSummary: WriterPaymentSummary = {
      totalBillAmount: Number(paymentsAggregate._sum.amount ?? 0),
      totalPaidAmount: Number(paymentsAggregate._sum.paidAmount ?? 0),
      totalDueAmount: Number(paymentsAggregate._sum.dueAmount ?? 0),
      byStatus: {
        paid: paidPayments,
        partial: partialPayments,
        due: duePayments,
      },
    };

    return {
      id: writer.id,
      name: writer.name,
      phone: writer.phone,
      email: writer.email,
      district: writer.district,
      ratePerKhata: Number(writer.ratePerKhata),
      isActive: writer.isActive,
      branch: writer.branch,
      khataSummary,
      paymentSummary,
      createdAt: writer.createdAt,
      updatedAt: writer.updatedAt,
    };
  }

  /**
   * লেখক তথ্য আপডেট করা
   */
  static async updateWriter(id: string, dto: UpdateWriterDto, userId: string) {
    const existingWriter = await prisma.writer.findUnique({
      where: { id },
    });

    if (!existingWriter) {
      throw ApiError.notFound(`Writer not found with ID: ${id}`);
    }

    // যদি ব্রাঞ্চ পরিবর্তন করা হয়, নতুন ব্রাঞ্চ অস্তিত্ব ও একটিভ কি না যাচাই
    if (dto.branchId && dto.branchId !== existingWriter.branchId) {
      const newBranch = await prisma.branch.findUnique({
        where: { id: dto.branchId },
      });

      if (!newBranch) {
        throw ApiError.notFound(`Target branch not found with ID: ${dto.branchId}`);
      }

      if (!newBranch.isActive) {
        throw ApiError.badRequest(`Cannot move writer to an inactive branch ('${newBranch.name}')`);
      }
    }

    // যদি ফোন পরিবর্তন করা হয়, তবে অন্য কোনো লেখকের সাথে সংঘর্ষ হয় কি না যাচাই
    if (dto.phone && dto.phone.trim() !== existingWriter.phone) {
      const duplicatePhone = await prisma.writer.findFirst({
        where: {
          id: { not: id },
          phone: dto.phone.trim(),
        },
      });

      if (duplicatePhone) {
        throw ApiError.conflict(`Another writer with phone number '${dto.phone}' already exists`);
      }
    }

    const updatedWriter = await prisma.writer.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        phone: dto.phone?.trim(),
        email: dto.email !== undefined ? dto.email?.trim() || null : undefined,
        district: dto.district,
        branchId: dto.branchId,
        ratePerKhata: dto.ratePerKhata,
        isActive: dto.isActive,
      },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });

    // অডিট লগ
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'UPDATE_WRITER',
        entityType: 'Writer',
        entityId: id,
        details: {
          before: {
            name: existingWriter.name,
            phone: existingWriter.phone,
            email: existingWriter.email,
            ratePerKhata: Number(existingWriter.ratePerKhata),
            branchId: existingWriter.branchId,
            isActive: existingWriter.isActive,
          },
          after: {
            name: updatedWriter.name,
            phone: updatedWriter.phone,
            email: updatedWriter.email,
            ratePerKhata: Number(updatedWriter.ratePerKhata),
            branchId: updatedWriter.branchId,
            isActive: updatedWriter.isActive,
          },
        },
      },
    });

    return updatedWriter;
  }

  /**
   * লেখক স্ট্যাটাস টগল (isActive)
   */
  static async toggleWriterStatus(id: string, userId: string) {
    const existingWriter = await prisma.writer.findUnique({
      where: { id },
    });

    if (!existingWriter) {
      throw ApiError.notFound(`Writer not found with ID: ${id}`);
    }

    const newStatus = !existingWriter.isActive;

    const updatedWriter = await prisma.writer.update({
      where: { id },
      data: { isActive: newStatus },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });

    // অডিট লগ
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'TOGGLE_WRITER_STATUS',
        entityType: 'Writer',
        entityId: id,
        details: {
          previousStatus: existingWriter.isActive,
          newStatus: updatedWriter.isActive,
        },
      },
    });

    return updatedWriter;
  }

  /**
   * লেখক ডিলিট করা (পেন্ডিং খাতা বা বকেয়া পেমেন্ট থাকলে সুরক্ষিতভাবে ব্লক করা হবে)
   */
  static async deleteWriter(id: string, userId: string) {
    const existingWriter = await prisma.writer.findUnique({
      where: { id },
    });

    if (!existingWriter) {
      throw ApiError.notFound(`Writer not found with ID: ${id}`);
    }

    // ১. লেখকের কোনো কাজ চলমান/পেন্ডিং খাতা আছে কি না চেক
    const activeKhatasCount = await prisma.khata.count({
      where: {
        writerId: id,
        status: { not: 'COMPLETED' },
      },
    });

    if (activeKhatasCount > 0) {
      throw ApiError.badRequest(
        `Cannot delete writer '${existingWriter.name}': Writer currently has ${activeKhatasCount} uncompleted/pending khata(s). Please submit or reassign all khatas before deletion.`
      );
    }

    // ২. লেখকের কোনো বকেয়া পেমেন্ট আছে কি না চেক
    const duePaymentsAggregate = await prisma.payment.aggregate({
      where: {
        writerId: id,
        dueAmount: { gt: 0 },
      },
      _sum: { dueAmount: true },
      _count: true,
    });

    const totalDue = Number(duePaymentsAggregate._sum.dueAmount ?? 0);
    if (duePaymentsAggregate._count > 0 && totalDue > 0) {
      throw ApiError.badRequest(
        `Cannot delete writer '${existingWriter.name}': Writer has ${duePaymentsAggregate._count} pending payment record(s) with an unpaid due of BDT ${totalDue}. Please clear all dues before deleting.`
      );
    }

    // ৩. লেখকের পূর্বের সমাপ্ত খাতা বা পরিশোধিত পেমেন্ট রেকর্ড থাকলে আর্থিক ডেটা অক্ষুণ্ণ রাখা
    const [totalKhatas, totalPayments] = await Promise.all([
      prisma.khata.count({ where: { writerId: id } }),
      prisma.payment.count({ where: { writerId: id } }),
    ]);

    if (totalKhatas > 0 || totalPayments > 0) {
      throw ApiError.badRequest(
        `Cannot delete writer '${existingWriter.name}': Writer contains historical accounting records (${totalKhatas} khata(s) and ${totalPayments} payment record(s)). To protect financial audit history, please deactivate the writer (isActive: false) instead of permanently deleting.`
      );
    }

    // ৪. সম্পূর্ণ পরিচ্ছন্ন থাকলে ডেটাবেজ থেকে মোছা
    await prisma.writer.delete({
      where: { id },
    });

    // অডিট লগ
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'DELETE_WRITER',
        entityType: 'Writer',
        entityId: id,
        details: {
          deletedWriterName: existingWriter.name,
          deletedAt: new Date().toISOString(),
        },
      },
    });

    return { id, name: existingWriter.name };
  }

  /**
   * একজন লেখকের খাতা হিস্টোরি (তারিখ অনুযায়ী সাজানো ও পেজিনেশন সহ)
   */
  static async getWriterKhataHistory(writerId: string, query: KhataHistoryQueryDto) {
    // লেখক অস্তিত্ব চেক
    const writer = await prisma.writer.findUnique({
      where: { id: writerId },
      select: { id: true, name: true },
    });

    if (!writer) {
      throw ApiError.notFound(`Writer not found with ID: ${writerId}`);
    }

    const { page, limit, status } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.KhataWhereInput = {
      writerId,
      ...(status && { status }),
    };

    const [total, rawKhatas] = await Promise.all([
      prisma.khata.count({ where }),
      prisma.khata.findMany({
        where,
        skip,
        take: limit,
        orderBy: { distributedAt: 'desc' },
        include: {
          branch: { select: { id: true, name: true } },
        },
      }),
    ]);

    // অ্যাপ্লিকেশন লেভেলে pendingQty ক্যালকুলেশন
    const khatas = rawKhatas.map((k) => ({
      ...k,
      pendingQty: Math.max(0, k.receivedQty - k.submittedQty),
    }));

    return {
      writer,
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
   * একজন লেখকের পেমেন্ট হিস্টোরি (তারিখ অনুযায়ী সাজানো ও পেজিনেশন সহ)
   */
  static async getWriterPaymentHistory(writerId: string, query: PaymentHistoryQueryDto) {
    // লেখক অস্তিত্ব চেক
    const writer = await prisma.writer.findUnique({
      where: { id: writerId },
      select: { id: true, name: true },
    });

    if (!writer) {
      throw ApiError.notFound(`Writer not found with ID: ${writerId}`);
    }

    const { page, limit, status } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentWhereInput = {
      writerId,
      ...(status && { status }),
    };

    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { paymentDate: 'desc' },
        include: {
          khata: {
            select: { id: true, batchNumber: true, status: true },
          },
          paymentItems: {
            include: {
              khata: { select: { id: true, batchNumber: true } },
            },
          },
        },
      }),
    ]);

    return {
      writer,
      payments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}

export default WriterService;
