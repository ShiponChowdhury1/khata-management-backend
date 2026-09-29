import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getPublicClasses,
  getPublicSubjectPricings,
  getPublicWritersByDistrict,
  createPublicOrder,
  trackPublicOrder,
  getAllOrders,
  getOrderById,
  suggestWriters,
  confirmOrder,
  assignOrder,
  updateOrderStatus,
  getOrderProgress,
  deliverOrder,
  cancelOrder,
  createSubjectPricing,
  getAllSubjectPricings,
  updateSubjectPricing,
} from './order.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { allowedRoles } from '../../middlewares/rbac.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  createSubjectPricingSchema,
  updateSubjectPricingSchema,
  publicSubjectPricingQuerySchema,
  writersByDistrictQuerySchema,
  createPublicOrderSchema,
  trackOrderQuerySchema,
  orderQuerySchema,
  assignOrderSchema,
  updateOrderStatusSchema,
  cancelOrderSchema,
  orderIdParamSchema,
  subjectPricingIdParamSchema,
} from './order.types.js';

// ==========================================
// ১. পাবলিক রাউটার (/api/public/*)
// রেট লিমিটিং: প্রতি IP-তে ১৫ মিনিটে সর্বোচ্চ ৫টি অর্ডার (স্প্যাম প্রতিরোধে)
// ==========================================
export const publicRouter = Router();

const publicOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // ১৫ মিনিট
  limit: 5, // প্রতি IP-তে সর্বোচ্চ ৫টি অর্ডার
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many order requests from this IP. Please try again after 15 minutes.',
    timestamp: new Date().toISOString(),
  },
});

/**
 * @route   GET /api/public/classes
 * @desc    পাবলিক সক্রিয় শ্রেণি/ক্লাস তালিকা (displayOrder অনুযায়ী)
 * @access  Public
 */
publicRouter.get('/classes', getPublicClasses);

/**
 * @route   GET /api/public/subject-pricing
 * @desc    সব সক্রিয় বিষয় ও ক্লাসের প্র্যাকটিক্যাল খাতার ফি তালিকা (ঐচ্ছিক classId ফিল্টার সহ)
 * @access  Public
 */
publicRouter.get(
  '/subject-pricing',
  validate({ query: publicSubjectPricingQuerySchema }),
  getPublicSubjectPricings
);

/**
 * @route   GET /api/public/writers-by-district
 * @desc    নির্দিষ্ট জেলার সক্রিয় রাইটারদের তালিকা (নিরাপদ ভিউ: ফোন/সংবেদনশীল তথ্য ছাড়া)
 * @access  Public
 */
publicRouter.get(
  '/writers-by-district',
  validate({ query: writersByDistrictQuerySchema }),
  getPublicWritersByDistrict
);

/**
 * @route   POST /api/public/orders
 * @desc    নতুন স্টুডেন্ট প্র্যাকটিক্যাল খাতার অর্ডার তৈরি (Cash On Delivery)
 * @access  Public (Rate Limited: 5 orders per 15 min)
 */
publicRouter.post(
  '/orders',
  publicOrderLimiter,
  validate({ body: createPublicOrderSchema }),
  createPublicOrder
);

/**
 * @route   GET /api/public/orders/track
 * @desc    অর্ডার নম্বর ও মোবাইল নম্বর দিয়ে পাবলিক স্ট্যাটাস ট্র্যাকিং
 * @access  Public
 */
publicRouter.get(
  '/orders/track',
  validate({ query: trackOrderQuerySchema }),
  trackPublicOrder
);

// ==========================================
// ২. অ্যাডমিন অর্ডার রাউটার (/api/orders/*)
// ==========================================
export const adminOrderRouter = Router();

adminOrderRouter.use(authenticate);

/**
 * @route   GET /api/orders
 * @desc    সব অর্ডারের তালিকা (পেজিনেশন ও ফিল্টার সহ)
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
adminOrderRouter.get(
  '/',
  allowedRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  validate({ query: orderQuerySchema }),
  getAllOrders
);

/**
 * @route   GET /api/orders/:id
 * @desc    একটি নির্দিষ্ট অর্ডারের বিস্তারিত তথ্য
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
adminOrderRouter.get(
  '/:id',
  allowedRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  validate({ params: orderIdParamSchema }),
  getOrderById
);

/**
 * @route   GET /api/orders/:id/suggest-writers
 * @desc    অর্ডারের জেলা অনুযায়ী সক্রিয় রাইটারদের কাজের চাপ (Workload) সহ সাজেশন
 * @access  Private (SUPER_ADMIN, ADMIN)
 */
