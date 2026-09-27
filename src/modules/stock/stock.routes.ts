import { Router } from 'express';
import {
  receiveStock,
  distributeStock,
  returnStock,
  getBranchStockStatus,
  getBranchStockHistory,
  getOverallStockSummary,
} from './stock.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { allowedRoles } from '../../middlewares/rbac.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  stockMovementSchema,
  stockHistoryQuerySchema,
  branchIdParamSchema,
} from './stock.types.js';

const router = Router();

// প্রতিটি স্টক রুটের জন্য অথেনটিকেশন বাধ্যতামূলক
router.use(authenticate);

/**
 * @route   GET /api/stocks/summary
 * @desc    সব ব্রাঞ্চের সামগ্রিক স্টক ও ড্যাশবোর্ড সামারি
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.get(
  '/summary',
  allowedRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  getOverallStockSummary
);

/**
 * @route   POST /api/stocks/receive
 * @desc    কেন্দ্র বা প্রেস থেকে ব্রাঞ্চে নতুন খাতা রিসিভ করা
 * @access  Private (SUPER_ADMIN, ADMIN)
 */
router.post(
  '/receive',
  allowedRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ body: stockMovementSchema }),
  receiveStock
);

/**
 * @route   POST /api/stocks/distribute
 * @desc    ব্রাঞ্চের স্টক থেকে খাতা বিতরণ করা (নেগেটিভ স্টক প্রতিরোধসহ)
 * @access  Private (SUPER_ADMIN, ADMIN)
 */
router.post(
  '/distribute',
  allowedRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ body: stockMovementSchema }),
  distributeStock
);

/**
 * @route   POST /api/stocks/return
 * @desc    অব্যবহৃত বা ফেরত আসা খাতা ইনভেন্টরিতে পুনঃযোগ করা
 * @access  Private (SUPER_ADMIN, ADMIN)
 */
router.post(
  '/return',
  allowedRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ body: stockMovementSchema }),
  returnStock
);

/**
 * @route   GET /api/stocks/branch/:branchId/history
 * @desc    একটি নির্দিষ্ট ব্রাঞ্চের সব স্টক মুভমেন্ট হিস্টোরি (ফিল্টারিং ও পেজিনেশন সহ)
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.get(
  '/branch/:branchId/history',
  allowedRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  validate({ params: branchIdParamSchema, query: stockHistoryQuerySchema }),
  getBranchStockHistory
);

/**
 * @route   GET /api/stocks/branch/:branchId
 * @desc    একটি নির্দিষ্ট ব্রাঞ্চের বর্তমান স্টক স্ট্যাটাস ও সর্বমোট কাউন্টার
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.get(
  '/branch/:branchId',
  allowedRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  validate({ params: branchIdParamSchema }),
  getBranchStockStatus
);

/**
 * @route   GET /api/stocks
 * @desc    রুট রিকোয়েস্টে সামগ্রিক স্টক সামারি প্রদান
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.get(
  '/',
  allowedRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  getOverallStockSummary
);

export default router;
