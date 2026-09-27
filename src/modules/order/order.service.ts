import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../utils/apiError.js';
import { Prisma } from '../../../generated/prisma/client.js';
import type {
  CreateSubjectPricingDto,
  UpdateSubjectPricingDto,
  CreatePublicOrderDto,
  TrackOrderQueryDto,
  OrderQueryDto,
  AssignOrderDto,
  UpdateOrderStatusDto,
  CancelOrderDto,
} from './order.types.js';

/**
 * অর্ডার (Order) ও সাবজেক্ট প্রাইসিং সার্ভিস — পাবলিক B2C অর্ডার, জেলাভিত্তিক লেখক সন্ধান,
 * মাল্টি-রাইটার স্প্লিট অ্যাসাইনমেন্ট, স্বয়ংক্রিয় খাতা ব্যাচ তৈরি ও ডেলিভারি গেট চেক
 */
export class OrderService {
  /**
   * অর্ডার অবজেক্ট ফরম্যাটিং হেল্পার (Decimal মানসমূহকে নিরাপদ নম্বরে রূপান্তর)
   */
  // biome-ignore lint/suspicious/noExplicitAny: Order entity formatting
  static formatOrder(order: any) {
    if (!order) return null;
    return {
      ...order,
      unitPrice: Number(order.unitPrice),
      totalAmount: Number(order.totalAmount),
      ...(order.subjectPricing && {
        subjectPricing: {
          ...order.subjectPricing,
          pricePerKhata: Number(order.subjectPricing.pricePerKhata),
        },
      }),
      ...(order.preferredWriter?.ratePerKhata !== undefined && {
        preferredWriter: {
          ...order.preferredWriter,
          ratePerKhata: Number(order.preferredWriter.ratePerKhata),
        },
      }),
      ...(Array.isArray(order.khataAssignments) && {
        khataAssignments: order.khataAssignments.map((k: any) => ({
          ...k,
          pendingQty: k.receivedQty - k.submittedQty,
          ...(k.writer?.ratePerKhata !== undefined && {
            writer: {
              ...k.writer,
              ratePerKhata: Number(k.writer.ratePerKhata),
            },
          }),
        })),
      }),
    };
  }

  // ==========================================
  // SubjectPricing মেথডস
  // ==========================================

  /**
   * ১. পাবলিক ভিউ: সক্রিয় সব সাবজেক্ট ও ক্লাসের মূল্য তালিকা
   */
  static async getActiveSubjectPricings() {
    const pricings = await prisma.subjectPricing.findMany({
      where: { isActive: true },
      orderBy: [{ className: 'asc' }, { subjectName: 'asc' }],
    });

    return pricings.map((p) => ({
      id: p.id,
      subjectName: p.subjectName,
      className: p.className,
      pricePerKhata: Number(p.pricePerKhata),
      isActive: p.isActive,
    }));
  }

  /**
   * ২. অ্যাডমিন ভিউ: সব সাবজেক্ট প্রাইসিং তালিকা (সক্রিয় ও নিষ্ক্রিয় সহ)
   */
  static async getAllSubjectPricings() {
    const pricings = await prisma.subjectPricing.findMany({
      orderBy: [{ className: 'asc' }, { subjectName: 'asc' }],
    });

    return pricings.map((p) => ({
      id: p.id,
      subjectName: p.subjectName,
      className: p.className,
      pricePerKhata: Number(p.pricePerKhata),
      isActive: p.isActive,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }

  /**
   * ৩. নতুন সাবজেক্ট প্রাইসিং তৈরি করা (Admin)
   */
  static async createSubjectPricing(dto: CreateSubjectPricingDto, userId?: string) {
    const subjectName = dto.subjectName.trim();
    const className = dto.className.trim();

    const existing = await prisma.subjectPricing.findUnique({
      where: {
        subjectName_className: {
          subjectName,
          className,
        },
      },
    });

    if (existing) {
      throw ApiError.conflict(
        `Pricing for subject '${subjectName}' in class '${className}' already exists`
      );
    }

    const pricing = await prisma.subjectPricing.create({
      data: {
        subjectName,
        className,
        pricePerKhata: new Prisma.Decimal(dto.pricePerKhata.toFixed(2)),
        isActive: dto.isActive ?? true,
      },
    });

    if (userId) {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'CREATE_SUBJECT_PRICING',
          entityType: 'SubjectPricing',
          entityId: pricing.id,
          details: {
            subjectName: pricing.subjectName,
            className: pricing.className,
            pricePerKhata: Number(pricing.pricePerKhata),
            isActive: pricing.isActive,
          },
        },
      });
    }

    return {
      ...pricing,
      pricePerKhata: Number(pricing.pricePerKhata),
    };
  }

