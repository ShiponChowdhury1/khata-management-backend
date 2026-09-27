import { Router } from 'express';
import {
  getDashboardSummary,
  getBranchWiseReport,
  getWriterWiseReport,
  getKhataDistributionReport,
  getKhataSubmissionReport,
  getPendingKhataReport,
  getPaymentReport,
  getDueReport,
  getStockReport,
} from './report.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { allowedRoles } from '../../middlewares/rbac.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  branchWiseReportQuerySchema,
  writerWiseReportQuerySchema,
  khataDistributionReportQuerySchema,
  khataSubmissionReportQuerySchema,
  pendingKhataReportQuerySchema,
  paymentReportQuerySchema,
  dueReportQuerySchema,
  stockReportQuerySchema,
} from './report.types.js';

const router = Router();

// প্রতিটি রিপোর্ট রুটের জন্য অথেনটিকেশন বাধ্যতামূলক
router.use(authenticate);

// সব রোলেই (SUPER_ADMIN, ADMIN, MANAGER) রিপোর্ট দেখার এক্সেস থাকবে (Read-only)
const reportRoles = allowedRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER');

/**
 * @route   GET /api/reports/dashboard-summary
 * @desc    মেইন ড্যাশবোর্ড ওভারভিউ সামারি
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.get(
  '/dashboard-summary',
  reportRoles,
  getDashboardSummary
);

/**
 * @route   GET /api/reports/branch-wise
 * @desc    সব ব্রাঞ্চের তুলনামূলক সামগ্রিক রিপোর্ট
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.get(
  '/branch-wise',
  reportRoles,
  validate({ query: branchWiseReportQuerySchema }),
  getBranchWiseReport
);

/**
 * @route   GET /api/reports/writer-wise
 * @desc    সব লেখকের পারফরম্যান্স ও বিলিং রিপোর্ট
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.get(
  '/writer-wise',
  reportRoles,
  validate({ query: writerWiseReportQuerySchema }),
  getWriterWiseReport
);

/**
 * @route   GET /api/reports/khata-distribution
 * @desc    খাতা বিতরণের তারিখভিত্তিক রিপোর্ট
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.get(
  '/khata-distribution',
  reportRoles,
  validate({ query: khataDistributionReportQuerySchema }),
  getKhataDistributionReport
);

/**
 * @route   GET /api/reports/khata-submission
 * @desc    খাতা জমার তারিখভিত্তিক রিপোর্ট
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.get(
  '/khata-submission',
  reportRoles,
  validate({ query: khataSubmissionReportQuerySchema }),
  getKhataSubmissionReport
);

/**
 * @route   GET /api/reports/pending-khata
 * @desc    সব অপরিশোধিত ও পেন্ডিং খাতার তালিকা
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.get(
  '/pending-khata',
  reportRoles,
  validate({ query: pendingKhataReportQuerySchema }),
  getPendingKhataReport
);

/**
 * @route   GET /api/reports/payment-report
 * @desc    পেমেন্ট লেনদেনের সামগ্রিক রিপোর্ট
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.get(
  '/payment-report',
  reportRoles,
  validate({ query: paymentReportQuerySchema }),
  getPaymentReport
);

/**
 * @route   GET /api/reports/due-report
 * @desc    লেখকভিত্তিক মোট বকেয়া (Due) রিপোর্ট
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.get(
  '/due-report',
  reportRoles,
  validate({ query: dueReportQuerySchema }),
  getDueReport
);

/**
 * @route   GET /api/reports/stock-report
 * @desc    ব্রাঞ্চভিত্তিক স্টক মুভমেন্ট ও বর্তমান মজুত রিপোর্ট
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.get(
  '/stock-report',
  reportRoles,
  validate({ query: stockReportQuerySchema }),
  getStockReport
);

export default router;
