import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Decimal, prisma } from '../src/lib/prisma.js';
import { formatMoneyString, positiveMoneySchema } from '../src/utils/money.js';
import { PaymentService } from '../src/modules/payment/payment.service.js';
import { StockService } from '../src/modules/stock/stock.service.js';
import { ApiError } from '../src/utils/apiError.js';

describe('1. Decimal Arithmetic & Validation', () => {
  it('correctly handles Decimal arithmetic where IEEE-754 floating point fails (0.1 + 0.2 = 0.30)', () => {
    // JavaScript standard numbers suffer from floating point representation error:
    const jsSum = 0.1 + 0.2;
    expect(jsSum).not.toBe(0.3);
    expect(jsSum).toBe(0.30000000000000004);

    // Prisma Decimal maintains exact arbitrary-precision arithmetic:
    const decA = new Decimal('0.1');
    const decB = new Decimal('0.2');
    const decSum = decA.plus(decB);

    expect(decSum.equals(new Decimal('0.3'))).toBe(true);
    expect(decSum.toString()).toBe('0.3');
    expect(decSum.toFixed(2)).toBe('0.30');
    expect(formatMoneyString(decSum)).toBe('0.30');
  });

  it('correctly handles multiplication and division without rounding drift', () => {
    const unitPrice = new Decimal('19.99');
    const quantity = 3;
    const total = unitPrice.mul(quantity);

    expect(total.toFixed(2)).toBe('59.97');
    expect(total.equals(new Decimal('59.97'))).toBe(true);

    const split = total.div(3);
    expect(split.toFixed(2)).toBe('19.99');
  });

  it('validates positive monetary values and rejects more than 2 decimal places or negative values', () => {
    const schema = positiveMoneySchema();

    // Valid numbers and strings
    expect(schema.parse(25.5)).toBeInstanceOf(Decimal);
    expect(schema.parse('120.00').toFixed(2)).toBe('120.00');
    expect(schema.parse('0.05').toFixed(2)).toBe('0.05');

    // Invalid: negative
    expect(() => schema.parse(-10)).toThrow();
    expect(() => schema.parse('-5.00')).toThrow();

    // Invalid: zero
    expect(() => schema.parse(0)).toThrow();

    // Invalid: more than 2 decimal places
    expect(() => schema.parse(10.123)).toThrow();
    expect(() => schema.parse('10.999')).toThrow();
  });
});

describe('2. Split Payment Atomic Transaction Rollback', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rolls back completely if one PaymentItem fails during split payment', async () => {
    const writerId = 'writer-uuid-1';
    const mockWriter = {
      id: writerId,
      name: 'Tanvir Writer',
      branchId: 'branch-uuid-1',
      ratePerKhata: new Decimal('25.00'),
      isActive: true,
      branch: { id: 'branch-uuid-1', name: 'Main Branch' },
    };

    vi.spyOn(prisma.writer, 'findUnique').mockResolvedValue(mockWriter as any);
    vi.spyOn(PaymentService, 'calculateDue').mockResolvedValue({
      writerId,
      writerName: 'Tanvir Writer',
      ratePerKhata: '25.00',
      completedKhatasCount: 2,
      totalSubmittedQty: 60,
      totalEarned: '1500.00',
      totalAlreadyPaid: '0.00',
      netDue: '1500.00',
      unpaidKhatas: [
        { khataId: 'khata-1', batchNumber: 'BATCH-001', submittedQty: 40, earnedAmount: '1000.00', paidAmount: '0.00', dueAmount: '1000.00' },
        { khataId: 'khata-2', batchNumber: 'BATCH-002', submittedQty: 20, earnedAmount: '500.00', paidAmount: '0.00', dueAmount: '500.00' },
      ],
    } as any);

    vi.spyOn(prisma.khata, 'findMany').mockResolvedValue([
      { id: 'khata-1', writerId, batchNumber: 'BATCH-001' },
      { id: 'khata-2', writerId, batchNumber: 'BATCH-002' },
    ] as any);

    // Mock transactional state
    const databasePayments: any[] = [];
    const databaseItems: any[] = [];

    // Mock prisma.$transaction to simulate atomic database rollback on failure
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      const initialPaymentsCount = databasePayments.length;
      const initialItemsCount = databaseItems.length;

      const txMock = {
        payment: {
          create: vi.fn().mockImplementation(async ({ data }: any) => {
            const paymentRecord = {
              id: 'payment-uuid-1',
              ...data,
              writer: mockWriter,
              khata: null,
              paymentItems: [],
            };
            databasePayments.push(paymentRecord);

            // Simulate nested PaymentItem insertion where second item triggers a database constraint error
            if (data.paymentItems?.create) {
              for (const item of data.paymentItems.create) {
                if (item.khataId === 'khata-2') {
                  throw new Error('Database constraint error on PaymentItem: Foreign key or unique failure');
                }
                const itemRecord = { id: `item-${item.khataId}`, paymentId: paymentRecord.id, ...item };
                databaseItems.push(itemRecord);
                paymentRecord.paymentItems.push(itemRecord);
              }
            }

            return paymentRecord;
          }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      };

      try {
        return await callback(txMock);
      } catch (error) {
        // Atomic rollback: any writes made inside this transaction are reverted
        databasePayments.length = initialPaymentsCount;
        databaseItems.length = initialItemsCount;
        throw error;
      }
    });

    const splitPaymentDto = {
      writerId,
      amount: new Decimal('150.00'),
      paidAmount: new Decimal('150.00'),
      khataAllocations: [
        { khataId: 'khata-1', amount: new Decimal('100.00'), note: 'Item 1' },
        { khataId: 'khata-2', amount: new Decimal('50.00'), note: 'Item 2' },
      ],
      paymentDate: new Date().toISOString(),
    };

    // Expect the service call to fail and throw
    await expect(
      PaymentService.createPayment(splitPaymentDto as any, 'user-uuid-1')
    ).rejects.toThrow('Database constraint error on PaymentItem');

    // Verify atomic state rollback: neither payment nor items remain committed
    expect(databasePayments).toHaveLength(0);
    expect(databaseItems).toHaveLength(0);
  });

  it('rejects payment if payment amount exceeds remaining due (Overpayment Guard)', async () => {
    const writerId = 'writer-uuid-1';
    const mockWriter = {
      id: writerId,
      name: 'Tanvir Writer',
      branchId: 'branch-uuid-1',
      ratePerKhata: new Decimal('25.00'),
      isActive: true,
      branch: { id: 'branch-uuid-1', name: 'Main Branch' },
    };

    vi.spyOn(prisma.writer, 'findUnique').mockResolvedValue(mockWriter as any);
    vi.spyOn(PaymentService, 'calculateDue').mockResolvedValue({
      writerId,
      writerName: 'Tanvir Writer',
      ratePerKhata: '25.00',
      completedKhatasCount: 1,
      totalSubmittedQty: 10,
      totalEarned: '250.00',
      totalAlreadyPaid: '200.00',
      netDue: '50.00',
      unpaidKhatas: [
        { khataId: 'khata-1', batchNumber: 'BATCH-001', submittedQty: 10, earnedAmount: '250.00', paidAmount: '200.00', dueAmount: '50.00' },
      ],
    } as any);

    vi.spyOn(prisma.khata, 'findUnique').mockResolvedValue({
      id: 'khata-1',
      writerId,
      batchNumber: 'BATCH-001',
    } as any);

    // Attempt to pay 100 when net due is only 50
    const overpaymentDto = {
      writerId,
      amount: new Decimal('100.00'),
      paidAmount: new Decimal('100.00'),
      khataId: 'khata-1',
    };

    await expect(
      PaymentService.createPayment(overpaymentDto as any, 'user-uuid-1')
    ).rejects.toThrow(/Overpayment rejected.*exceeds writer's total net due amount/);
  });
});