  /**
   * ৪. সাবজেক্ট প্রাইসিং আপডেট করা (Admin)
   */
  static async updateSubjectPricing(
    id: string,
    dto: UpdateSubjectPricingDto,
    userId?: string
  ) {
    const pricing = await prisma.subjectPricing.findUnique({ where: { id } });
    if (!pricing) {
      throw ApiError.notFound(`Subject pricing not found with ID: ${id}`);
    }

    const subjectName = dto.subjectName?.trim() || pricing.subjectName;
    const className = dto.className?.trim() || pricing.className;

    if (subjectName !== pricing.subjectName || className !== pricing.className) {
      const conflict = await prisma.subjectPricing.findUnique({
        where: {
          subjectName_className: { subjectName, className },
        },
      });
      if (conflict && conflict.id !== id) {
        throw ApiError.conflict(
          `Pricing for subject '${subjectName}' in class '${className}' already exists`
        );
      }
    }

    const updated = await prisma.subjectPricing.update({
      where: { id },
      data: {
        ...(dto.subjectName && { subjectName }),
        ...(dto.className && { className }),
        ...(dto.pricePerKhata !== undefined && {
          pricePerKhata: new Prisma.Decimal(dto.pricePerKhata.toFixed(2)),
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    if (userId) {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'UPDATE_SUBJECT_PRICING',
          entityType: 'SubjectPricing',
          entityId: updated.id,
          details: {
            previousPrice: Number(pricing.pricePerKhata),
            newPrice: Number(updated.pricePerKhata),
            isActive: updated.isActive,
          },
        },
      });
    }

    return {
      ...updated,
      pricePerKhata: Number(updated.pricePerKhata),
    };
  }

  // ==========================================
  // Public Writer & Order মেথডস
  // ==========================================

  /**
   * ৫. পাবলিক জেলাভিত্তিক সক্রিয় লেখকদের তালিকা (Safe View: sensitive তথ্য ফিল্টার্ড)
   */
  static async getWritersByDistrict(district: string) {
    const writers = await prisma.writer.findMany({
      where: {
        district: { equals: district, mode: 'insensitive' },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        district: true,
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return writers;
  }

  /**
   * ৬. পাবলিক B2C স্টুডেন্টদের নতুন অর্ডার তৈরি (Public Order)
   */
  static async createPublicOrder(dto: CreatePublicOrderDto) {
    // সাবজেক্ট ও শ্রেণি ভিত্তিক নির্ধারিত মূল্য যাচাই
    const pricing = await prisma.subjectPricing.findUnique({
      where: { id: dto.subjectPricingId },
    });

    if (!pricing) {
      throw ApiError.notFound(`Subject pricing not found with ID: ${dto.subjectPricingId}`);
    }

    if (!pricing.isActive) {
      throw ApiError.badRequest(
        `Practical khata for '${pricing.subjectName} (${pricing.className})' is currently unavailable`
      );
    }

    // যদি স্টুডেন্ট নির্দিষ্ট কোনো পছন্দের লেখক বেছে নেয়
    if (dto.preferredWriterId) {
      const writer = await prisma.writer.findUnique({
        where: { id: dto.preferredWriterId },
      });

      if (!writer) {
        throw ApiError.notFound(`Preferred writer not found with ID: ${dto.preferredWriterId}`);
      }

      if (!writer.isActive) {
        throw ApiError.badRequest(`Selected writer '${writer.name}' is currently unavailable`);
      }
    }

    // মূল্যের স্ন্যাপশট সংরক্ষণ ও মোট প্রদেয় হিসাব
    const unitPrice = new Prisma.Decimal(pricing.pricePerKhata);
    const totalAmount = unitPrice.mul(dto.quantity);

    // বছরভিত্তিক ইউনিক অর্ডার নম্বর তৈরি (যেমন: ORD-2026-0001)
    const year = new Date().getFullYear();
    const countThisYear = await prisma.order.count({
      where: {
        orderNumber: { startsWith: `ORD-${year}-` },
      },
    });

    let nextSeq = countThisYear + 1;
    let orderNumber = `ORD-${year}-${nextSeq.toString().padStart(4, '0')}`;
    while (await prisma.order.findUnique({ where: { orderNumber } })) {
      nextSeq++;
      orderNumber = `ORD-${year}-${nextSeq.toString().padStart(4, '0')}`;
    }

    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerName: dto.customerName.trim(),
          customerPhone: dto.customerPhone.trim(),
          customerAddress: dto.customerAddress.trim(),
          subjectPricingId: dto.subjectPricingId,
          quantity: dto.quantity,
          unitPrice,
          totalAmount,
          preferredDistrict: dto.preferredDistrict || null,
          preferredWriterId: dto.preferredWriterId || null,
          status: 'PENDING',
          paymentStatus: 'PENDING',
        },
        include: {
          subjectPricing: true,
          preferredWriter: {
            select: {
              id: true,
              name: true,
              district: true,
            },
          },
        },
      });

      // অডিট লগ
      await tx.auditLog.create({
        data: {
          action: 'CREATE_ORDER',
          entityType: 'Order',
          entityId: order.id,
          details: {
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            subject: pricing.subjectName,
            className: pricing.className,
            quantity: order.quantity,
            unitPrice: Number(unitPrice),
            totalAmount: Number(totalAmount),
            preferredDistrict: order.preferredDistrict,
            preferredWriterId: order.preferredWriterId,
          },
        },
      });

      return {
        ...OrderService.formatOrder(order),
        trackingNotice: `Please save your Order Number '${order.orderNumber}' and Phone Number '${order.customerPhone}' to track your order status anytime at /api/public/orders/track`,
      };
    });
  }

