import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { CreateClassDto, UpdateClassDto, ClassQueryDto } from './class.types.js';

export class ClassService {
  /**
   * ১. নতুন ক্লাস তৈরি করা (Case-insensitive ডুপ্লিকেট চেক ও AuditLog সহ)
   */
  static async createClass(dto: CreateClassDto, userId: string) {
    const existing = await prisma.academicClass.findFirst({
      where: {
        name: { equals: dto.name, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw ApiError.conflict(`A class with the name '${dto.name}' already exists`);
    }

    return await prisma.$transaction(async (tx) => {
      const created = await tx.academicClass.create({
        data: {
          name: dto.name,
          displayOrder: dto.displayOrder ?? 0,
          isActive: dto.isActive ?? true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE_CLASS',
          entityType: 'AcademicClass',
          entityId: created.id,
          details: {
            name: created.name,
            displayOrder: created.displayOrder,
            isActive: created.isActive,
          },
        },
      });

      return created;
    });
  }

  /**
   * ২. সব ক্লাসের তালিকা (পেজিনেশন, সার্চ, ফিল্টারিং ও displayOrder অনুযায়ী সাজানো)
   */
  static async getAllClasses(query: ClassQueryDto) {
    const { page, limit, search, isActive } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AcademicClassWhereInput = {};
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [total, classes] = await Promise.all([
      prisma.academicClass.count({ where }),
      prisma.academicClass.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        include: {
          _count: {
            select: { subjectPricings: true },
          },
        },
      }),
    ]);

    return {
      classes,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * ৩. পাবলিক ভিউ: শুধু সক্রিয় ক্লাস তালিকা (displayOrder অনুযায়ী)
   */
  static async getActiveClasses() {
    return await prisma.academicClass.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        displayOrder: true,
        isActive: true,
      },
    });
  }

  /**
   * ৪. একটি নির্দিষ্ট ক্লাসের বিবরণ
   */
  static async getClassById(id: string) {
    const academicClass = await prisma.academicClass.findUnique({
      where: { id },
      include: {
        subjectPricings: {
          include: {
            subject: true,
          },
        },
      },
    });

    if (!academicClass) {
      throw ApiError.notFound(`Academic class not found with ID: ${id}`);
    }

    return academicClass;
  }

  /**
   * ৫. ক্লাস আপডেট করা
   */
  static async updateClass(id: string, dto: UpdateClassDto, userId: string) {
    const academicClass = await prisma.academicClass.findUnique({ where: { id } });
    if (!academicClass) {
      throw ApiError.notFound(`Academic class not found with ID: ${id}`);
    }

    if (dto.name && dto.name.toLowerCase() !== academicClass.name.toLowerCase()) {
      const conflict = await prisma.academicClass.findFirst({
        where: {
          name: { equals: dto.name, mode: 'insensitive' },
          id: { not: id },
        },
      });

      if (conflict) {
        throw ApiError.conflict(`A class with the name '${dto.name}' already exists`);
      }
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.academicClass.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE_CLASS',
          entityType: 'AcademicClass',
          entityId: updated.id,
          details: {
            previous: {
              name: academicClass.name,
              displayOrder: academicClass.displayOrder,
              isActive: academicClass.isActive,
            },
            updated: {
              name: updated.name,
              displayOrder: updated.displayOrder,
              isActive: updated.isActive,
            },
          },
        },
      });

      return updated;
    });
  }

  /**
   * ৬. ক্লাসের স্ট্যাটাস টগল (Active/Inactive)
   */
  static async toggleClassStatus(id: string, userId: string) {
    const academicClass = await prisma.academicClass.findUnique({ where: { id } });
    if (!academicClass) {
      throw ApiError.notFound(`Academic class not found with ID: ${id}`);
    }

    const newStatus = !academicClass.isActive;

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.academicClass.update({
        where: { id },
        data: { isActive: newStatus },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'TOGGLE_CLASS_STATUS',
          entityType: 'AcademicClass',
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
   * ৭. ক্লাস মুছে ফেলা (SubjectPricing যুক্ত থাকলে ব্লক করা)
   */
  static async deleteClass(id: string, userId: string) {
    const academicClass = await prisma.academicClass.findUnique({
      where: { id },
      include: {
        _count: {
          select: { subjectPricings: true },
        },
      },
    });

    if (!academicClass) {
      throw ApiError.notFound(`Academic class not found with ID: ${id}`);
    }

    if (academicClass._count.subjectPricings > 0) {
      throw ApiError.badRequest(
        'এই ক্লাসের সাথে সাবজেক্ট প্রাইসিং যুক্ত আছে। এটি মুছবেন না, deactivate করুন (Cannot delete class with linked subject pricing. Please deactivate instead).'
      );
    }

    return await prisma.$transaction(async (tx) => {
      await tx.academicClass.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'DELETE_CLASS',
          entityType: 'AcademicClass',
          entityId: id,
          details: {
            deletedClassName: academicClass.name,
          },
        },
      });

      return {
        message: `Class '${academicClass.name}' deleted successfully`,
      };
    });
  }
}
