import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma, Decimal } from '../src/lib/prisma.js';
import { ClassService } from '../src/modules/class/class.service.js';
import { SubjectService } from '../src/modules/subject/subject.service.js';
import { OrderService } from '../src/modules/order/order.service.js';
import { normalizeName } from '../src/modules/class/class.types.js';

describe('AcademicClass and Subject Module Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Name Normalization & Case-Insensitive Duplicate Prevention', () => {
    it('normalizes string by trimming and collapsing multiple spaces into a single space', () => {
      expect(normalizeName('  HSC   ')).toBe('HSC');
      expect(normalizeName('  Higher    Mathematics   ')).toBe('Higher Mathematics');
      expect(normalizeName('General      Science')).toBe('General Science');
    });

    it('blocks duplicate class creation when names differ only by case ("HSC" vs "hsc")', async () => {
      vi.spyOn(prisma.academicClass, 'findFirst').mockResolvedValue({
        id: 'existing-class-1',
        name: 'HSC',
        displayOrder: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      await expect(
        ClassService.createClass({ name: 'hsc', displayOrder: 1, isActive: true }, 'admin-id')
      ).rejects.toThrow(/already exists/i);
    });

    it('blocks duplicate subject creation when names differ only by case ("Physics" vs "physics")', async () => {
      vi.spyOn(prisma.subject, 'findFirst').mockResolvedValue({
        id: 'existing-subject-1',
        name: 'Physics',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      await expect(
        SubjectService.createSubject({ name: 'physics', isActive: true }, 'admin-id')
      ).rejects.toThrow(/already exists/i);
    });
  });

  describe('2. Safe Deletion & Dependency Blocking with Meaningful Message', () => {
    it('blocks deleting an AcademicClass if any SubjectPricing is linked to it, instructing to deactivate instead', async () => {
      const classId = 'class-with-pricing';
      vi.spyOn(prisma.academicClass, 'findUnique').mockResolvedValue({
        id: classId,
        name: 'HSC',
        displayOrder: 1,
        isActive: true,
        _count: { subjectPricings: 3 }, // 3 subject pricings linked!
      } as any);

      await expect(
        ClassService.deleteClass(classId, 'super-admin-id')
      ).rejects.toThrow(/মুছবেন না, deactivate করুন/);
    });

    it('blocks deleting a Subject if any SubjectPricing is linked to it, instructing to deactivate instead', async () => {
      const subjectId = 'subject-with-pricing';
      vi.spyOn(prisma.subject, 'findUnique').mockResolvedValue({
        id: subjectId,
        name: 'Chemistry',
        isActive: true,
        _count: { subjectPricings: 2 }, // 2 subject pricings linked!
      } as any);

      await expect(
        SubjectService.deleteSubject(subjectId, 'super-admin-id')
      ).rejects.toThrow(/মুছবেন না, deactivate করুন/);
    });

    it('allows deleting an AcademicClass when no SubjectPricing is linked', async () => {
      const classId = 'clean-class-id';
      vi.spyOn(prisma.academicClass, 'findUnique').mockResolvedValue({
        id: classId,
        name: 'Unused Class',
        displayOrder: 10,
        isActive: false,
        _count: { subjectPricings: 0 },
      } as any);

      let deleted = false;
      let auditLogged = false;

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const txMock = {
          academicClass: {
            delete: vi.fn().mockImplementation(async () => {
              deleted = true;
              return {};
            }),
          },
          auditLog: {
            create: vi.fn().mockImplementation(async () => {
              auditLogged = true;
              return {};
            }),
          },
        };
        return await callback(txMock);
      });

      const res = await ClassService.deleteClass(classId, 'super-admin-id');
      expect(deleted).toBe(true);
      expect(auditLogged).toBe(true);
      expect(res.message).toMatch(/deleted successfully/i);
    });
  });

  describe('3. Public Endpoints Filter Inactive Items', () => {
    it('returns only active classes sorted by displayOrder', async () => {
      const activeClassesMock = [
        { id: 'c-1', name: 'JSC', displayOrder: 1, isActive: true },
        { id: 'c-2', name: 'SSC', displayOrder: 2, isActive: true },
        { id: 'c-3', name: 'HSC', displayOrder: 3, isActive: true },
      ];

      const findManySpy = vi.spyOn(prisma.academicClass, 'findMany').mockResolvedValue(activeClassesMock as any);

      const result = await ClassService.getActiveClasses();

      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
          orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        })
      );
      expect(result).toHaveLength(3);
      expect(result.map((c) => c.name)).toEqual(['JSC', 'SSC', 'HSC']);
    });

    it('excludes pricings belonging to inactive class or inactive subject in public subject pricing', async () => {
      const findManySpy = vi.spyOn(prisma.subjectPricing, 'findMany').mockResolvedValue([
        {
          id: 'sp-1',
          classId: 'c-1',
          subjectId: 's-1',
          pricePerKhata: new Decimal('120.00'),
          isActive: true,
          class: { id: 'c-1', name: 'HSC', displayOrder: 3, isActive: true },
          subject: { id: 's-1', name: 'Physics', isActive: true },
        },
      ] as any);

      const pricings = await OrderService.getActiveSubjectPricings();

      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            class: { isActive: true },
            subject: { isActive: true },
          }),
        })
      );

      expect(pricings).toHaveLength(1);
      // Checks backward-compatible flat fields
      expect(pricings[0]?.className).toBe('HSC');
      expect(pricings[0]?.subjectName).toBe('Physics');
      expect(pricings[0]?.classId).toBe('c-1');
      expect(pricings[0]?.subjectId).toBe('s-1');
      expect(pricings[0]?.pricePerKhata).toBe('120.00');
    });

    it('filters public subject pricing by classId when query parameter is provided', async () => {
      const findManySpy = vi.spyOn(prisma.subjectPricing, 'findMany').mockResolvedValue([] as any);

      await OrderService.getActiveSubjectPricings('class-hsc-id');

      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            classId: 'class-hsc-id',
            isActive: true,
            class: { isActive: true },
            subject: { isActive: true },
          }),
        })
      );
    });
  });
});
