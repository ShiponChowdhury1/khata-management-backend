import { Router } from 'express';
import {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  toggleUserStatus,
  changePassword,
} from './user.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { allowedRoles } from '../../middlewares/rbac.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  createUserSchema,
  updateUserSchema,
  changePasswordSchema,
  userQuerySchema,
  userIdParamSchema,
} from './user.types.js';

const router = Router();

// সমস্ত রুটেই অথেন্টিকেশন প্রযোজ্য
router.use(authenticate);

/**
 * @route   PATCH /api/users/me/password
 * @desc    লগইন করা ব্যবহারকারী কর্তৃক নিজের পাসওয়ার্ড পরিবর্তন
 * @access  Private (All Authenticated Users)
 */
router.patch(
  '/me/password',
  validate({ body: changePasswordSchema }),
  changePassword
);

/**
 * @route   POST /api/users
 * @desc    নতুন ইউজার তৈরি (Role: ADMIN বা MANAGER)
 * @access  Private (SUPER_ADMIN)
 */
router.post(
  '/',
  allowedRoles('SUPER_ADMIN'),
  validate({ body: createUserSchema }),
  createUser
);

/**
 * @route   GET /api/users
 * @desc    সব ইউজারের তালিকা (ফিল্টার ও পেজিনেশন সহ)
 * @access  Private (SUPER_ADMIN)
 */
router.get(
  '/',
  allowedRoles('SUPER_ADMIN'),
  validate({ query: userQuerySchema }),
  getAllUsers
);

/**
 * @route   GET /api/users/:id
 * @desc    নির্দিষ্ট ইউজারের বিস্তারিত তথ্য
 * @access  Private (SUPER_ADMIN)
 */
router.get(
  '/:id',
  allowedRoles('SUPER_ADMIN'),
  validate({ params: userIdParamSchema }),
  getUserById
);

/**
 * @route   PATCH /api/users/:id
 * @desc    ইউজারের নাম বা রোল আপডেট করা
 * @access  Private (SUPER_ADMIN)
 */
router.patch(
  '/:id',
  allowedRoles('SUPER_ADMIN'),
  validate({ params: userIdParamSchema, body: updateUserSchema }),
  updateUser
);

/**
 * @route   PATCH /api/users/:id/toggle-status
 * @desc    ইউজার অ্যাক্টিভেট/ডিঅ্যাক্টিভেট করা
 * @access  Private (SUPER_ADMIN)
 */
router.patch(
  '/:id/toggle-status',
  allowedRoles('SUPER_ADMIN'),
  validate({ params: userIdParamSchema }),
  toggleUserStatus
);

export default router;
