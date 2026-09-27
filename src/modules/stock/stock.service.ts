import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type {
  StockMovementDto,
  StockHistoryQueryDto,
  BranchStockStatusResponse,
  OverallStockSummaryResponse,
  BranchStockBreakdownItem,
} from './stock.types.js';

/**
 * স্টক (Stock) সার্ভিস — মুভমেন্ট লেজার (Movement Log Pattern), ব্যালেন্স ট্র্যাকিং ও অডিট লগিং
 */
export class StockService {
  /**
   * ১. কেন্দ্র থেকে ব্রাঞ্চে নতুন খাতা রিসিভ করা (Receive Stock)
   */
  static async receiveStock(dto: StockMovementDto, userId: string) {
    // ব্রাঞ্চ যাচাই
    const branch = await prisma.branch.findUnique({
      where: { id: dto.branchId },
    });

    if (!branch) {
      throw ApiError.notFound(`Branch not found with ID: ${dto.branchId}`);
    }

    if (!branch.isActive) {
      throw ApiError.badRequest(`Cannot receive stock for inactive branch '${branch.name}'`);
    }

    // ট্রানজ্যাকশনে লেজার এন্ট্রি ও ব্যালেন্স আপডেট
    return await prisma.$transaction(async (tx) => {
      // এই ব্রাঞ্চের সর্বশেষ স্টক রেকর্ড
      const latest = await tx.stock.findFirst({
        where: { branchId: dto.branchId },
        orderBy: [{ recordDate: 'desc' }, { createdAt: 'desc' }],
      });

      const prevCurrent = latest ? latest.currentQty : 0;
      const prevReceived = latest ? latest.receivedQty : 0;
      const prevDistributed = latest ? latest.distributedQty : 0;
      const prevReturned = latest ? latest.returnedQty : 0;

      const newCurrent = prevCurrent + dto.quantity;
      const newReceived = prevReceived + dto.quantity;

      // নতুন মুভমেন্ট রো তৈরি
      const stock = await tx.stock.create({
        data: {
          branchId: dto.branchId,
          type: 'RECEIVED',
          quantity: dto.quantity,
          currentQty: newCurrent,
          receivedQty: newReceived,
          distributedQty: prevDistributed,
          returnedQty: prevReturned,
          note: dto.note?.trim() || null,
          recordDate: dto.recordDate ? new Date(dto.recordDate) : new Date(),
        },
        include: {
          branch: { select: { id: true, name: true, phone: true } },
        },
      });

      // অডিট লগ সংরক্ষণ
      await tx.auditLog.create({
        data: {
          userId,
          action: 'STOCK_RECEIVED',
          entityType: 'Stock',
          entityId: stock.id,
          details: {
            branchId: dto.branchId,
            branchName: branch.name,
            quantity: dto.quantity,
            previousStock: prevCurrent,
            currentStock: newCurrent,
            totalReceived: newReceived,
            note: dto.note?.trim() || null,
          },
        },
      });

      return stock;
    });
  }