  /**
   * ৭. পাবলিক অর্ডার ট্র্যাকিং (Order Tracking by orderNumber + customerPhone)
   */
  static async trackPublicOrder(query: TrackOrderQueryDto) {
    const orderNumber = query.orderNumber.trim();
    const customerPhone = query.customerPhone.trim();

    const order = await prisma.order.findFirst({
      where: {
        orderNumber: { equals: orderNumber, mode: 'insensitive' },
        customerPhone,
      },
      include: {
        subjectPricing: {
          select: {
            subjectName: true,
            className: true,
          },
        },
        preferredWriter: {
          select: {
            name: true,
            district: true,
          },
        },
        khataAssignments: {
          include: {
            branch: {
              select: {
                name: true,
              },
            },
            writer: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw ApiError.notFound(
        'No order found matching this Order Number and Mobile Number. Please verify your information.'
      );
    }

    // রাইটারদের কাজের অবস্থা সামারি (সংবেদনশীল তথ্য গোপন রেখে)
    const assignmentSummaries = order.khataAssignments.map((khata) => ({
      batchNumber: khata.batchNumber,
      branchName: khata.branch.name,
      writerName: khata.writer.name,
      assignedQty: khata.receivedQty,
      submittedQty: khata.submittedQty,
      status: khata.status,
    }));

    return {
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      deliveryAddress: order.customerAddress,
      subject: `${order.subjectPricing.subjectName} (${order.subjectPricing.className})`,
      quantity: order.quantity,
      unitPrice: Number(order.unitPrice),
      totalAmount: Number(order.totalAmount),
      status: order.status,
      paymentStatus: order.paymentStatus,
      preferredDistrict: order.preferredDistrict,
      preferredWriterName: order.preferredWriter?.name || null,
      deliveryPersonName: order.deliveryPersonName,
      orderDate: order.orderDate,
      confirmedAt: order.confirmedAt,
      assignedAt: order.assignedAt,
      deliveredAt: order.deliveredAt,
      cancelReason: order.cancelReason,
      assignments: assignmentSummaries,
    };
  }

  // ==========================================
  // Admin Order মেথডস
  // ==========================================

  /**
   * ৮. সব অর্ডারের তালিকা (Admin View with Pagination & Filters)
   */
  static async getAllOrders(query: OrderQueryDto) {
    const { page, limit, status, paymentStatus, branchId, preferredDistrict, search, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {};

    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (preferredDistrict) where.preferredDistrict = preferredDistrict;

    if (branchId) {
      where.khataAssignments = {
        some: { branchId },
      };
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
      ];
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

    const [total, rawOrders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { orderDate: 'desc' },
        include: {
          subjectPricing: true,
          preferredWriter: {
            select: { id: true, name: true, district: true, phone: true },
          },
          khataAssignments: {
            include: {
              branch: { select: { id: true, name: true } },
              writer: { select: { id: true, name: true, phone: true, ratePerKhata: true } },
            },
          },
        },
      }),
    ]);

    const orders = rawOrders.map(OrderService.formatOrder);

    return {
      orders,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * ৯. একটি নির্দিষ্ট অর্ডারের বিস্তারিত তথ্য (Admin View)
   */
  static async getOrderById(id: string) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        subjectPricing: true,
        preferredWriter: {
          select: { id: true, name: true, district: true, phone: true, ratePerKhata: true },
        },
        khataAssignments: {
          include: {
            branch: { select: { id: true, name: true, phone: true } },
            writer: { select: { id: true, name: true, phone: true, ratePerKhata: true } },
          },
        },
      },
    });

    if (!order) {
      throw ApiError.notFound(`Order record not found with ID: ${id}`);
    }

    return OrderService.formatOrder(order);
  }

