import type { Request, Response } from 'express';
import { OrderService } from './order.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import type {
  TrackOrderQueryDto,
  OrderQueryDto,
  WritersByDistrictQueryDto,
} from './order.types.js';

/**
 * অর্ডার ও প্রাইসিং কন্ট্রোলার
 */

// ==========================================
// পাবলিক কন্ট্রোলার হ্যান্ডলারস (Public Endpoints)
// ==========================================

// ১. পাবলিক বিষয় ও ফি তালিকা (GET /api/public/subject-pricing)
export const getPublicSubjectPricings = asyncHandler(async (_req: Request, res: Response) => {
  const pricings = await OrderService.getActiveSubjectPricings();
  sendSuccess(res, 200, 'Subject pricings retrieved successfully', pricings);
});

// ২. পাবলিক জেলাভিত্তিক লেখক তালিকা (GET /api/public/writers-by-district?district=Khulna)
export const getPublicWritersByDistrict = asyncHandler(async (req: Request, res: Response) => {
  const { district } = req.query as unknown as WritersByDistrictQueryDto;
  const writers = await OrderService.getWritersByDistrict(district);
  sendSuccess(res, 200, `Active writers for district '${district}' retrieved successfully`, writers);
});

// ৩. পাবলিক অর্ডার তৈরি (POST /api/public/orders)
export const createPublicOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await OrderService.createPublicOrder(req.body);
  sendSuccess(
    res,
    201,
    'Practical khata order placed successfully! Please save your Order Number to track status.',
    order
  );
});

// ৪. পাবলিক অর্ডার ট্র্যাকিং (GET /api/public/orders/track)
export const trackPublicOrder = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as TrackOrderQueryDto;
  const status = await OrderService.trackPublicOrder(query);
  sendSuccess(res, 200, 'Order tracking details retrieved successfully', status);
});

// ==========================================
// অ্যাডমিন অর্ডার কন্ট্রোলার হ্যান্ডলারস (Admin Endpoints)
// ==========================================

// ৫. সব অর্ডার তালিকা (GET /api/orders)
export const getAllOrders = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as OrderQueryDto;
  const result = await OrderService.getAllOrders(query);
  sendSuccess(res, 200, 'Orders retrieved successfully', result.orders, result.meta);
});

// ৬. নির্দিষ্ট অর্ডারের বিস্তারিত (GET /api/orders/:id)
export const getOrderById = asyncHandler(async (req: Request, res: Response) => {
  const orderId = req.params.id as string;
  const order = await OrderService.getOrderById(orderId);
  sendSuccess(res, 200, 'Order details retrieved successfully', order);
});

// ৭. অর্ডার কনফার্ম করা (PATCH /api/orders/:id/confirm)
export const confirmOrder = asyncHandler(async (req: Request, res: Response) => {
  const orderId = req.params.id as string;
  const userId = req.user!.userId;
  const order = await OrderService.confirmOrder(orderId, userId);
  sendSuccess(res, 200, `Order '${order.orderNumber}' confirmed successfully`, order);
});

// ৮. অর্ডার মাল্টি-রাইটার স্প্লিট অ্যাসাইনমেন্ট (PATCH /api/orders/:id/assign)
export const assignOrder = asyncHandler(async (req: Request, res: Response) => {
  const orderId = req.params.id as string;
  const userId = req.user!.userId;
  const order = await OrderService.assignOrder(orderId, req.body, userId);
  sendSuccess(
    res,
    200,
    `Order '${order.orderNumber}' split and assigned across ${order.khataAssignments?.length || 0} writer(s) successfully`,
    order
  );
});

// ৯. অর্ডার স্ট্যাটাস ম্যানুয়াল পরিবর্তন (PATCH /api/orders/:id/status)
export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const orderId = req.params.id as string;
  const userId = req.user!.userId;
  const order = await OrderService.updateOrderStatus(orderId, req.body, userId);
  sendSuccess(res, 200, `Order '${order.orderNumber}' status updated to '${order.status}'`, order);
});

// ১০. অর্ডারের প্রগ্রেস ও রাইটারদের জমা খাতার অবস্থা (GET /api/orders/:id/progress)
export const getOrderProgress = asyncHandler(async (req: Request, res: Response) => {
  const orderId = req.params.id as string;
  const progress = await OrderService.getOrderProgress(orderId);
  sendSuccess(res, 200, `Order '${progress.orderNumber}' progress retrieved successfully`, progress);
});

// ১১. ডেলিভারি সম্পন্ন ও ক্যাশ গ্রহণ (PATCH /api/orders/:id/deliver)
export const deliverOrder = asyncHandler(async (req: Request, res: Response) => {
  const orderId = req.params.id as string;
  const userId = req.user!.userId;
  const order = await OrderService.deliverOrder(orderId, userId);
  sendSuccess(
    res,
    200,
    `Order '${order.orderNumber}' delivered and cash payment collected successfully`,
    order
  );
});

// ১২. অর্ডার বাতিল করা (PATCH /api/orders/:id/cancel)
export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  const orderId = req.params.id as string;
  const userId = req.user!.userId;
  const order = await OrderService.cancelOrder(orderId, req.body, userId);
  sendSuccess(res, 200, `Order '${order.orderNumber}' has been cancelled`, order);
});

// ==========================================
// অ্যাডমিন সাবজেক্ট প্রাইসিং কন্ট্রোলার হ্যান্ডলারস
// ==========================================

// ১৩. নতুন সাবজেক্ট প্রাইসিং তৈরি (POST /api/subject-pricing)
export const createSubjectPricing = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const pricing = await OrderService.createSubjectPricing(req.body, userId);
  sendSuccess(res, 201, 'Subject pricing created successfully', pricing);
});

// ১৪. সব সাবজেক্ট প্রাইসিং তালিকা (GET /api/subject-pricing)
export const getAllSubjectPricings = asyncHandler(async (_req: Request, res: Response) => {
  const pricings = await OrderService.getAllSubjectPricings();
  sendSuccess(res, 200, 'All subject pricings retrieved successfully', pricings);
});

// ১৫. সাবজেক্ট প্রাইসিং আপডেট (PATCH /api/subject-pricing/:id)
export const updateSubjectPricing = asyncHandler(async (req: Request, res: Response) => {
  const pricingId = req.params.id as string;
  const userId = req.user!.userId;
  const pricing = await OrderService.updateSubjectPricing(pricingId, req.body, userId);
  sendSuccess(res, 200, 'Subject pricing updated successfully', pricing);
});
