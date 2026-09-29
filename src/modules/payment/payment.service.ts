import { prisma, Decimal, Prisma } from '../../lib/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { formatMoneyString } from '../../utils/money.js';
import type { PaymentStatus } from '../../../generated/prisma/client.js';
import type {
  CreatePaymentDto,
  AddPaymentDto,
  PaymentQueryDto,
  CalculateDueResponse,
  UnpaidKhataItem,
  WriterPaymentSummaryResponse,
} from './payment.types.js';

/**
 * পেমেন্ট (Payment) সার্ভিস — কোর বিজনেস লজিক, ট্রানজ্যাকশন, ক্যালকুলেশন ও অডিট লগিং
 */
export class PaymentService {
  /**
   * পেমেন্ট অবজেক্ট ফরম্যাটিং হেল্পার (Decimal মানসমূহকে নিরাপদ ২ দশমিক বিশিষ্ট স্ট্রিংয়ে রূপান্তর)
   */
  // biome-ignore lint/suspicious/noExplicitAny: Format database entity with Decimal fields
  static formatPayment(payment: any) {
    if (!payment) return null;
    return {
      ...payment,
      amount: formatMoneyString(payment.amount),
      paidAmount: formatMoneyString(payment.paidAmount),
      dueAmount: formatMoneyString(payment.dueAmount),
      ...(payment.writer?.ratePerKhata !== undefined && {
        writer: {
          ...payment.writer,
          ratePerKhata: formatMoneyString(payment.writer.ratePerKhata),
        },
      }),
      // biome-ignore lint/suspicious/noExplicitAny: Payment item formatting
      ...(payment.paymentItems && {
        // biome-ignore lint/suspicious/noExplicitAny: Payment item formatting
        paymentItems: payment.paymentItems.map((item: any) => ({
          ...item,
          amount: formatMoneyString(item.amount),
        })),
      }),
    };
  }

  /**
   * ১. বকেয়া হিসাব (Calculate Due) — ডেটাবেজে সেভ না করে শুধু ক্যালকুলেশন দেখানো
   */
  static async calculateDue(writerId: string): Promise<CalculateDueResponse> {
    // লেখক যাচাই
    const writer = await prisma.writer.findUnique({
      where: { id: writerId },
    });

    if (!writer) {
      throw ApiError.notFound(`Writer not found with ID: ${writerId}`);
    }

    const ratePerKhata = new Decimal(writer.ratePerKhata);

    // লেখকের সব COMPLETED খাতা ও তার সাথে লিঙ্কড পেমেন্ট আইটেম সংগ্রহ
    const completedKhatas = await prisma.khata.findMany({
      where: {
        writerId,
        status: 'COMPLETED',
      },
      include: {
        paymentItems: {
          select: {
            amount: true,
          },
        },
        payments: {
          select: {
            paidAmount: true,
            paymentItems: { select: { id: true } },
          },
        },
      },
      orderBy: { distributedAt: 'asc' },
    });

    // মোট সাবমিটকৃত খাতার সংখ্যা ও প্রাপ্য (totalEarned) হিসাব
    const totalSubmittedQty = completedKhatas.reduce((acc, k) => acc + k.submittedQty, 0);
    const totalEarned = ratePerKhata.mul(totalSubmittedQty);

    // লেখকের পূর্বে পরিশোধিত মোট পেমেন্ট যোগফল
    const paymentsAgg = await prisma.payment.aggregate({
      where: { writerId },
      _sum: { paidAmount: true },
    });

    const totalAlreadyPaid = paymentsAgg._sum.paidAmount
      ? new Decimal(paymentsAgg._sum.paidAmount)
      : new Decimal(0);
    const netDue = Decimal.max(0, totalEarned.minus(totalAlreadyPaid));

    // প্রতিটি কমপ্লিটেড খাতার বিপরীতে পেমেন্ট বণ্টন যাচাই করে বকেয়া খাতার তালিকা তৈরি
    const unpaidKhatas: UnpaidKhataItem[] = [];

    for (const khata of completedKhatas) {
      const khataEarned = ratePerKhata.mul(khata.submittedQty);

      // PaymentItem-এর মাধ্যমে এই খাতায় বরাদ্দকৃত টাকা
      const allocatedViaItems = khata.paymentItems.reduce(
        (sum, item) => sum.plus(new Decimal(item.amount)),
        new Decimal(0)
      );

      // সরাসরি পেমেন্ট (যাতে আলাদা paymentItem নেই) থেকে প্রাপ্ত টাকা
      const directPaid = khata.payments
        .filter((p) => p.paymentItems.length === 0)
        .reduce((sum, p) => sum.plus(new Decimal(p.paidAmount)), new Decimal(0));

      const totalPaidForKhata = allocatedViaItems.plus(directPaid);
      const dueForKhata = Decimal.max(0, khataEarned.minus(totalPaidForKhata));

      if (dueForKhata.gt(0)) {
        unpaidKhatas.push({
          khataId: khata.id,
          batchNumber: khata.batchNumber,
          submittedQty: khata.submittedQty,
          ratePerKhata: ratePerKhata.toFixed(2),
          earnedAmount: khataEarned.toFixed(2),
          allocatedPaid: totalPaidForKhata.toFixed(2),
          dueAmount: dueForKhata.toFixed(2),
        });
      }
    }

    return {
      writerId: writer.id,
      writerName: writer.name,
      ratePerKhata: ratePerKhata.toFixed(2),
      completedKhatasCount: completedKhatas.length,
      totalSubmittedQty,
      totalEarned: totalEarned.toFixed(2),
      totalAlreadyPaid: totalAlreadyPaid.toFixed(2),
      netDue: netDue.toFixed(2),
      unpaidKhatas,
    };
  }

