import { Router } from 'express';
import {
  createBranch,
  getAllBranches,
  getBranchById,
  updateBranch,
  toggleBranchStatus,
  deleteBranch,
} from './branch.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { allowedRoles } from '../../middlewares/rbac.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  createBranchSchema,
  updateBranchSchema,
  branchQuerySchema,
  branchIdParamSchema,
} from './branch.types.js';

const router = Router();

// প্রতিটি রুটের জন্য অথেনটিকেশন বাধ্যতামূলক
router.use(authenticate);

/**
 * @route   POST /api/branches
 * @desc    নতুন ব্রাঞ্চ তৈরি
 * @access  Private (শুধুমাত্র SUPER_ADMIN)
 */
router.post(
  '/',
  allowedRoles('SUPER_ADMIN'),
  validate({ body: createBranchSchema }),
  createBranch
);

/**
 * @route   GET /api/branches
 * @desc    সব ব্রাঞ্চের তালিকা (পেজিনেশন ও সার্চ সহ)
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.get(
  '/',
  allowedRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  validate({ query: branchQuerySchema }),
  getAllBranches
);

/**
 * @route   GET /api/branches/:id
 * @desc    একটি ব্রাঞ্চের বিস্তারিত পরিসংখ্যান (Writers, Khatas, Stocks summary)
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.get(
  '/:id',
  allowedRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  validate({ params: branchIdParamSchema }),
  getBranchById
);

/**
 * @route   PATCH /api/branches/:id
 * @desc    ব্রাঞ্চের তথ্য আপডেট করা
 * @access  Private (SUPER_ADMIN, ADMIN)
 */
router.patch(
  '/:id',
  allowedRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ params: branchIdParamSchema, body: updateBranchSchema }),
  updateBranch
);

/**
 * @route   PATCH /api/branches/:id/toggle-status
 * @desc    ব্রাঞ্চের সক্রিয়/নিষ্ক্রিয় স্ট্যাটাস টগল করা (isActive)
 * @access  Private (শুধুমাত্র SUPER_ADMIN)
 */
router.patch(
  '/:id/toggle-status',
  allowedRoles('SUPER_ADMIN'),
  validate({ params: branchIdParamSchema }),
  toggleBranchStatus
);

/**
 * @route   DELETE /api/branches/:id
 * @desc    ব্রাঞ্চ ডিলিট করা (Active Writer বা Khata থাকলে সুরক্ষিতভাবে ব্লক করা হবে)
 * @access  Private (শুধুমাত্র SUPER_ADMIN)
 */
router.delete(
  '/:id',
  allowedRoles('SUPER_ADMIN'),
  validate({ params: branchIdParamSchema }),
  deleteBranch
);

export default router;
