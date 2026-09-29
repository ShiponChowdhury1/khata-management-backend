import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma, Decimal } from '../src/lib/prisma.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { UserService } from '../src/modules/user/user.service.js';
import { OrderService } from '../src/modules/order/order.service.js';
import { authenticate } from '../src/middlewares/auth.middleware.js';
import { allowedRoles } from '../src/middlewares/rbac.middleware.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { ApiError } from '../src/utils/apiError.js';
import bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';

describe('Security & User Management Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Register Security & RBAC Guard', () => {
    it('authenticates and blocks unauthenticated requests to register endpoint', async () => {
      const req = {
        headers: {},
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn() as unknown as NextFunction;

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = (next as any).mock.calls[0][0];
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(401);
      expect(err.message).toMatch(/Missing or invalid Bearer token/i);
    });

    it('blocks authenticated MANAGER or ADMIN from accessing SUPER_ADMIN-only routes', () => {
      const managerReq = {
        user: {
          userId: 'user-manager-1',
          name: 'Manager User',
          email: 'manager@example.com',
          role: 'MANAGER' as const,
        },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn() as unknown as NextFunction;

      const guard = allowedRoles('SUPER_ADMIN');
      guard(managerReq, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = (next as any).mock.calls[0][0];
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(403);
      expect(err.message).toMatch(/Forbidden/i);
    });

    it('allows SUPER_ADMIN to pass allowedRoles check', () => {
      const superAdminReq = {
        user: {
          userId: 'user-superadmin-1',
          name: 'Super Admin',
          email: 'admin@example.com',
          role: 'SUPER_ADMIN' as const,
        },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn() as unknown as NextFunction;

      const guard = allowedRoles('SUPER_ADMIN');
      guard(superAdminReq, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect((next as any).mock.calls[0][0]).toBeUndefined();
    });
  });

  describe('2. Deactivated User Security & Invalidation', () => {
    it('blocks deactivated user from logging in even with correct credentials', async () => {
      const hashedPassword = await bcrypt.hash('Secret123!', 6);
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'deactivated-user-id',
        name: 'Inactive User',
        email: 'inactive@example.com',
        password: hashedPassword,
        role: 'ADMIN',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      await expect(
        AuthService.login({
          email: 'inactive@example.com',
          password: 'Secret123!',
        })
      ).rejects.toThrow(/Your account is inactive/i);
    });

    it('invalidates existing JWT token on authenticate middleware if user is deactivated in database', async () => {
      const token = generateAccessToken({
        userId: 'user-to-deactivate',
        name: 'Previously Active',
        email: 'user@example.com',
        role: 'MANAGER',
      });

      // Database returns isActive = false
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'user-to-deactivate',
        isActive: false,
      } as any);

      const req = {
        headers: {
          authorization: `Bearer ${token}`,
        },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn() as unknown as NextFunction;

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = (next as any).mock.calls[0][0];
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(401);
      expect(err.message).toMatch(/account has been deactivated/i);
    });

    it('prevents a user from deactivating their own account', async () => {
      await expect(
        UserService.toggleUserStatus('current-user-id', 'current-user-id')
      ).rejects.toThrow('You cannot deactivate your own account');
    });

    it('prevents deactivating the only remaining active SUPER_ADMIN', async () => {
      const targetSuperAdminId = 'target-super-admin';
      const callerId = 'another-caller';

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: targetSuperAdminId,
        name: 'Solo Super Admin',
        email: 'solo@example.com',
        role: 'SUPER_ADMIN',
        isActive: true,
      } as any);

      // Only 1 active SUPER_ADMIN left
      vi.spyOn(prisma.user, 'count').mockResolvedValue(1);

      await expect(
        UserService.toggleUserStatus(targetSuperAdminId, callerId)
      ).rejects.toThrow(/Cannot deactivate the last active SUPER_ADMIN/i);
    });
  });
});