  /**
   * ১০. অর্ডার কনফার্ম করা (Confirm Order)
   */
  static async confirmOrder(id: string, userId: string) {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw ApiError.notFound(`Order not found with ID: ${id}`);
    }

    if (order.status === 'CANCELLED') {
      throw ApiError.badRequest('Cannot confirm a cancelled order');
    }

    if (order.status !== 'PENDING') {
      throw ApiError.badRequest(`Order is already in '${order.status}' status`);
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
        },
        include: {
          subjectPricing: true,
          preferredWriter: true,
          khataAssignments: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CONFIRM_ORDER',
          entityType: 'Order',
          entityId: order.id,
          details: {
            orderNumber: order.orderNumber,
            status: 'CONFIRMED',
          },
        },
      });

      return OrderService.formatOrder(updated);
    });
  }

  /**
   * ১১. অর্ডার মাল্টি-রাইটার স্প্লিট অ্যাসাইনমেন্ট ও স্বয়ংক্রিয় খাতা তৈরি (Split Assignment)
   * বিজনেস রুল:
   * - assignments: [{ branchId, writerId, quantity }, ...]
   * - সব অ্যাসাইনমেন্টের মোট পরিমাণ অর্ডারের মোট পরিমাণের সমান হতে হবে
   * - প্রতিটা লেখকের জন্য আলাদা ব্যাচ তৈরি হবে: ORD-YYYY-XXXX-1, ORD-YYYY-XXXX-2...
   */
  static async assignOrder(id: string, dto: AssignOrderDto, userId: string) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        khataAssignments: true,
      },
    });

    if (!order) {
      throw ApiError.notFound(`Order not found with ID: ${id}`);
    }

    if (order.status === 'CANCELLED') {
      throw ApiError.badRequest('Cannot assign a cancelled order');
    }

    if (order.status === 'DELIVERED') {
      throw ApiError.badRequest('Cannot re-assign an already delivered order');
    }

    // ১. মোট অ্যাসাইনকৃত খাতার পরিমাণ যাচাই
    const totalAssignedQty = dto.assignments.reduce((sum, item) => sum + item.quantity, 0);

    if (totalAssignedQty !== order.quantity) {
      if (totalAssignedQty < order.quantity) {
        const remaining = order.quantity - totalAssignedQty;
        throw ApiError.badRequest(
          `Total assigned quantity (${totalAssignedQty}) is less than order requirement (${order.quantity}). Please assign ${remaining} more khata(s).`
        );
      } else {
        const excess = totalAssignedQty - order.quantity;
        throw ApiError.badRequest(
          `Total assigned quantity (${totalAssignedQty}) exceeds order requirement (${order.quantity}). Please reduce ${excess} khata(s).`
        );
      }
    }

    // ২. প্রতিটা ব্রাঞ্চ এবং লেখকের বৈধতা যাচাই
    for (const [index, item] of dto.assignments.entries()) {
      const branch = await prisma.branch.findUnique({
        where: { id: item.branchId },
      });

      if (!branch) {
        throw ApiError.notFound(`Assignment #${index + 1}: Branch not found with ID: ${item.branchId}`);
      }

      if (!branch.isActive) {
        throw ApiError.badRequest(
          `Assignment #${index + 1}: Cannot assign to inactive branch '${branch.name}'`
        );
      }

      const writer = await prisma.writer.findUnique({
        where: { id: item.writerId },
      });

      if (!writer) {
        throw ApiError.notFound(`Assignment #${index + 1}: Writer not found with ID: ${item.writerId}`);
      }

      if (!writer.isActive) {
        throw ApiError.badRequest(
          `Assignment #${index + 1}: Cannot assign to inactive writer '${writer.name}'`
        );
      }

      if (writer.branchId !== item.branchId) {
        throw ApiError.badRequest(
          `Assignment #${index + 1}: Writer '${writer.name}' does not belong to branch '${branch.name}'.`
        );
      }
    }

    // ৩. ট্রানজ্যাকশনে খাতা তৈরি ও অর্ডার স্ট্যাটাস আপডেট
    return await prisma.$transaction(async (tx) => {
      // যদি আগে কোনো খাতা অ্যাসাইনমেন্ট থাকে যা এখনও শুরু হয়নি (DISTRIBUTED ও submittedQty === 0), সেগুলোকে মুছে নতুন করে স্প্লিট তৈরি করা হবে
      const existingKhatas = await tx.khata.findMany({
        where: { orderId: order.id },
      });

      const startedKhatas = existingKhatas.filter((k) => k.submittedQty > 0 || k.status !== 'DISTRIBUTED');
      if (startedKhatas.length > 0) {
        throw ApiError.badRequest(
          `Cannot re-assign order: One or more writers have already submitted work on this order.`
        );
      }

      if (existingKhatas.length > 0) {
        await tx.khata.deleteMany({
          where: { orderId: order.id },
        });
      }

      // প্রতিটি অ্যাসাইনমেন্টের জন্য একটি করে Khata ব্যাচ তৈরি
      const createdKhatas = [];
      for (const [i, item] of dto.assignments.entries()) {
        const batchNumber = `${order.orderNumber}-${i + 1}`;

        const khata = await tx.khata.create({
          data: {
            batchNumber,
            branchId: item.branchId,
            writerId: item.writerId,
            receivedQty: item.quantity,
            submittedQty: 0,
            status: 'DISTRIBUTED',
            distributedAt: new Date(),
            orderId: order.id,
          },
          include: {
            branch: { select: { id: true, name: true } },
            writer: { select: { id: true, name: true, phone: true } },
          },
        });

        createdKhatas.push(khata);
      }

      // অর্ডার স্ট্যাটাস ASSIGNED-এ রূপান্তর
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          status: 'ASSIGNED',
          assignedAt: new Date(),
        },
        include: {
          subjectPricing: true,
          preferredWriter: true,
          khataAssignments: {
            include: {
              branch: { select: { id: true, name: true } },
              writer: { select: { id: true, name: true, phone: true } },
            },
          },
        },
      });

      // অডিট লগ সংরক্ষণ
      await tx.auditLog.create({
        data: {
          userId,
          action: 'ASSIGN_ORDER_SPLIT',
          entityType: 'Order',
          entityId: order.id,
          details: {
            orderNumber: order.orderNumber,
            totalQuantity: order.quantity,
            assignmentsCount: dto.assignments.length,
            assignments: createdKhatas.map((k) => ({
              khataId: k.id,
              batchNumber: k.batchNumber,
              branchName: k.branch.name,
              writerName: k.writer.name,
              assignedQty: k.receivedQty,
            })),
          },
        },
      });

      return OrderService.formatOrder(updatedOrder);
    });
  }

  /**
   * ১২. অর্ডার স্ট্যাটাস ম্যানুয়াল পরিবর্তন (IN_PROGRESS, READY, OUT_FOR_DELIVERY)
   */
  static async updateOrderStatus(
    id: string,
    dto: UpdateOrderStatusDto,
    userId: string
  ) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { khataAssignments: true },
    });

    if (!order) {
      throw ApiError.notFound(`Order not found with ID: ${id}`);
    }

    if (order.status === 'CANCELLED') {
      throw ApiError.badRequest('Cannot update status of a cancelled order');
    }

    if (order.status === 'DELIVERED') {
      throw ApiError.badRequest('Order is already delivered');
    }

    // স্ট্যাটাস ম্যাপিং (WRITING আসলে IN_PROGRESS সেট করা)
    const targetStatus = dto.status === 'WRITING' ? 'IN_PROGRESS' : dto.status;

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: {
          status: targetStatus,
          ...(dto.deliveryPersonName && {
            deliveryPersonName: dto.deliveryPersonName.trim(),
          }),
        },
        include: {
          subjectPricing: true,
          preferredWriter: true,
          khataAssignments: {
            include: {
              branch: { select: { id: true, name: true } },
              writer: { select: { id: true, name: true, phone: true } },
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE_ORDER_STATUS',
          entityType: 'Order',
          entityId: order.id,
          details: {
            orderNumber: order.orderNumber,
            previousStatus: order.status,
            newStatus: targetStatus,
            deliveryPersonName: dto.deliveryPersonName || order.deliveryPersonName,
          },
        },
      });

      return OrderService.formatOrder(updated);
    });
  }

  /**
   * ১৩. অর্ডার প্রগ্রেস ও সব রাইটারদের বর্তমান কাজের অবস্থা (Progress Tracking)
   */
  static async getOrderProgress(id: string) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        subjectPricing: true,
        preferredWriter: {
          select: { id: true, name: true, district: true },
        },
        khataAssignments: {
          include: {
            branch: { select: { id: true, name: true, phone: true } },
            writer: { select: { id: true, name: true, phone: true } },
          },
          orderBy: { batchNumber: 'asc' },
        },
      },
    });

    if (!order) {
      throw ApiError.notFound(`Order not found with ID: ${id}`);
    }

    const totalQuantity = order.quantity;
    const totalAssignedQty = order.khataAssignments.reduce((sum, k) => sum + k.receivedQty, 0);
    const totalSubmittedQty = order.khataAssignments.reduce((sum, k) => sum + k.submittedQty, 0);
    const totalPendingQty = Math.max(0, totalQuantity - totalSubmittedQty);
    const completionPercentage = totalQuantity > 0 ? Math.round((totalSubmittedQty / totalQuantity) * 100) : 0;

    const isAllCompleted =
      order.khataAssignments.length > 0 &&
      order.khataAssignments.every((k) => k.status === 'COMPLETED');

    const assignments = order.khataAssignments.map((k) => ({
      khataId: k.id,
      batchNumber: k.batchNumber,
      branch: {
        id: k.branch.id,
        name: k.branch.name,
        phone: k.branch.phone,
      },
      writer: {
        id: k.writer.id,
        name: k.writer.name,
        phone: k.writer.phone,
      },
      assignedQty: k.receivedQty,
      submittedQty: k.submittedQty,
      pendingQty: k.receivedQty - k.submittedQty,
      status: k.status,
      distributedAt: k.distributedAt,
      submittedAt: k.submittedAt,
    }));

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      deliveryAddress: order.customerAddress,
      subject: `${order.subjectPricing.subjectName} (${order.subjectPricing.className})`,
      totalQuantity,
      totalAssignedQty,
      totalSubmittedQty,
      totalPendingQty,
      completionPercentage,
      status: order.status,
      paymentStatus: order.paymentStatus,
      isReadyForDelivery: isAllCompleted,
      assignmentsCount: assignments.length,
      assignments,
    };
  }

  /**
   * ১৪. ডেলিভারি সম্পন্ন ও ক্যাশ কালেকশন কনফার্মেশন (Deliver Order)
   * বিজনেস রুল:
   * - এটা তখনই allow করবে যখন সব khataAssignments-এর status COMPLETED (সব Writer তাদের অংশ জমা দিয়েছে)
   * - নাহলে এরর দেবে: "এখনও X জন Writer-এর কাজ বাকি"
   */
  static async deliverOrder(id: string, userId: string) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        khataAssignments: {
          include: {
            writer: { select: { id: true, name: true, phone: true } },
          },
        },
      },
    });

    if (!order) {
      throw ApiError.notFound(`Order not found with ID: ${id}`);
    }

    if (order.status === 'CANCELLED') {
      throw ApiError.badRequest('Cannot deliver a cancelled order');
    }

    if (order.status === 'DELIVERED') {
      throw ApiError.badRequest('Order is already marked as DELIVERED');
    }

    if (order.khataAssignments.length === 0) {
      throw ApiError.badRequest('Cannot deliver order: No khatas/writers have been assigned to this order yet.');
    }

    // সব রাইটারের কাজ শেষ হয়েছে কি না চেক (Gate Check)
    const incompleteAssignments = order.khataAssignments.filter(
      (k) => k.status !== 'COMPLETED'
    );

    if (incompleteAssignments.length > 0) {
      const pendingCount = incompleteAssignments.length;
      const pendingWritersList = incompleteAssignments
        .map((k) => `${k.writer.name} (${k.receivedQty - k.submittedQty} pending)`)
        .join(', ');

      throw ApiError.badRequest(
        `Cannot deliver order: ${pendingCount} writer(s) have not completed their work yet. Pending writers: [${pendingWritersList}]. All writers must mark their work as COMPLETED before delivery.`
      );
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: {
          status: 'DELIVERED',
          paymentStatus: 'COLLECTED',
          deliveredAt: new Date(),
        },
        include: {
          subjectPricing: true,
          preferredWriter: true,
          khataAssignments: {
            include: {
              branch: { select: { id: true, name: true } },
              writer: { select: { id: true, name: true } },
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'DELIVER_ORDER',
          entityType: 'Order',
          entityId: order.id,
          details: {
            orderNumber: order.orderNumber,
            collectedAmount: Number(order.totalAmount),
            status: 'DELIVERED',
            paymentStatus: 'COLLECTED',
            writersCount: order.khataAssignments.length,
          },
        },
      });

      return OrderService.formatOrder(updated);
    });
  }

  /**
   * ১৫. অর্ডার বাতিল করা (Cancel Order)
   */
  static async cancelOrder(id: string, dto: CancelOrderDto, userId: string) {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw ApiError.notFound(`Order not found with ID: ${id}`);
    }

    if (order.status === 'DELIVERED') {
      throw ApiError.badRequest('Cannot cancel an order that has already been delivered');
    }

    if (order.status === 'CANCELLED') {
      throw ApiError.badRequest('Order is already cancelled');
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelReason: dto.note.trim(),
        },
        include: {
          subjectPricing: true,
          preferredWriter: true,
          khataAssignments: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CANCEL_ORDER',
          entityType: 'Order',
          entityId: order.id,
          details: {
            orderNumber: order.orderNumber,
            status: 'CANCELLED',
            cancelReason: dto.note.trim(),
          },
        },
      });

      return OrderService.formatOrder(updated);
    });
  }
}

export default OrderService;
