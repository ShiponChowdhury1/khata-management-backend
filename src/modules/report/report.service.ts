import { prisma } from '../../lib/prisma.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type {
  DashboardSummaryResponse,
  BranchWiseReportQueryDto,
  BranchWiseReportItem,
  WriterWiseReportQueryDto,
  KhataDistributionReportQueryDto,
  KhataSubmissionReportQueryDto,
  PendingKhataReportQueryDto,
  PaymentReportQueryDto,
  DueReportQueryDto,
  WriterDueReportItem,
  StockReportQueryDto,
} from './report.types.js';

/**
 * রিপোর্ট ও অ্যানালিটিক্স সার্ভিস — ড্যাশবোর্ড সামারি ও বিভিন্ন ডাইমেনশনাল রিপোর্ট
 */
export class ReportService {
  /**
   * ১. মেইন ড্যাশবোর্ড ওভারভিউ সামারি (Promise.all দিয়ে প্যারালাল কোয়েরি)
   */
  static async getDashboardSummary(): Promise<DashboardSummaryResponse> {
    const [
      totalBranches,
      activeBranches,
      totalWriters,
      activeWriters,
      khataAgg,
      paymentAgg,
      allBranches,
    ] = await Promise.all([
      prisma.branch.count(),
      prisma.branch.count({ where: { isActive: true } }),
      prisma.writer.count(),
      prisma.writer.count({ where: { isActive: true } }),
      prisma.khata.aggregate({
        _count: { id: true },
        _sum: {
          receivedQty: true,
          submittedQty: true,
        },
      }),
      prisma.payment.aggregate({
        _sum: {
          amount: true,
          paidAmount: true,
          dueAmount: true,
        },
      }),
      // সব ব্রাঞ্চের সর্বশেষ স্টক বের করা
      prisma.branch.findMany({
        where: { isActive: true },
        select: {
          stocks: {
            orderBy: [{ recordDate: 'desc' }, { createdAt: 'desc' }],
            take: 1,
            select: { currentQty: true },
          },
        },
      }),
    ]);

    const totalDistributedQty = khataAgg._sum.receivedQty || 0;
    const totalSubmittedQty = khataAgg._sum.submittedQty || 0;
    const totalPendingQty = Math.max(0, totalDistributedQty - totalSubmittedQty);

    const totalPaymentAmount = Number(paymentAgg._sum.amount || 0);
    const totalPaidAmount = Number(paymentAgg._sum.paidAmount || 0);
    const totalDueAmount = Number(paymentAgg._sum.dueAmount || 0);

    const currentTotalStock = allBranches.reduce((sum, b) => {
      return sum + (b.stocks[0]?.currentQty || 0);
    }, 0);

    return {
      branches: {
        total: totalBranches,
        active: activeBranches,
      },
      writers: {
        total: totalWriters,
        active: activeWriters,
      },
      khatas: {
        totalBatches: khataAgg._count.id,
        totalDistributedQty,
        totalSubmittedQty,
        totalPendingQty,
      },
      financials: {
        totalPaymentAmount,
        totalPaidAmount,
        totalDueAmount,
      },
      stocks: {
        currentTotalStock,
      },
    };
  }