adminOrderRouter.get(
  '/:id/suggest-writers',
  allowedRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ params: orderIdParamSchema }),
  suggestWriters
);

/**
 * @route   PATCH /api/orders/:id/confirm
 * @desc    অর্ডার নিশ্চিতকরণ (CONFIRMED)
 * @access  Private (SUPER_ADMIN, ADMIN)
 */
adminOrderRouter.patch(
  '/:id/confirm',
  allowedRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ params: orderIdParamSchema }),
  confirmOrder
);

/**
 * @route   PATCH /api/orders/:id/assign
 * @desc    অর্ডার একাধিক রাইটারের মধ্যে স্প্লিট করে অ্যাসাইন করা এবং স্বয়ংক্রিয় খাতা তৈরি
 * @access  Private (SUPER_ADMIN, ADMIN)
 */
adminOrderRouter.patch(
  '/:id/assign',
  allowedRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ params: orderIdParamSchema, body: assignOrderSchema }),
  assignOrder
);

/**
 * @route   PATCH /api/orders/:id/status
 * @desc    ম্যানুয়ালি স্ট্যাটাস আপডেট (IN_PROGRESS, READY, OUT_FOR_DELIVERY)
 * @access  Private (SUPER_ADMIN, ADMIN)
 */
adminOrderRouter.patch(
  '/:id/status',
  allowedRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ params: orderIdParamSchema, body: updateOrderStatusSchema }),
  updateOrderStatus
);

/**
 * @route   GET /api/orders/:id/progress
 * @desc    অর্ডারের সব অ্যাসাইনকৃত রাইটারদের খাতা জমার অগ্রগতি ও শতকরা হিসাব
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
adminOrderRouter.get(
  '/:id/progress',
  allowedRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  validate({ params: orderIdParamSchema }),
  getOrderProgress
);

/**
 * @route   PATCH /api/orders/:id/deliver
 * @desc    ডেলিভারি সম্পন্ন ও ক্যাশ কালেকশন কনফার্মেশন (সব রাইটারের কাজ শেষ হলে তবেই অনুমতি দেয়)
 * @access  Private (SUPER_ADMIN, ADMIN)
 */
adminOrderRouter.patch(
  '/:id/deliver',
  allowedRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ params: orderIdParamSchema }),
  deliverOrder
);

/**
 * @route   PATCH /api/orders/:id/cancel
 * @desc    অর্ডার বাতিল করা
 * @access  Private (SUPER_ADMIN, ADMIN)
 */
adminOrderRouter.patch(
  '/:id/cancel',
  allowedRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ params: orderIdParamSchema, body: cancelOrderSchema }),
  cancelOrder
);

// ==========================================
// ৩. সাবজেক্ট প্রাইসিং ম্যানেজমেন্ট রাউটার (/api/subject-pricing/*)
// ==========================================
export const subjectPricingRouter = Router();

subjectPricingRouter.use(authenticate);

/**
 * @route   GET /api/subject-pricing
 * @desc    সব সাবজেক্ট প্রাইসিং তালিকা (অ্যাডমিন ভিউ)
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
subjectPricingRouter.get(
  '/',
  allowedRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  getAllSubjectPricings
);

/**
 * @route   POST /api/subject-pricing
 * @desc    নতুন বিষয় ও শ্রেণির জন্য খাতার মূল্য নির্ধারণ
 * @access  Private (SUPER_ADMIN, ADMIN)
 */
subjectPricingRouter.post(
  '/',
  allowedRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ body: createSubjectPricingSchema }),
  createSubjectPricing
);

/**
 * @route   PATCH /api/subject-pricing/:id
 * @desc    সাবজেক্ট প্রাইসিং বা স্ট্যাটাস আপডেট
 * @access  Private (SUPER_ADMIN, ADMIN)
 */
subjectPricingRouter.patch(
  '/:id',
  allowedRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ params: subjectPricingIdParamSchema, body: updateSubjectPricingSchema }),
  updateSubjectPricing
);

export default {
  publicRouter,
  adminOrderRouter,
  subjectPricingRouter,
};
