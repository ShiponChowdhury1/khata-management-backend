import { prisma, Decimal } from '../../lib/prisma.js';
import { formatMoneyString } from '../../utils/money.js';
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
  OrderReportQueryDto,
  OrderReportResponse,
  ProfitSummaryQueryDto,
  ProfitSummaryResponse,
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
      allOrders,
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
      // সমস্ত অর্ডারের স্ট্যাটাস ও রেভিনিউ মেট্রিক্স
      prisma.order.findMany({
        select: {
          status: true,
          paymentStatus: true,
          totalAmount: true,
        },
      }),
    ]);

    const totalDistributedQty = khataAgg._sum.receivedQty || 0;
    const totalSubmittedQty = khataAgg._sum.submittedQty || 0;
    const totalPendingQty = Math.max(0, totalDistributedQty - totalSubmittedQty);

    const totalPaymentAmount = formatMoneyString(paymentAgg._sum.amount);
    const totalPaidAmount = formatMoneyString(paymentAgg._sum.paidAmount);
    const totalDueAmount = formatMoneyString(paymentAgg._sum.dueAmount);

    const currentTotalStock = allBranches.reduce((sum, b) => {
      return sum + (b.stocks[0]?.currentQty || 0);
    }, 0);

    // অর্ডার অ্যানালিটিক্স হিসাব
    const ordersByStatus: Record<string, number> = {
      PENDING: 0,
      CONFIRMED: 0,
      ASSIGNED: 0,
      IN_PROGRESS: 0,
      WRITING: 0,
      READY: 0,
      OUT_FOR_DELIVERY: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    };

    let totalOrderRevenue = new Decimal(0);
    let codCollected = new Decimal(0);
    let codPending = new Decimal(0);
    let pendingDeliveries = 0;

    for (const o of allOrders) {
      ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1;

      if (o.status === 'READY' || o.status === 'OUT_FOR_DELIVERY') {
        pendingDeliveries++;
      }

      const amount = new Decimal(o.totalAmount);

      // বাতিলকৃত অর্ডার বাদে মোট রেভিনিউ ও ক্যাশ অন ডেলিভারি
      if (o.status !== 'CANCELLED') {
        totalOrderRevenue = totalOrderRevenue.plus(amount);

        if (o.paymentStatus === 'COLLECTED') {
          codCollected = codCollected.plus(amount);
        } else if (o.paymentStatus === 'PENDING') {
          codPending = codPending.plus(amount);
        }
      }
    }

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
      orders: {
        totalOrders: allOrders.length,
        ordersByStatus,
        pendingDeliveries,
        totalOrderRevenue: formatMoneyString(totalOrderRevenue),
        codCollected: formatMoneyString(codCollected),
        codPending: formatMoneyString(codPending),
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

      let totalPayment = new Decimal(0);
      let totalPaid = new Decimal(0);
      let totalDue = new Decimal(0);

      for (const w of b.writers) {
        for (const p of w.payments) {
          totalPayment = totalPayment.plus(p.amount);
          totalPaid = totalPaid.plus(p.paidAmount);
          totalDue = totalDue.plus(p.dueAmount);
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
        totalPayment: formatMoneyString(totalPayment),
        totalPaid: formatMoneyString(totalPaid),
        totalDue: formatMoneyString(totalDue),
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
      const rate = new Decimal(w.ratePerKhata);
      const totalReceivedQty = w.khatas.reduce((sum, k) => sum + k.receivedQty, 0);
      const totalSubmittedQty = w.khatas.reduce((sum, k) => sum + k.submittedQty, 0);
      const totalPendingQty = Math.max(0, totalReceivedQty - totalSubmittedQty);
      const totalEarned = rate.mul(totalSubmittedQty);

      const totalPaid = w.payments.reduce((sum, p) => sum.plus(p.paidAmount), new Decimal(0));
      const rawDue = totalEarned.minus(totalPaid);
      const totalDue = rawDue.gt(0) ? rawDue : new Decimal(0);

      return {
        writerId: w.id,
        writerName: w.name,
        phone: w.phone,
        ratePerKhata: formatMoneyString(rate),
        isActive: w.isActive,
        branch: w.branch,
        totalBatches: w.khatas.length,
        totalReceivedQty,
        totalSubmittedQty,
        totalPendingQty,
        totalEarned: formatMoneyString(totalEarned),
        totalPaid: formatMoneyString(totalPaid),
        totalDue: formatMoneyString(totalDue),
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
      amount: formatMoneyString(p.amount),
      paidAmount: formatMoneyString(p.paidAmount),
      dueAmount: formatMoneyString(p.dueAmount),
      status: p.status,
      paymentDate: p.paymentDate,
      paymentItemsCount: p.paymentItems.length,
      paymentItems: p.paymentItems.map((pi) => ({
        id: pi.id,
        khata: pi.khata,
        amount: formatMoneyString(pi.amount),
        note: pi.note,
      })),
    }));

    return {
      summary: {
        totalRecords: total,
        totalAmount: formatMoneyString(agg._sum.amount),
        totalPaidAmount: formatMoneyString(agg._sum.paidAmount),
        totalDueAmount: formatMoneyString(agg._sum.dueAmount),
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

    const writerMap = new Map<
      string,
      {
        writerId: string;
        writerName: string;
        phone: string;
        branchName: string;
        ratePerKhata: string;
        unpaidPaymentsCount: number;
        totalBilled: Decimal;
        totalPaid: Decimal;
        totalDue: Decimal;
        payments: Array<{
          id: string;
          amount: string;
          paidAmount: string;
          dueAmount: string;
          status: (typeof payments)[0]['status'];
          paymentDate: Date;
        }>;
      }
    >();
    let overallDue = new Decimal(0);
    let overallBilled = new Decimal(0);
    let overallPaid = new Decimal(0);

    for (const p of payments) {
      const w = p.writer;
      const amount = new Decimal(p.amount);
      const paid = new Decimal(p.paidAmount);
      const due = new Decimal(p.dueAmount);

      overallBilled = overallBilled.plus(amount);
      overallPaid = overallPaid.plus(paid);
      overallDue = overallDue.plus(due);

      if (!writerMap.has(w.id)) {
        writerMap.set(w.id, {
          writerId: w.id,
          writerName: w.name,
          phone: w.phone,
          branchName: w.branch.name,
          ratePerKhata: formatMoneyString(w.ratePerKhata),
          unpaidPaymentsCount: 0,
          totalBilled: new Decimal(0),
          totalPaid: new Decimal(0),
          totalDue: new Decimal(0),
          payments: [],
        });
      }

      const item = writerMap.get(w.id)!;
      item.unpaidPaymentsCount += 1;
      item.totalBilled = item.totalBilled.plus(amount);
      item.totalPaid = item.totalPaid.plus(paid);
      item.totalDue = item.totalDue.plus(due);
      item.payments.push({
        id: p.id,
        amount: formatMoneyString(amount),
        paidAmount: formatMoneyString(paid),
        dueAmount: formatMoneyString(due),
        status: p.status,
        paymentDate: p.paymentDate,
      });
    }

    const writersDue: WriterDueReportItem[] = Array.from(writerMap.values())
      .sort((a, b) => (b.totalDue.gt(a.totalDue) ? 1 : b.totalDue.lt(a.totalDue) ? -1 : 0))
      .map((item) => ({
        ...item,
        totalBilled: formatMoneyString(item.totalBilled),
        totalPaid: formatMoneyString(item.totalPaid),
        totalDue: formatMoneyString(item.totalDue),
      }));

    return {
      summary: {
        totalWritersWithDue: writersDue.length,
        totalUnpaidPayments: payments.length,
        overallBilledAmount: formatMoneyString(overallBilled),
        overallPaidAmount: formatMoneyString(overallPaid),
        overallDueAmount: formatMoneyString(overallDue),
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

  /**
   * ১০. অর্ডার রিপোর্ট (Order Report)
   */
  static async getOrderReport(query: OrderReportQueryDto): Promise<OrderReportResponse> {
    const { page, limit, status, branchId, district, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {};
    if (status) where.status = status;
    if (district) {
      where.preferredDistrict = { contains: district, mode: 'insensitive' };
    }
    if (branchId) {
      where.khataAssignments = { some: { branchId } };
    }
    if (fromDate || toDate) {
      where.orderDate = {};
      if (fromDate) where.orderDate.gte = new Date(fromDate);
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        where.orderDate.lte = to;
      }
    }

    const [allMatchingOrders, orders] = await Promise.all([
      prisma.order.findMany({
        where,
        select: {
          totalAmount: true,
          status: true,
          paymentStatus: true,
        },
      }),
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { orderDate: 'desc' },
        include: {
          subjectPricing: {
            select: {
              class: { select: { name: true } },
              subject: { select: { name: true } },
            },
          },
          _count: {
            select: { khataAssignments: true },
          },
        },
      }),
    ]);

    let totalRevenue = new Decimal(0);
    let collectedRevenue = new Decimal(0);
    let pendingRevenue = new Decimal(0);
    let cancelledOrdersCount = 0;

    for (const o of allMatchingOrders) {
      const amount = new Decimal(o.totalAmount);
      if (o.status === 'CANCELLED') {
        cancelledOrdersCount++;
      } else {
        totalRevenue = totalRevenue.plus(amount);
        if (o.paymentStatus === 'COLLECTED') {
          collectedRevenue = collectedRevenue.plus(amount);
        } else if (o.paymentStatus === 'PENDING') {
          pendingRevenue = pendingRevenue.plus(amount);
        }
      }
    }

    const total = allMatchingOrders.length;

    return {
      summary: {
        totalOrders: total,
        totalRevenue: formatMoneyString(totalRevenue),
        collectedRevenue: formatMoneyString(collectedRevenue),
        pendingRevenue: formatMoneyString(pendingRevenue),
        cancelledOrdersCount,
      },
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        preferredDistrict: o.preferredDistrict,
        subjectName: o.subjectPricing.subject.name,
        className: o.subjectPricing.class.name,
        quantity: o.quantity,
        unitPrice: formatMoneyString(o.unitPrice),
        totalAmount: formatMoneyString(o.totalAmount),
        status: o.status,
        paymentStatus: o.paymentStatus,
        orderDate: o.orderDate,
        deliveredAt: o.deliveredAt,
        assignmentsCount: o._count.khataAssignments,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * ১১. লাভ ও ক্ষতি সামারি রিপোর্ট (Profit Summary Report)
   * তারিখ রেঞ্জে আয় (DELIVERED অর্ডারের totalAmount),
   * Writer-দের মোট পারিশ্রমিক (ওই অর্ডারের Khata-গুলোর submittedQty × writer ratePerKhata),
   * লাভ = আয় − পারিশ্রমিক। সব হিসাব Decimal-এ।
   */
  static async getProfitSummary(query: ProfitSummaryQueryDto): Promise<ProfitSummaryResponse> {
    const { fromDate, toDate } = query;

    const where: Prisma.OrderWhereInput = {
      status: 'DELIVERED',
    };

    if (fromDate || toDate) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (fromDate) dateFilter.gte = new Date(fromDate);
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        dateFilter.lte = to;
      }
      where.OR = [
        { deliveredAt: dateFilter },
        { deliveredAt: null, orderDate: dateFilter },
      ];
    }

    const deliveredOrders = await prisma.order.findMany({
      where,
      orderBy: [{ deliveredAt: 'desc' }, { orderDate: 'desc' }],
      include: {
        khataAssignments: {
          include: {
            writer: {
              select: {
                id: true,
                name: true,
                ratePerKhata: true,
              },
            },
          },
        },
      },
    });

    let totalRevenue = new Decimal(0);
    let totalWriterRemuneration = new Decimal(0);

    const formattedOrders = deliveredOrders.map((order) => {
      const orderRevenue = new Decimal(order.totalAmount);
      let writerCost = new Decimal(0);

      for (const assignment of order.khataAssignments) {
        const rate = new Decimal(assignment.writer.ratePerKhata);
        const submitted = new Decimal(assignment.submittedQty);
        writerCost = writerCost.plus(submitted.mul(rate));
      }

      const orderProfit = orderRevenue.minus(writerCost);

      totalRevenue = totalRevenue.plus(orderRevenue);
      totalWriterRemuneration = totalWriterRemuneration.plus(writerCost);

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        deliveredAt: order.deliveredAt,
        orderRevenue: formatMoneyString(orderRevenue),
        writerCost: formatMoneyString(writerCost),
        orderProfit: formatMoneyString(orderProfit),
      };
    });

    const netProfit = totalRevenue.minus(totalWriterRemuneration);
    const profitMarginPercentage = totalRevenue.gt(0)
      ? netProfit.div(totalRevenue).mul(100).toFixed(2)
      : '0.00';

    return {
      dateRange: {
        fromDate: fromDate ?? null,
        toDate: toDate ?? null,
      },
      deliveredOrdersCount: deliveredOrders.length,
      totalRevenue: formatMoneyString(totalRevenue),
      totalWriterRemuneration: formatMoneyString(totalWriterRemuneration),
      netProfit: formatMoneyString(netProfit),
      profitMarginPercentage,
      deliveredOrders: formattedOrders,
    };
  }
}

export default ReportService;