  /**
   * ২. নতুন পেমেন্ট রেকর্ড করা (Atomic Transaction ও Overpayment Guard সহ)
   */
  static async createPayment(dto: CreatePaymentDto, userId: string) {
    // লেখক বিদ্যমান কি না যাচাই
    const writer = await prisma.writer.findUnique({
      where: { id: dto.writerId },
      include: { branch: { select: { id: true, name: true } } },
    });

    if (!writer) {
      throw ApiError.notFound(`Writer not found with ID: ${dto.writerId}`);
    }

    const amountDec = new Decimal(dto.amount);
    const paidAmountDec = new Decimal(dto.paidAmount ?? 0);
    const dueAmountDec = amountDec.minus(paidAmountDec);

    // Overpayment Guard: লেখকের বর্তমান বকেয়া যাচাই
    const dueInfo = await PaymentService.calculateDue(dto.writerId);
    const netDue = new Decimal(dueInfo.netDue);

    if (paidAmountDec.gt(netDue)) {
      throw ApiError.badRequest(
        `Overpayment rejected: Paid amount (৳${paidAmountDec.toFixed(2)}) exceeds writer's total net due amount (৳${netDue.toFixed(2)}).`
      );
    }

    // স্ট্যাটাস নির্ধারণ (PAID / DUE / PARTIAL)
    let status: PaymentStatus = 'PARTIAL';
    if (paidAmountDec.eq(amountDec)) {
      status = 'PAID';
    } else if (paidAmountDec.isZero()) {
      status = 'DUE';
    }

    // একাধিক খাতায় পেমেন্ট বণ্টন (khataAllocations) থাকলে ভ্যালিডেশন
    if (dto.khataAllocations && dto.khataAllocations.length > 0) {
      let totalAllocated = new Decimal(0);
      for (const alloc of dto.khataAllocations) {
        const allocDec = new Decimal(alloc.amount);
        if (allocDec.lte(0)) {
          throw ApiError.badRequest('Allocation amount must be greater than 0');
        }
        totalAllocated = totalAllocated.plus(allocDec);

        // নির্দিষ্ট খাতার বকেয়ার চেয়ে বেশি বরাদ্দ প্রতিরোধ (Overpayment per khata)
        const unpaidKhata = dueInfo.unpaidKhatas.find((k) => k.khataId === alloc.khataId);
        if (unpaidKhata) {
          const khataDue = new Decimal(unpaidKhata.dueAmount);
          if (allocDec.gt(khataDue)) {
            throw ApiError.badRequest(
              `Overpayment rejected for khata '${unpaidKhata.batchNumber}': Allocated amount (৳${allocDec.toFixed(2)}) exceeds remaining khata due (৳${khataDue.toFixed(2)}).`
            );
          }
        }
      }

      // ভ্যালিডেশন: খাতা বরাদ্দের যোগফল মোট পেমেন্ট অ্যামাউন্টের বেশি হতে পারবে না
      if (totalAllocated.gt(amountDec)) {
        throw ApiError.badRequest(
          `Total allocated amount (৳${totalAllocated.toFixed(2)}) cannot exceed payment amount (৳${amountDec.toFixed(2)})`
        );
      }

      // সব খাতা আইডি এই লেখকের কি না নিশ্চিত করা
      const khataIds = dto.khataAllocations.map((a) => a.khataId);
      const khatas = await prisma.khata.findMany({
        where: { id: { in: khataIds } },
        select: { id: true, writerId: true, batchNumber: true },
      });

      if (khatas.length !== khataIds.length) {
        throw ApiError.badRequest('One or more khata IDs in allocations do not exist');
      }

      for (const khata of khatas) {
        if (khata.writerId !== dto.writerId) {
          throw ApiError.badRequest(
            `Khata '${khata.batchNumber}' does not belong to writer '${writer.name}'`
          );
        }
      }
    }

    // নির্দিষ্ট সিঙ্গেল খাতা রেফারেন্স থাকলে যাচাই
    if (dto.khataId) {
      const directKhata = await prisma.khata.findUnique({
        where: { id: dto.khataId },
        select: { id: true, writerId: true, batchNumber: true },
      });

      if (!directKhata) {
        throw ApiError.notFound(`Khata not found with ID: ${dto.khataId}`);
      }

      if (directKhata.writerId !== dto.writerId) {
        throw ApiError.badRequest(
          `Khata '${directKhata.batchNumber}' does not belong to writer '${writer.name}'`
        );
      }

      const unpaidKhata = dueInfo.unpaidKhatas.find((k) => k.khataId === dto.khataId);
      if (unpaidKhata) {
        const khataDue = new Decimal(unpaidKhata.dueAmount);
        if (paidAmountDec.gt(khataDue)) {
          throw ApiError.badRequest(
            `Overpayment rejected for khata '${directKhata.batchNumber}': Paid amount (৳${paidAmountDec.toFixed(2)}) exceeds remaining khata due (৳${khataDue.toFixed(2)}).`
          );
        }
      }
    }

    // একক atomic ট্রানজ্যাকশনে Payment, PaymentItem এবং AuditLog সংরক্ষণ
    return await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          writerId: dto.writerId,
          khataId:
            dto.khataId ||
            (dto.khataAllocations && dto.khataAllocations.length === 1
              ? dto.khataAllocations[0]?.khataId ?? null
              : null),
          amount: amountDec,
          paidAmount: paidAmountDec,
          dueAmount: dueAmountDec,
          status,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          paymentItems:
            dto.khataAllocations && dto.khataAllocations.length > 0
              ? {
                  create: dto.khataAllocations.map((alloc) => ({
                    khataId: alloc.khataId,
                    amount: new Decimal(alloc.amount),
                    note: alloc.note?.trim() || null,
                  })),
                }
              : undefined,
        },
        include: {
          writer: {
            select: {
              id: true,
              name: true,
              phone: true,
              ratePerKhata: true,
              branch: { select: { id: true, name: true } },
            },
          },
          khata: { select: { id: true, batchNumber: true, status: true } },
          paymentItems: {
            include: {
              khata: {
                select: {
                  id: true,
                  batchNumber: true,
                  receivedQty: true,
                  submittedQty: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      // অডিট লগ তৈরি (ট্রানজ্যাকশনের ভেতরে tx দিয়ে)
      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE_PAYMENT',
          entityType: 'Payment',
          entityId: payment.id,
          details: {
            writerId: payment.writerId,
            writerName: writer.name,
            amount: payment.amount.toFixed(2),
            paidAmount: payment.paidAmount.toFixed(2),
            dueAmount: payment.dueAmount.toFixed(2),
            status: payment.status,
            paymentDate: payment.paymentDate,
            allocationsCount: payment.paymentItems.length,
          },
        },
      });

      return PaymentService.formatPayment(payment);
    });
  }

  /**
   * ৩. সব পেমেন্টের তালিকা — পেজিনেশন ও ফিল্টারিং সহ
   */
  static async getAllPayments(query: PaymentQueryDto) {
    const { page, limit, writerId, status, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentWhereInput = {};

    if (writerId) where.writerId = writerId;
    if (status) where.status = status;

    if (fromDate || toDate) {
      where.paymentDate = {};
      if (fromDate) where.paymentDate.gte = new Date(fromDate);
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        where.paymentDate.lte = to;
      }
    }

    const [total, rawPayments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { paymentDate: 'desc' },
        include: {
          writer: {
            select: {
              id: true,
              name: true,
              phone: true,
              ratePerKhata: true,
              branch: { select: { id: true, name: true } },
            },
          },
          khata: { select: { id: true, batchNumber: true, status: true } },
          paymentItems: {
            include: {
              khata: {
                select: {
                  id: true,
                  batchNumber: true,
                  receivedQty: true,
                  submittedQty: true,
                  status: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const payments = rawPayments.map(PaymentService.formatPayment);

    return {
      payments,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * ৪. একটি নির্দিষ্ট পেমেন্টের বিস্তারিত তথ্য ও তার বণ্টন
   */
  static async getPaymentById(id: string) {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        writer: {
          include: {
            branch: { select: { id: true, name: true, phone: true } },
          },
        },
        khata: true,
        paymentItems: {
          include: {
            khata: {
              select: {
                id: true,
                batchNumber: true,
                receivedQty: true,
                submittedQty: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw ApiError.notFound(`Payment record not found with ID: ${id}`);
    }

    return PaymentService.formatPayment(payment);
  }

  /**
   * ৫. কিস্তিতে বকেয়া পরিশোধ (Add Payment / Installment) — Overpayment Guard সহ
   */
  static async addPayment(id: string, dto: AddPaymentDto, userId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        writer: { select: { id: true, name: true } },
      },
    });

    if (!payment) {
      throw ApiError.notFound(`Payment record not found with ID: ${id}`);
    }

    const currentDue = new Decimal(payment.dueAmount);

    // পেমেন্ট ইতিমধ্যে সম্পূর্ণ পরিশোধিত কি না যাচাই
    if (payment.status === 'PAID' || currentDue.lte(0)) {
      throw ApiError.badRequest('This payment record is already fully PAID. No remaining due.');
    }

    const additionalDec = new Decimal(dto.additionalPaidAmount);

    // Overpayment Guard: অতিরিক্ত পরিশোধ বর্তমান বকেয়ার বেশি হতে পারবে না
    if (additionalDec.gt(currentDue)) {
      throw ApiError.badRequest(
        `Overpayment rejected: Additional payment (৳${additionalDec.toFixed(2)}) exceeds remaining due amount (৳${currentDue.toFixed(2)})`
      );
    }

    const currentPaid = new Decimal(payment.paidAmount);
    const totalAmount = new Decimal(payment.amount);
    const newPaid = currentPaid.plus(additionalDec);
    const newDue = totalAmount.minus(newPaid);
    const newStatus: PaymentStatus = newDue.isZero() ? 'PAID' : 'PARTIAL';

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id },
        data: {
          paidAmount: newPaid,
          dueAmount: newDue,
          status: newStatus,
        },
        include: {
          writer: {
            select: {
              id: true,
              name: true,
              phone: true,
              ratePerKhata: true,
              branch: { select: { id: true, name: true } },
            },
          },
          khata: { select: { id: true, batchNumber: true, status: true } },
          paymentItems: {
            include: {
              khata: {
                select: {
                  id: true,
                  batchNumber: true,
                  receivedQty: true,
                  submittedQty: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      // অডিট লগ তৈরি (একই ট্রানজ্যাকশনে tx দিয়ে)
      await tx.auditLog.create({
        data: {
          userId,
          action: 'ADD_PAYMENT',
          entityType: 'Payment',
          entityId: updated.id,
          details: {
            writerId: updated.writerId,
            writerName: payment.writer.name,
            previousPaidAmount: payment.paidAmount.toFixed(2),
            additionalPaidAmount: additionalDec.toFixed(2),
            newPaidAmount: newPaid.toFixed(2),
            previousDueAmount: payment.dueAmount.toFixed(2),
            newDueAmount: newDue.toFixed(2),
            previousStatus: payment.status,
            newStatus,
          },
        },
      });

      return PaymentService.formatPayment(updated);
    });
  }

  /**
   * ৬. লেখকের সম্পূর্ণ পেমেন্ট সামারি (Summary)
   */
  static async getWriterPaymentSummary(writerId: string): Promise<WriterPaymentSummaryResponse> {
    const writer = await prisma.writer.findUnique({
      where: { id: writerId },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });

    if (!writer) {
      throw ApiError.notFound(`Writer not found with ID: ${writerId}`);
    }

    const ratePerKhata = new Decimal(writer.ratePerKhata);

    // লেখকের সব COMPLETED খাতার তথ্য
    const completedKhatas = await prisma.khata.findMany({
      where: { writerId, status: 'COMPLETED' },
      select: { id: true, submittedQty: true },
    });

    const totalSubmittedQty = completedKhatas.reduce((acc, k) => acc + k.submittedQty, 0);
    const totalEarned = ratePerKhata.mul(totalSubmittedQty);

    // লেখকের সব পেমেন্ট রেকর্ড
    const payments = await prisma.payment.findMany({
      where: { writerId },
      orderBy: { paymentDate: 'desc' },
    });

    let totalBilled = new Decimal(0);
    let totalPaid = new Decimal(0);
    let paidCount = 0;
    let partialCount = 0;
    let dueCount = 0;

    for (const p of payments) {
      totalBilled = totalBilled.plus(new Decimal(p.amount));
      totalPaid = totalPaid.plus(new Decimal(p.paidAmount));
      if (p.status === 'PAID') paidCount++;
      else if (p.status === 'PARTIAL') partialCount++;
      else if (p.status === 'DUE') dueCount++;
    }

    const totalDue = Decimal.max(0, totalEarned.minus(totalPaid));

    return {
      writer: {
        id: writer.id,
        name: writer.name,
        phone: writer.phone,
        email: writer.email,
        branch: writer.branch,
        ratePerKhata: ratePerKhata.toFixed(2),
      },
      khataMetrics: {
        completedKhatasCount: completedKhatas.length,
        totalSubmittedQty,
      },
      financialMetrics: {
        totalEarned: totalEarned.toFixed(2),
        totalBilled: totalBilled.toFixed(2),
        totalPaid: totalPaid.toFixed(2),
        totalDue: totalDue.toFixed(2),
      },
      paymentCounts: {
        total: payments.length,
        paid: paidCount,
        partial: partialCount,
        due: dueCount,
      },
      recentPayments: payments.slice(0, 5).map((p) => ({
        id: p.id,
        amount: new Decimal(p.amount).toFixed(2),
        paidAmount: new Decimal(p.paidAmount).toFixed(2),
        dueAmount: new Decimal(p.dueAmount).toFixed(2),
        status: p.status,
        paymentDate: p.paymentDate,
      })),
    };
  }
}

export default PaymentService;
