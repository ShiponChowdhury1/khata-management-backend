import { Router } from 'express';
import {
  createSubject,
  getAllSubjects,
  getSubjectById,
  updateSubject,
  toggleSubjectStatus,
  deleteSubject,
} from './subject.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { allowedRoles } from '../../middlewares/rbac.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  createSubjectSchema,
  updateSubjectSchema,
  subjectQuerySchema,
  subjectIdParamSchema,
} from './subject.types.js';

const router = Router();

// প্রতিটি বিষয় রুটের জন্য অথেনটিকেশন বাধ্যতামূলক
router.use(authenticate);

/**
 * @route   GET /api/subjects
 * @desc    সব বিষয়ের তালিকা (পেজিনেশন, সার্চ ও ফিল্টারিং সহ)
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.get(
  '/',
  allowedRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  validate({ query: subjectQuerySchema }),
  getAllSubjects
);

/**
 * @route   POST /api/subjects
 * @desc    নতুন বিষয় তৈরি করা
 * @access  Private (SUPER_ADMIN, ADMIN)
 */
router.post(
  '/',
  allowedRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ body: createSubjectSchema }),
  createSubject
);

/**
 * @route   GET /api/subjects/:id
 * @desc    একটি নির্দিষ্ট বিষয়ের বিবরণ
 * @access  Private (SUPER_ADMIN, ADMIN, MANAGER)
 */
router.get(
  '/:id',
  allowedRoles('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  validate({ params: subjectIdParamSchema }),
  getSubjectById
);

/**
 * @route   PATCH /api/subjects/:id
 * @desc    বিষয়ের নাম আপডেট করা
 * @access  Private (SUPER_ADMIN, ADMIN)
 */
router.patch(
  '/:id',
  allowedRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ params: subjectIdParamSchema, body: updateSubjectSchema }),
  updateSubject
);

/**
 * @route   PATCH /api/subjects/:id/toggle-status
 * @desc    বিষয়ের স্ট্যাটাস টগল (Active/Inactive)
 * @access  Private (SUPER_ADMIN, ADMIN)
 */
router.patch(
  '/:id/toggle-status',
  allowedRoles('SUPER_ADMIN', 'ADMIN'),
  validate({ params: subjectIdParamSchema }),
  toggleSubjectStatus
);

/**
 * @route   DELETE /api/subjects/:id
 * @desc    বিষয় মুছে ফেলা (কোনো SubjectPricing যুক্ত থাকলে ব্লক করা)
 * @access  Private (SUPER_ADMIN only)
 */
router.delete(
  '/:id',
  allowedRoles('SUPER_ADMIN'),
  validate({ params: subjectIdParamSchema }),
  deleteSubject
);

export default router;
