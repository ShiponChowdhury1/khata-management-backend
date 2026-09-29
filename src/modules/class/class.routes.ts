import { Router } from 'express';
import {
  createClass,
  getAllClasses,
  getClassById,
  updateClass,
  toggleClassStatus,
  deleteClass,
} from './class.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { allowedRoles } from '../../middlewares/rbac.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  createClassSchema,
  updateClassSchema,
  classQuerySchema,
  classIdParamSchema,
} from './class.types.js';

const router = Router();

// প্রতিটি ক্লাস রুটের জন্য অথেনটিকেশন বাধ্যতামূলক
router.use(authenticate);

/**
 * @route   GET /api/classes
 * @desc    সব ক্লাসের তালিকা (পেজিনেশন, সার্চ, ফিল্টারিং ও displayOrder অনুযায়ী)
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.get(
  '/',
  allowedRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  validate({ query: classQuerySchema }),
  getAllClasses
);

/**
 * @route   POST /api/classes
 * @desc    নতুন ক্লাস তৈরি করা
 * @access  Private (SUPER_ADMIN, ADMIN)
 */
router.post(
  '/',
  allowedRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ body: createClassSchema }),
  createClass
);

/**
 * @route   GET /api/classes/:id
 * @desc    একটি নির্দিষ্ট ক্লাসের বিবরণ
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.get(
  '/:id',
  allowedRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  validate({ params: classIdParamSchema }),
  getClassById
);

/**
 * @route   PATCH /api/classes/:id
 * @desc    ক্লাসের নাম বা displayOrder আপডেট করা
 * @access  Private (SUPER_ADMIN, ADMIN)
 */
router.patch(
  '/:id',
  allowedRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ params: classIdParamSchema, body: updateClassSchema }),
  updateClass
);

/**
 * @route   PATCH /api/classes/:id/toggle-status
 * @desc    ক্লাসের স্ট্যাটাস টগল (Active/Inactive)
 * @access  Private (SUPER_ADMIN, ADMIN)
 */
router.patch(
  '/:id/toggle-status',
  allowedRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ params: classIdParamSchema }),
  toggleClassStatus
);

/**
 * @route   DELETE /api/classes/:id
 * @desc    ক্লাস মুছে ফেলা (কোনো SubjectPricing যুক্ত থাকলে ব্লক করা)
 * @access  Private (SUPER_ADMIN only)
 */
router.delete(
  '/:id',
  allowedRoles('SUPER_ADMIN'),
  validate({ params: classIdParamSchema }),
  deleteClass
);

export default router;
