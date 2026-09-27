import { Router } from 'express';
import {
  createKhata,
  getAllKhatas,
  getKhataById,
  submitKhata,
  updateKhata,
  deleteKhata,
  getBranchKhataSummary,
} from './khata.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { allowedRoles } from '../../middlewares/rbac.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  createKhataSchema,
  submitKhataSchema,
  updateKhataSchema,
  khataQuerySchema,
  khataIdParamSchema,
  branchIdParamSchema,
} from './khata.types.js';

const router = Router();

// প্রতিটি খাতা রুটের জন্য অথেনটিকেশন বাধ্যতামূলক
router.use(authenticate);

/**
 * @route   POST /api/khatas
 * @desc    নতুন খাতা/ব্যাচ তৈরি ও লেখকদের মাঝে বিতরণ
 * @access  Private (SUPER_ADMIN, ADMIN)
 */
router.post(
  '/',
  allowedRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ body: createKhataSchema }),
  createKhata
);

/**
 * @route   GET /api/khatas
 * @desc    সব খাতার তালিকা ফিল্টারিং ও পেজিনেশন সহ
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.get(
  '/',
  allowedRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  validate({ query: khataQuerySchema }),
  getAllKhatas
);

/**
 * @route   GET /api/khatas/branch/:branchId/summary
 * @desc    একটি নির্দিষ্ট ব্রাঞ্চের সব খাতার সামগ্রিক হিসাব ও সামারি
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.get(
  '/branch/:branchId/summary',
  allowedRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  validate({ params: branchIdParamSchema }),
  getBranchKhataSummary
);

/**
 * @route   GET /api/khatas/:id
 * @desc    একটি খাতার বিস্তারিত তথ্য
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.get(
  '/:id',
  allowedRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  validate({ params: khataIdParamSchema }),
  getKhataById
);

/**
 * @route   PATCH /api/khatas/:id/submit
 * @desc    খাতা জমা দেওয়ার মূল বিজনেস রুট (ইনক্রিমেন্টাল সাবমিশন)
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.patch(
  '/:id/submit',
  allowedRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  validate({ params: khataIdParamSchema, body: submitKhataSchema }),
  submitKhata
);

/**
 * @route   PATCH /api/khatas/:id
 * @desc    খাতা তথ্য আপডেট (batchNumber বা receivedQty)
 * @access  Private (SUPER_ADMIN, ADMIN)
 */
router.patch(
  '/:id',
  allowedRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ params: khataIdParamSchema, body: updateKhataSchema }),
  updateKhata
);

/**
 * @route   DELETE /api/khatas/:id
 * @desc    খাতা ডিলিট করা (কোনো জমা না হয়ে থাকলেই শুধুমাত্র সম্ভব)
 * @access  Private (শুধুমাত্র SUPER_ADMIN)
 */
router.delete(
  '/:id',
  allowedRoles('SUPER_ADMIN'),
  validate({ params: khataIdParamSchema }),
  deleteKhata
);

export default router;