  /**
   * ২. ব্রাঞ্চভিত্তিক তুলনামূলক রিপোর্ট (Branch-wise Report)
   */
  static async getBranchWiseReport(
    query: BranchWiseReportQueryDto
  ): Promise<BranchWiseReportItem[]> {
    const { fromDate, toDate } = query;
    const dateFilter: Prisma.DateTimeFilter | undefined =
      fromDate || toDate
        ? {
            ...(fromDate && { gte: new Date(fromDate) }),
            ...(toDate && { lte: new Date(new Date(toDate).setHours(23, 59, 59, 999)) }),
          }
        : undefined;

    const branches = await prisma.branch.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            writers: true,
            khatas: dateFilter ? { where: { distributedAt: dateFilter } } : true,
          },
        },
        khatas: {
          where: dateFilter ? { distributedAt: dateFilter } : undefined,
          select: {
            receivedQty: true,
            submittedQty: true,
          },
        },
        writers: {
          select: {
            payments: {
              where: dateFilter ? { paymentDate: dateFilter } : undefined,
              select: {
                amount: true,
                paidAmount: true,
                dueAmount: true,
              },
            },
          },
        },
        stocks: {
          orderBy: [{ recordDate: 'desc' }, { createdAt: 'desc' }],
          take: 1,
          select: { currentQty: true },
        },
      },
    });

    return branches.map((b) => {
      const totalReceivedQty = b.khatas.reduce((sum, k) => sum + k.receivedQty, 0);
      const totalSubmittedQty = b.khatas.reduce((sum, k) => sum + k.submittedQty, 0);
      const totalPendingQty = Math.max(0, totalReceivedQty - totalSubmittedQty);

      let totalPayment = 0;
      let totalPaid = 0;
      let totalDue = 0;

      for (const w of b.writers) {
        for (const p of w.payments) {
          totalPayment += Number(p.amount);
          totalPaid += Number(p.paidAmount);
          totalDue += Number(p.dueAmount);
        }
      }

      return {
        branchId: b.id,
        branchName: b.name,
        phone: b.phone,
        isActive: b.isActive,
        writersCount: b._count.writers,
        totalBatches: b._count.khatas,
        totalReceivedQty,
        totalSubmittedQty,
        totalPendingQty,
        totalPayment: Number(totalPayment.toFixed(2)),
        totalPaid: Number(totalPaid.toFixed(2)),
        totalDue: Number(totalDue.toFixed(2)),
        currentStock: b.stocks[0]?.currentQty || 0,
      };
    });
  }

  /**
   * ৩. লেখকভিত্তিক পারফরম্যান্স রিপোর্ট (Writer-wise Report)
   */
  static async getWriterWiseReport(query: WriterWiseReportQueryDto) {
    const { page, limit, branchId, search, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const dateFilter: Prisma.DateTimeFilter | undefined =
      fromDate || toDate
        ? {
            ...(fromDate && { gte: new Date(fromDate) }),
            ...(toDate && { lte: new Date(new Date(toDate).setHours(23, 59, 59, 999)) }),
          }
        : undefined;

    const where: Prisma.WriterWhereInput = {};
    if (branchId) where.branchId = branchId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, rawWriters] = await Promise.all([
      prisma.writer.count({ where }),
      prisma.writer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          branch: { select: { id: true, name: true } },
          khatas: {
            where: dateFilter ? { distributedAt: dateFilter } : undefined,
            select: { receivedQty: true, submittedQty: true, status: true },
          },
          payments: {
            where: dateFilter ? { paymentDate: dateFilter } : undefined,
            select: { paidAmount: true },
          },
        },
      }),
    ]);

    const report = rawWriters.map((w) => {
      const rate = Number(w.ratePerKhata);
      const totalReceivedQty = w.khatas.reduce((sum, k) => sum + k.receivedQty, 0);
      const totalSubmittedQty = w.khatas.reduce((sum, k) => sum + k.submittedQty, 0);
      const totalPendingQty = Math.max(0, totalReceivedQty - totalSubmittedQty);
      const totalEarned = rate * totalSubmittedQty;

      const totalPaid = w.payments.reduce((sum, p) => sum + Number(p.paidAmount), 0);
      const totalDue = Math.max(0, totalEarned - totalPaid);

      return {
        writerId: w.id,
        writerName: w.name,
        phone: w.phone,
        ratePerKhata: rate,
        isActive: w.isActive,
        branch: w.branch,
        totalBatches: w.khatas.length,
        totalReceivedQty,
        totalSubmittedQty,
        totalPendingQty,
        totalEarned: Number(totalEarned.toFixed(2)),
        totalPaid: Number(totalPaid.toFixed(2)),
        totalDue: Number(totalDue.toFixed(2)),
      };
    });

    return {
      report,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * ৪. খাতা বিতরণ রিপোর্ট (Khata Distribution Report)
   */
  static async getKhataDistributionReport(query: KhataDistributionReportQueryDto) {
    const { page, limit, branchId, writerId, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.KhataWhereInput = {};
    if (branchId) where.branchId = branchId;
    if (writerId) where.writerId = writerId;

    if (fromDate || toDate) {
      where.distributedAt = {};
      if (fromDate) where.distributedAt.gte = new Date(fromDate);
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        where.distributedAt.lte = to;
      }
    }

    const [total, agg, rawKhatas] = await Promise.all([
      prisma.khata.count({ where }),
      prisma.khata.aggregate({
        where,
        _sum: { receivedQty: true },
      }),
      prisma.khata.findMany({
        where,
        skip,
        take: limit,
        orderBy: { distributedAt: 'desc' },
        include: {
          branch: { select: { id: true, name: true } },
          writer: { select: { id: true, name: true, phone: true } },
        },
      }),
    ]);

    const khatas = rawKhatas.map((k) => ({
      id: k.id,
      batchNumber: k.batchNumber,
      branch: k.branch,
      writer: k.writer,
      receivedQty: k.receivedQty,
      submittedQty: k.submittedQty,
      pendingQty: Math.max(0, k.receivedQty - k.submittedQty),
      status: k.status,
      distributedAt: k.distributedAt,
    }));

    return {
      summary: {
        totalBatches: total,
        totalDistributedQty: agg._sum.receivedQty || 0,
      },
      khatas,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * ৫. খাতা জমা রিপোর্ট (Khata Submission Report)
   */
  static async getKhataSubmissionReport(query: KhataSubmissionReportQueryDto) {
    const { page, limit, branchId, writerId, status, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.KhataWhereInput = {
      submittedQty: { gt: 0 },
    };

    if (branchId) where.branchId = branchId;
    if (writerId) where.writerId = writerId;
    if (status) where.status = status;

    if (fromDate || toDate) {
      where.submittedAt = {};
      if (fromDate) where.submittedAt.gte = new Date(fromDate);
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        where.submittedAt.lte = to;
      }
    }

    const [total, agg, rawKhatas] = await Promise.all([
      prisma.khata.count({ where }),
      prisma.khata.aggregate({
        where,
        _sum: { submittedQty: true },
      }),
      prisma.khata.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ submittedAt: 'desc' }, { updatedAt: 'desc' }],
        include: {
          branch: { select: { id: true, name: true } },
          writer: { select: { id: true, name: true, phone: true } },
        },
      }),
    ]);

    const khatas = rawKhatas.map((k) => ({
      id: k.id,
      batchNumber: k.batchNumber,
      branch: k.branch,
      writer: k.writer,
      receivedQty: k.receivedQty,
      submittedQty: k.submittedQty,
      pendingQty: Math.max(0, k.receivedQty - k.submittedQty),
      status: k.status,
      submittedAt: k.submittedAt,
    }));

    return {
      summary: {
        totalBatches: total,
        totalSubmittedQty: agg._sum.submittedQty || 0,
      },
      khatas,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * ৬. পেন্ডিং খাতার রিপোর্ট (Pending Khata Report)
   */
  static async getPendingKhataReport(query: PendingKhataReportQueryDto) {
    const { page, limit, branchId, writerId } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.KhataWhereInput = {
      status: { in: ['DISTRIBUTED', 'PARTIALLY_SUBMITTED'] },
    };

    if (branchId) where.branchId = branchId;
    if (writerId) where.writerId = writerId;

    const [total, agg, rawKhatas] = await Promise.all([
      prisma.khata.count({ where }),
      prisma.khata.aggregate({
        where,
        _sum: { receivedQty: true, submittedQty: true },
      }),
      prisma.khata.findMany({
        where,
        skip,
        take: limit,
        orderBy: { distributedAt: 'asc' }, // বয়োবৃদ্ধ পেন্ডিং খাতা আগে
        include: {
          branch: { select: { id: true, name: true } },
          writer: { select: { id: true, name: true, phone: true } },
        },
      }),
    ]);

    const totalDistributed = agg._sum.receivedQty || 0;
    const totalSubmitted = agg._sum.submittedQty || 0;
    const totalPendingQty = Math.max(0, totalDistributed - totalSubmitted);

    const khatas = rawKhatas.map((k) => ({
      id: k.id,
      batchNumber: k.batchNumber,
      branch: k.branch,
      writer: k.writer,
      receivedQty: k.receivedQty,
      submittedQty: k.submittedQty,
      pendingQty: Math.max(0, k.receivedQty - k.submittedQty),
      status: k.status,
      distributedAt: k.distributedAt,
    }));

    return {
      summary: {
        totalPendingBatches: total,
        totalPendingQty,
      },
      khatas,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * ৭. পেমেন্ট রিপোর্ট (Payment Report)
   */
  static async getPaymentReport(query: PaymentReportQueryDto) {
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

    const [total, agg, rawPayments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.aggregate({
        where,
        _sum: {
          amount: true,
          paidAmount: true,
          dueAmount: true,
        },
      }),
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
              branch: { select: { id: true, name: true } },
            },
          },
          khata: { select: { id: true, batchNumber: true } },
          paymentItems: {
            include: {
              khata: { select: { id: true, batchNumber: true } },
            },
          },
        },
      }),
    ]);

    const payments = rawPayments.map((p) => ({
      id: p.id,
      writer: p.writer,
      khata: p.khata,
      amount: Number(p.amount),
      paidAmount: Number(p.paidAmount),
      dueAmount: Number(p.dueAmount),
      status: p.status,
      paymentDate: p.paymentDate,
      paymentItemsCount: p.paymentItems.length,
      paymentItems: p.paymentItems.map((pi) => ({
        id: pi.id,
        khata: pi.khata,
        amount: Number(pi.amount),
        note: pi.note,
      })),
    }));

    return {
      summary: {
        totalRecords: total,
        totalAmount: Number(agg._sum.amount || 0),
        totalPaidAmount: Number(agg._sum.paidAmount || 0),
        totalDueAmount: Number(agg._sum.dueAmount || 0),
      },
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
   * ৮. বকেয়া (Due) রিপোর্ট — DUE বা PARTIAL পেমেন্ট লেখক অনুযায়ী গ্রুপ করা
   */
  static async getDueReport(query: DueReportQueryDto) {
    const { branchId } = query;

    const where: Prisma.PaymentWhereInput = {
      status: { in: ['DUE', 'PARTIAL'] },
      dueAmount: { gt: 0 },
      ...(branchId && {
        writer: { branchId },
      }),
    };

    const payments = await prisma.payment.findMany({
      where,
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
      },
    });

    const writerMap = new Map<string, WriterDueReportItem>();
    let overallDue = 0;
    let overallBilled = 0;
    let overallPaid = 0;

    for (const p of payments) {
      const w = p.writer;
      const amount = Number(p.amount);
      const paid = Number(p.paidAmount);
      const due = Number(p.dueAmount);

      overallBilled += amount;
      overallPaid += paid;
      overallDue += due;

      if (!writerMap.has(w.id)) {
        writerMap.set(w.id, {
          writerId: w.id,
          writerName: w.name,
          phone: w.phone,
          branchName: w.branch.name,
          ratePerKhata: Number(w.ratePerKhata),
          unpaidPaymentsCount: 0,
          totalBilled: 0,
          totalPaid: 0,
          totalDue: 0,
          payments: [],
        });
      }

      const item = writerMap.get(w.id)!;
      item.unpaidPaymentsCount += 1;
      item.totalBilled = Number((item.totalBilled + amount).toFixed(2));
      item.totalPaid = Number((item.totalPaid + paid).toFixed(2));
      item.totalDue = Number((item.totalDue + due).toFixed(2));
      item.payments.push({
        id: p.id,
        amount,
        paidAmount: paid,
        dueAmount: due,
        status: p.status,
        paymentDate: p.paymentDate,
      });
    }

    const writersDue = Array.from(writerMap.values()).sort(
      (a, b) => b.totalDue - a.totalDue
    );

    return {
      summary: {
        totalWritersWithDue: writersDue.length,
        totalUnpaidPayments: payments.length,
        overallBilledAmount: Number(overallBilled.toFixed(2)),
        overallPaidAmount: Number(overallPaid.toFixed(2)),
        overallDueAmount: Number(overallDue.toFixed(2)),
      },
      writersDue,
    };
  }

  /**
   * ৯. স্টক রিপোর্ট (Stock Movement & Snapshot Report)
   */
  static async getStockReport(query: StockReportQueryDto) {
    const { page, limit, branchId, type, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.StockWhereInput = {};
    if (branchId) where.branchId = branchId;
    if (type) where.type = type;

    if (fromDate || toDate) {
      where.recordDate = {};
      if (fromDate) where.recordDate.gte = new Date(fromDate);
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        where.recordDate.lte = to;
      }
    }

    const [total, movements, branches] = await Promise.all([
      prisma.stock.count({ where }),
      prisma.stock.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ recordDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          branch: { select: { id: true, name: true } },
        },
      }),
      prisma.branch.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          stocks: {
            orderBy: [{ recordDate: 'desc' }, { createdAt: 'desc' }],
            take: 1,
            select: {
              currentQty: true,
              receivedQty: true,
              distributedQty: true,
              returnedQty: true,
            },
          },
        },
      }),
    ]);

    const branchSnapshots = branches.map((b) => {
      const s = b.stocks[0];
      return {
        branchId: b.id,
        branchName: b.name,
        currentQty: s?.currentQty || 0,
        totalReceived: s?.receivedQty || 0,
        totalDistributed: s?.distributedQty || 0,
        totalReturned: s?.returnedQty || 0,
      };
    });

    const totalCurrentStock = branchSnapshots.reduce((acc, b) => acc + b.currentQty, 0);

    return {
      summary: {
        totalMovementsCount: total,
        totalCurrentStockAcrossBranches: totalCurrentStock,
      },
      branchSnapshots,
      movements,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}

export default ReportService;
