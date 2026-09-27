import { Router } from 'express';
import {
  calculateDue,
  createPayment,
  getAllPayments,
  getPaymentById,
  addPayment,
  getWriterPaymentSummary,
} from './payment.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { allowedRoles } from '../../middlewares/rbac.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  calculateDueSchema,
  createPaymentSchema,
  addPaymentSchema,
  paymentQuerySchema,
  paymentIdParamSchema,
  writerIdParamSchema,
} from './payment.types.js';

const router = Router();

// প্রতিটি পেমেন্ট রুটের জন্য অথেনটিকেশন বাধ্যতামূলক
router.use(authenticate);

/**
 * @route   POST /api/payments/calculate-due
 * @desc    লেখকভিত্তিক মোট আয়, পরিশোধিত টাকা ও বকেয়া হিসাব (ডেটাবেজে সেভ না করে)
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.post(
  '/calculate-due',
  allowedRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  validate({ body: calculateDueSchema }),
  calculateDue
);

/**
 * @route   POST /api/payments
 * @desc    নতুন পেমেন্ট রেকর্ড করা এবং খাতা অনুযায়ী বণ্টন (Atomic Transaction)
 * @access  Private (SUPER_ADMIN, ADMIN)
 */
router.post(
  '/',
  allowedRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ body: createPaymentSchema }),
  createPayment
);

/**
 * @route   GET /api/payments
 * @desc    সব পেমেন্টের তালিকা ফিল্টারিং ও পেজিনেশন সহ
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.get(
  '/',
  allowedRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  validate({ query: paymentQuerySchema }),
  getAllPayments
);

/**
 * @route   GET /api/payments/writer/:writerId/summary
 * @desc    একজন লেখকের সামগ্রিক পেমেন্ট ও খাতার বিস্তারিত সামারি
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.get(
  '/writer/:writerId/summary',
  allowedRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  validate({ params: writerIdParamSchema }),
  getWriterPaymentSummary
);

/**
 * @route   GET /api/payments/:id
 * @desc    একটি নির্দিষ্ট পেমেন্টের বিস্তারিত ও খাতা বণ্টন হিস্টোরি
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.get(
  '/:id',
  allowedRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  validate({ params: paymentIdParamSchema }),
  getPaymentById
);

/**
 * @route   PATCH /api/payments/:id/add-payment
 * @desc    DUE বা PARTIAL পেমেন্টে কিস্তির টাকা যোগ করা
 * @access  Private (SUPER_ADMIN, ADMIN)
 */
router.patch(
  '/:id/add-payment',
  allowedRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ params: paymentIdParamSchema, body: addPaymentSchema }),
  addPayment
);

export default router;