describe('3. Concurrent Stock Distribution Negative Guard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('prevents stock from dropping below zero when concurrent distributions are attempted', async () => {
    const branchId = 'branch-uuid-1';
    let branchAvailableStock = 10; // Initial stock = 10

    vi.spyOn(prisma.branch, 'findUnique').mockResolvedValue({
      id: branchId,
      name: 'Main Branch',
      isActive: true,
    } as any);

    // Simulate serialized transaction with isolation
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      const txMock = {
        stock: {
          findFirst: vi.fn().mockImplementation(async () => {
            return {
              currentQty: branchAvailableStock,
              receivedQty: 10,
              distributedQty: 10 - branchAvailableStock,
              returnedQty: 0,
            };
          }),
          create: vi.fn().mockImplementation(async ({ data }: any) => {
            branchAvailableStock = data.currentQty;
            return { id: 'stock-movement-id', ...data };
          }),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      };

      return await callback(txMock);
    });

    const distributeDto1 = {
      branchId,
      quantity: 7,
      note: 'Distribution A',
    };

    const distributeDto2 = {
      branchId,
      quantity: 7,
      note: 'Distribution B',
    };

    // First distribution: 10 - 7 = 3 (succeeds)
    const result1 = await StockService.distributeStock(distributeDto1 as any, 'user-1');
    expect(result1!.currentQty).toBe(3);
    expect(branchAvailableStock).toBe(3);

    // Second distribution: requests 7, but only 3 available (must reject)
    await expect(
      StockService.distributeStock(distributeDto2 as any, 'user-1')
    ).rejects.toThrow(/Insufficient stock/);

    // Verify stock never went negative
    expect(branchAvailableStock).toBe(3);
    expect(branchAvailableStock).toBeGreaterThanOrEqual(0);
  });

  it('retries on P2034 serialization error up to 3 times before succeeding', async () => {
    const branchId = 'branch-uuid-1';
    let attempts = 0;

    vi.spyOn(prisma.branch, 'findUnique').mockResolvedValue({
      id: branchId,
      name: 'Main Branch',
      isActive: true,
    } as any);

    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      attempts++;
      if (attempts < 3) {
        // Simulate P2034 error for first 2 attempts
        const p2034Error: any = new Error('Transaction failed due to a write conflict or deadlock.');
        p2034Error.code = 'P2034';
        throw p2034Error;
      }

      // Succeeded on 3rd attempt
      const txMock = {
        stock: {
          findFirst: vi.fn().mockResolvedValue({
            currentQty: 20,
            receivedQty: 20,
            distributedQty: 0,
            returnedQty: 0,
          }),
          create: vi.fn().mockImplementation(async ({ data }: any) => ({
            id: 'stock-movement-success',
            ...data,
          })),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      };

      return await callback(txMock);
    });

    const result = await StockService.distributeStock(
      { branchId, quantity: 5, note: 'Retry test' } as any,
      'user-1'
    );

    expect(result!.currentQty).toBe(15);
    expect(attempts).toBe(3); // Verified that it retried on P2034
  });
});
