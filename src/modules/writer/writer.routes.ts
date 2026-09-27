import { Router } from 'express';
import {
  createWriter,
  getAllWriters,
  getWriterById,
  updateWriter,
  toggleWriterStatus,
  deleteWriter,
  getWriterKhataHistory,
  getWriterPaymentHistory,
} from './writer.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { allowedRoles } from '../../middlewares/rbac.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  createWriterSchema,
  updateWriterSchema,
  writerQuerySchema,
  writerIdParamSchema,
  khataHistoryQuerySchema,
  paymentHistoryQuerySchema,
} from './writer.types.js';

const router = Router();

// রাইটার মডিউলের সব রুটে লগইন থাকা বাধ্যতামূলক
router.use(authenticate);

/**
 * @route   POST /api/writers
 * @desc    নতুন লেখক তৈরি
 * @access  Private (SUPER_ADMIN, ADMIN)
 */
router.post(
  '/',
  allowedRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ body: createWriterSchema }),
  createWriter
);

/**
 * @route   GET /api/writers
 * @desc    সব লেখকের তালিকা (পেজিনেশন, সার্চ ও ফিল্টারসহ)
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.get(
  '/',
  allowedRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  validate({ query: writerQuerySchema }),
  getAllWriters
);

/**
 * @route   GET /api/writers/:id/khata-history
 * @desc    লেখকের সব খাতা হিস্টোরি (তারিখ অনুযায়ী ও পেজিনেশনসহ)
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.get(
  '/:id/khata-history',
  allowedRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  validate({ params: writerIdParamSchema, query: khataHistoryQuerySchema }),
  getWriterKhataHistory
);

/**
 * @route   GET /api/writers/:id/payment-history
 * @desc    লেখকের সব পেমেন্ট হিস্টোরি (পেজিনেশনসহ)
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.get(
  '/:id/payment-history',
  allowedRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  validate({ params: writerIdParamSchema, query: paymentHistoryQuerySchema }),
  getWriterPaymentHistory
);

/**
 * @route   GET /api/writers/:id
 * @desc    একজন লেখকের বিস্তারিত প্রোফাইল ও এগ্রিগেশন পরিসংখ্যান
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.get(
  '/:id',
  allowedRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  validate({ params: writerIdParamSchema }),
  getWriterById
);

/**
 * @route   PATCH /api/writers/:id
 * @desc    লেখক তথ্য আপডেট করা
 * @access  Private (SUPER_ADMIN, ADMIN)
 */
router.patch(
  '/:id',
  allowedRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ params: writerIdParamSchema, body: updateWriterSchema }),
  updateWriter
);

/**
 * @route   PATCH /api/writers/:id/toggle-status
 * @desc    লেখক অ্যাক্টিভ/ইনঅ্যাক্টিভ স্ট্যাটাস টগল করা
 * @access  Private (SUPER_ADMIN, ADMIN)
 */
router.patch(
  '/:id/toggle-status',
  allowedRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ params: writerIdParamSchema }),
  toggleWriterStatus
);

/**
 * @route   DELETE /api/writers/:id
 * @desc    লেখক ডিলিট করা (পেন্ডিং খাতা বা বকেয়া থাকলে ব্লক হবে)
 * @access  Private (শুধুমাত্র SUPER_ADMIN)
 */
router.delete(
  '/:id',
  allowedRoles('SUPER_ADMIN'),
  validate({ params: writerIdParamSchema }),
  deleteWriter
);

export default router;