describe('Order Module Updates: Writer Suggestion & Safe Cancellation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Writer Suggestion by District & Workload', () => {
    it('suggests active writers matching preferred district sorted by lowest pending workload first', async () => {
      const orderId = 'order-suggest-1';
      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
        id: orderId,
        orderNumber: 'ORD-2026-0001',
        quantity: 50,
        preferredDistrict: 'Dhaka',
        preferredWriterId: 'writer-2',
      } as any);

      vi.spyOn(prisma.writer, 'findMany').mockResolvedValue([
        {
          id: 'writer-1',
          name: 'Writer High Workload',
          phone: '01711111111',
          email: 'writer1@example.com',
          district: 'Dhaka',
          ratePerKhata: new Decimal('30.00'),
          isActive: true,
          branch: { id: 'branch-1', name: 'Dhaka Branch', phone: '01700000000' },
          khatas: [
            { id: 'k-1', receivedQty: 50, submittedQty: 10, status: 'DISTRIBUTED' },
            { id: 'k-2', receivedQty: 30, submittedQty: 10, status: 'PARTIALLY_SUBMITTED' },
          ], // pending: (50-10) + (30-10) = 60
        },
        {
          id: 'writer-2',
          name: 'Writer Low Workload Preferred',
          phone: '01722222222',
          email: 'writer2@example.com',
          district: 'Dhaka',
          ratePerKhata: new Decimal('25.00'),
          isActive: true,
          branch: { id: 'branch-1', name: 'Dhaka Branch', phone: '01700000000' },
          khatas: [
            { id: 'k-3', receivedQty: 20, submittedQty: 15, status: 'DISTRIBUTED' },
          ], // pending: 5
        },
      ] as any);

      const result = await OrderService.suggestWriters(orderId);

      expect(result.suggestedWriters).toHaveLength(2);
      // Lowest workload writer (writer-2 with 5 pending) should appear first
      expect(result.suggestedWriters[0]!.id).toBe('writer-2');
      expect(result.suggestedWriters[0]!.workload.pendingKhataQty).toBe(5);
      expect(result.suggestedWriters[0]!.workload.activeKhatasCount).toBe(1);
      expect(result.suggestedWriters[0]!.isPreferredWriter).toBe(true);

      // Higher workload writer (writer-1 with 60 pending) should appear second
      expect(result.suggestedWriters[1]!.id).toBe('writer-1');
      expect(result.suggestedWriters[1]!.workload.pendingKhataQty).toBe(60);
      expect(result.suggestedWriters[1]!.workload.activeKhatasCount).toBe(2);
      expect(result.suggestedWriters[1]!.isPreferredWriter).toBe(false);
    });
  });

  describe('2. Safe Order Cancellation Edge Cases', () => {
    it('blocks cancellation if any assigned Khata has submittedQty > 0', async () => {
      const orderId = 'order-cancel-fail';
      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
        id: orderId,
        orderNumber: 'ORD-2026-0002',
        status: 'IN_PROGRESS',
        totalAmount: new Decimal('1000.00'),
        khataAssignments: [
          {
            id: 'khata-submitted-1',
            batchNumber: 'BATCH-001',
            status: 'PARTIALLY_SUBMITTED',
            receivedQty: 20,
            submittedQty: 5, // Already submitted some khatas!
            payments: [],
            paymentItems: [],
            writer: { id: 'writer-1', name: 'Rahim Writer' },
          },
        ],
      } as any);

      await expect(
        OrderService.cancelOrder(orderId, { note: 'Customer cancelled' }, 'admin-id')
      ).rejects.toThrow(/Cannot cancel order: Khatas have already been partially or fully submitted/i);
    });

    it('blocks cancellation if any assigned Khata has linked payments', async () => {
      const orderId = 'order-cancel-payment-fail';
      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
        id: orderId,
        orderNumber: 'ORD-2026-0003',
        status: 'ASSIGNED',
        totalAmount: new Decimal('500.00'),
        khataAssignments: [
          {
            id: 'khata-with-payment',
            batchNumber: 'BATCH-002',
            status: 'DISTRIBUTED',
            receivedQty: 20,
            submittedQty: 0,
            payments: [{ id: 'payment-1' }],
            paymentItems: [],
            writer: { id: 'writer-1', name: 'Rahim Writer' },
          },
        ],
      } as any);

      await expect(
        OrderService.cancelOrder(orderId, { note: 'Customer cancelled' }, 'admin-id')
      ).rejects.toThrow(/Payment records are already linked/i);
    });

    it('atomically cancels order and deletes DISTRIBUTED Khatas when no khata has been submitted', async () => {
      const orderId = 'order-cancel-success';
      const mockOrder = {
        id: orderId,
        orderNumber: 'ORD-2026-0004',
        status: 'ASSIGNED',
        totalAmount: new Decimal('800.00'),
        khataAssignments: [
          {
            id: 'khata-clean-1',
            batchNumber: 'BATCH-101',
            status: 'DISTRIBUTED',
            receivedQty: 10,
            submittedQty: 0,
            payments: [],
            paymentItems: [],
            writer: { id: 'writer-1', name: 'Rahim Writer' },
          },
          {
            id: 'khata-clean-2',
            batchNumber: 'BATCH-102',
            status: 'DISTRIBUTED',
            receivedQty: 10,
            submittedQty: 0,
            payments: [],
            paymentItems: [],
            writer: { id: 'writer-2', name: 'Karim Writer' },
          },
        ],
      };

      vi.spyOn(prisma.order, 'findUnique').mockResolvedValue(mockOrder as any);

      let deleteWhereClause: any = null;
      let updatedStatus: string | null = null;
      let auditLogged = false;

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const txMock = {
          khata: {
            deleteMany: vi.fn().mockImplementation(async ({ where }: any) => {
              deleteWhereClause = where;
              return { count: 2 };
            }),
          },
          order: {
            update: vi.fn().mockImplementation(async ({ data }: any) => {
              updatedStatus = data.status;
              return {
                ...mockOrder,
                status: data.status,
                cancelReason: data.cancelReason,
                khataAssignments: [],
                subjectPricing: {
                  id: 'pricing-1',
                  subjectName: 'Physics',
                  className: 'HSC',
                  pricePerKhata: new Decimal('80.00'),
                },
                preferredWriter: null,
              };
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

      const result = await OrderService.cancelOrder(orderId, { note: 'Client changed mind' }, 'admin-id');

      expect(deleteWhereClause).toEqual({
        orderId: mockOrder.id,
        status: 'DISTRIBUTED',
      });
      expect(updatedStatus).toBe('CANCELLED');
      expect(auditLogged).toBe(true);
      expect(result.status).toBe('CANCELLED');
    });
  });
});