  /**
   * ২. ব্রাঞ্চ থেকে খাতা বিতরণ করা (Distribute Stock - Manual / Allocation)
   */
  static async distributeStock(dto: StockMovementDto, userId: string) {
    const branch = await prisma.branch.findUnique({
      where: { id: dto.branchId },
    });

    if (!branch) {
      throw ApiError.notFound(`Branch not found with ID: ${dto.branchId}`);
    }

    if (!branch.isActive) {
      throw ApiError.badRequest(`Cannot distribute stock from inactive branch '${branch.name}'`);
    }

    return await prisma.$transaction(async (tx) => {
      const latest = await tx.stock.findFirst({
        where: { branchId: dto.branchId },
        orderBy: [{ recordDate: 'desc' }, { createdAt: 'desc' }],
      });

      const prevCurrent = latest ? latest.currentQty : 0;
      const prevReceived = latest ? latest.receivedQty : 0;
      const prevDistributed = latest ? latest.distributedQty : 0;
      const prevReturned = latest ? latest.returnedQty : 0;

      // নেগেটিভ স্টক প্রতিরোধ ভ্যালিডেশন
      if (prevCurrent < dto.quantity) {
        throw ApiError.badRequest(
          `Insufficient stock at branch '${branch.name}'. Available: ${prevCurrent}, Requested: ${dto.quantity}`
        );
      }

      const newCurrent = prevCurrent - dto.quantity;
      const newDistributed = prevDistributed + dto.quantity;

      const stock = await tx.stock.create({
        data: {
          branchId: dto.branchId,
          type: 'DISTRIBUTED',
          quantity: dto.quantity,
          currentQty: newCurrent,
          receivedQty: prevReceived,
          distributedQty: newDistributed,
          returnedQty: prevReturned,
          note: dto.note?.trim() || null,
          recordDate: dto.recordDate ? new Date(dto.recordDate) : new Date(),
        },
        include: {
          branch: { select: { id: true, name: true, phone: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'STOCK_DISTRIBUTED',
          entityType: 'Stock',
          entityId: stock.id,
          details: {
            branchId: dto.branchId,
            branchName: branch.name,
            quantity: dto.quantity,
            previousStock: prevCurrent,
            currentStock: newCurrent,
            totalDistributed: newDistributed,
            note: dto.note?.trim() || null,
          },
        },
      });

      return stock;
    });
  }

  /**
   * ৩. অব্যবহৃত বা ফেরত আসা খাতা ইনভেন্টরিতে পুনঃযোগ করা (Return Stock)
   */
  static async returnStock(dto: StockMovementDto, userId: string) {
    const branch = await prisma.branch.findUnique({
      where: { id: dto.branchId },
    });

    if (!branch) {
      throw ApiError.notFound(`Branch not found with ID: ${dto.branchId}`);
    }

    if (!branch.isActive) {
      throw ApiError.badRequest(`Cannot record returned stock for inactive branch '${branch.name}'`);
    }

    return await prisma.$transaction(async (tx) => {
      const latest = await tx.stock.findFirst({
        where: { branchId: dto.branchId },
        orderBy: [{ recordDate: 'desc' }, { createdAt: 'desc' }],
      });

      const prevCurrent = latest ? latest.currentQty : 0;
      const prevReceived = latest ? latest.receivedQty : 0;
      const prevDistributed = latest ? latest.distributedQty : 0;
      const prevReturned = latest ? latest.returnedQty : 0;

      const newCurrent = prevCurrent + dto.quantity;
      const newReturned = prevReturned + dto.quantity;

      const stock = await tx.stock.create({
        data: {
          branchId: dto.branchId,
          type: 'RETURNED',
          quantity: dto.quantity,
          currentQty: newCurrent,
          receivedQty: prevReceived,
          distributedQty: prevDistributed,
          returnedQty: newReturned,
          note: dto.note?.trim() || null,
          recordDate: dto.recordDate ? new Date(dto.recordDate) : new Date(),
        },
        include: {
          branch: { select: { id: true, name: true, phone: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'STOCK_RETURNED',
          entityType: 'Stock',
          entityId: stock.id,
          details: {
            branchId: dto.branchId,
            branchName: branch.name,
            quantity: dto.quantity,
            previousStock: prevCurrent,
            currentStock: newCurrent,
            totalReturned: newReturned,
            note: dto.note?.trim() || null,
          },
        },
      });

      return stock;
    });
  }

  /**
   * ৪. একটি নির্দিষ্ট ব্রাঞ্চের বর্তমান স্টক স্ট্যাটাস (Branch Stock Status)
   */
  static async getBranchStockStatus(branchId: string): Promise<BranchStockStatusResponse> {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      throw ApiError.notFound(`Branch not found with ID: ${branchId}`);
    }

    const latest = await prisma.stock.findFirst({
      where: { branchId },
      orderBy: [{ recordDate: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      branch: {
        id: branch.id,
        name: branch.name,
        address: branch.address,
        phone: branch.phone,
        isActive: branch.isActive,
      },
      currentQty: latest ? latest.currentQty : 0,
      totalReceived: latest ? latest.receivedQty : 0,
      totalDistributed: latest ? latest.distributedQty : 0,
      totalReturned: latest ? latest.returnedQty : 0,
      lastRecordDate: latest ? latest.recordDate : null,
      lastMovementType: latest ? latest.type : null,
    };
  }

  /**
   * ৫. ব্রাঞ্চের স্টক মুভমেন্ট হিস্টোরি (Movement History with Pagination & Filters)
   */
  static async getBranchStockHistory(branchId: string, query: StockHistoryQueryDto) {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, name: true, phone: true },
    });

    if (!branch) {
      throw ApiError.notFound(`Branch not found with ID: ${branchId}`);
    }

    const { page, limit, type, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.StockWhereInput = { branchId };

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

    const [total, history] = await Promise.all([
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
    ]);

    return {
      branch,
      history,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * ৬. সব ব্রাঞ্চ মিলিয়ে সামগ্রিক স্টক সামারি (Dashboard Summary)
   */
  static async getOverallStockSummary(): Promise<OverallStockSummaryResponse> {
    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, phone: true },
    });

    const branchBreakdown: BranchStockBreakdownItem[] = [];
    let totalCurrentStock = 0;
    let totalReceivedAllTime = 0;
    let totalDistributedAllTime = 0;
    let totalReturnedAllTime = 0;

    for (const branch of branches) {
      const latest = await prisma.stock.findFirst({
        where: { branchId: branch.id },
        orderBy: [{ recordDate: 'desc' }, { createdAt: 'desc' }],
      });

      const currentQty = latest ? latest.currentQty : 0;
      const totalReceived = latest ? latest.receivedQty : 0;
      const totalDistributed = latest ? latest.distributedQty : 0;
      const totalReturned = latest ? latest.returnedQty : 0;

      totalCurrentStock += currentQty;
      totalReceivedAllTime += totalReceived;
      totalDistributedAllTime += totalDistributed;
      totalReturnedAllTime += totalReturned;

      branchBreakdown.push({
        branchId: branch.id,
        branchName: branch.name,
        branchPhone: branch.phone,
        currentQty,
        totalReceived,
        totalDistributed,
        totalReturned,
        lastRecordDate: latest ? latest.recordDate : null,
      });
    }

    return {
      overall: {
        totalBranches: branches.length,
        totalCurrentStock,
        totalReceivedAllTime,
        totalDistributedAllTime,
        totalReturnedAllTime,
      },
      branches: branchBreakdown,
    };
  }
}

export default StockService;
