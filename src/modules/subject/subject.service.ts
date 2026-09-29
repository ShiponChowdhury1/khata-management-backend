import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { CreateSubjectDto, UpdateSubjectDto, SubjectQueryDto } from './subject.types.js';

export class SubjectService {
  /**
   * ১. নতুন বিষয় তৈরি করা (Case-insensitive ডুপ্লিকেট চেক ও AuditLog সহ)
   */
  static async createSubject(dto: CreateSubjectDto, userId: string) {
    const existing = await prisma.subject.findFirst({
      where: {
        name: { equals: dto.name, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw ApiError.conflict(`A subject with the name '${dto.name}' already exists`);
    }

    return await prisma.$transaction(async (tx) => {
      const created = await tx.subject.create({
        data: {
          name: dto.name,
          isActive: dto.isActive ?? true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE_SUBJECT',
          entityType: 'Subject',
          entityId: created.id,
          details: {
            name: created.name,
            isActive: created.isActive,
          },
        },
      });

      return created;
    });
  }

  /**
   * ২. সব বিষয়ের তালিকা (পেজিনেশন, সার্চ ও ফিল্টারিং সহ)
   */
  static async getAllSubjects(query: SubjectQueryDto) {
    const { page, limit, search, isActive } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.SubjectWhereInput = {};
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [total, subjects] = await Promise.all([
      prisma.subject.count({ where }),
      prisma.subject.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { subjectPricings: true },
          },
        },
      }),
    ]);

    return {
      subjects,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * ৩. পাবলিক ভিউ: শুধু সক্রিয় বিষয় তালিকা
   */
  static async getActiveSubjects() {
    return await prisma.subject.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });
  }

  /**
   * ৪. একটি নির্দিষ্ট বিষয়ের বিবরণ
   */
  static async getSubjectById(id: string) {
    const subject = await prisma.subject.findUnique({
      where: { id },
      include: {
        subjectPricings: {
          include: {
            class: true,
          },
        },
      },
    });

    if (!subject) {
      throw ApiError.notFound(`Subject not found with ID: ${id}`);
    }

    return subject;
  }

  /**
   * ৫. বিষয় আপডেট করা
   */
  static async updateSubject(id: string, dto: UpdateSubjectDto, userId: string) {
    const subject = await prisma.subject.findUnique({ where: { id } });
    if (!subject) {
      throw ApiError.notFound(`Subject not found with ID: ${id}`);
    }

    if (dto.name && dto.name.toLowerCase() !== subject.name.toLowerCase()) {
      const conflict = await prisma.subject.findFirst({
        where: {
          name: { equals: dto.name, mode: 'insensitive' },
          id: { not: id },
        },
      });

      if (conflict) {
        throw ApiError.conflict(`A subject with the name '${dto.name}' already exists`);
      }
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.subject.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE_SUBJECT',
          entityType: 'Subject',
          entityId: updated.id,
          details: {
            previous: {
              name: subject.name,
              isActive: subject.isActive,
            },
            updated: {
              name: updated.name,
              isActive: updated.isActive,
            },
          },
        },
      });

      return updated;
    });
  }

  /**
   * ৬. বিষয়ের স্ট্যাটাস টগল (Active/Inactive)
   */
  static async toggleSubjectStatus(id: string, userId: string) {
    const subject = await prisma.subject.findUnique({ where: { id } });
    if (!subject) {
      throw ApiError.notFound(`Subject not found with ID: ${id}`);
    }

    const newStatus = !subject.isActive;

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.subject.update({
        where: { id },
        data: { isActive: newStatus },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'TOGGLE_SUBJECT_STATUS',
          entityType: 'Subject',
          entityId: updated.id,
          details: {
            name: updated.name,
            isActive: newStatus,
          },
        },
      });

      return updated;
    });
  }

  /**
   * ৭. বিষয় মুছে ফেলা (SubjectPricing যুক্ত থাকলে ব্লক করা)
   */
  static async deleteSubject(id: string, userId: string) {
    const subject = await prisma.subject.findUnique({
      where: { id },
      include: {
        _count: {
          select: { subjectPricings: true },
        },
      },
    });

    if (!subject) {
      throw ApiError.notFound(`Subject not found with ID: ${id}`);
    }

    if (subject._count.subjectPricings > 0) {
      throw ApiError.badRequest(
        'এই সাবজেক্টের সাথে সাবজেক্ট প্রাইসিং যুক্ত আছে। এটি মুছবেন না, deactivate করুন (Cannot delete subject with linked subject pricing. Please deactivate instead).'
      );
    }

    return await prisma.$transaction(async (tx) => {
      await tx.subject.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'DELETE_SUBJECT',
          entityType: 'Subject',
          entityId: id,
          details: {
            deletedSubjectName: subject.name,
          },
        },
      });

      return {
        message: `Subject '${subject.name}' deleted successfully`,
      };
    });
  }
}
