import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, refreshToken, getMe } from './auth.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { allowedRoles } from '../../middlewares/rbac.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { registerSchema, loginSchema, refreshTokenSchema } from './auth.types.js';

const router = Router();

// লগইন রেট লিমিটিং: প্রতি IP-তে ১৫ মিনিটে সর্বোচ্চ ১০টি চেষ্টা
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // ১৫ মিনিট
  limit: 10, // প্রতি IP-তে সর্বোচ্চ ১০টি রিকোয়েস্ট
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts from this IP. Please try again after 15 minutes.',
    timestamp: new Date().toISOString(),
  },
});

/**
 * @route   POST /api/auth/register
 * @desc    নতুন ইউজার তৈরি (শুধুমাত্র SUPER_ADMIN অনুমোদিত)
 * @access  Protected (SUPER_ADMIN)
 */
router.post(
  '/register',
  authenticate,
  allowedRoles('SUPER_ADMIN'),
  validate({ body: registerSchema }),
  register
);

/**
 * @route   POST /api/auth/login
 * @desc    ইউজার লগইন ও টোকেন গ্রহণ (রেট লিমিটেড: ১৫ মিনিটে সর্বোচ্চ ১০টি)
 * @access  Public
 */
router.post(
  '/login',
  loginLimiter,
  validate({ body: loginSchema }),
  login
);

/**
 * @route   POST /api/auth/refresh
 * @desc    রিফ্রেশ টোকেন দিয়ে নতুন এক্সেস টোকেন গ্রহণ
 * @access  Public
 */
router.post(
  '/refresh',
  validate({ body: refreshTokenSchema }),
  refreshToken
);

/**
 * @route   GET /api/auth/me
 * @desc    লগইন করা ইউজারের প্রোফাইল
 * @access  Protected (Bearer Token)
 */
router.get('/me', authenticate, getMe);

export default router;
