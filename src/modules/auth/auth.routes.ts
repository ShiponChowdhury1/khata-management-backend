import { Router } from 'express';
import { register, login, getMe } from './auth.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    নতুন ইউজার তৈরি
 * @access  Public (পরে প্রয়োজন অনুযায়ী SUPER_ADMIN দিয়ে প্রটেক্ট করা যাবে)
 */
router.post('/register', register);

/**
 * @route   POST /api/auth/login
 * @desc    ইউজার লগইন ও টোকেন গ্রহণ
 * @access  Public
 */
router.post('/login', login);

/**
 * @route   GET /api/auth/me
 * @desc    লগইন করা ইউজারের প্রোফাইল
 * @access  Protected (Bearer Token)
 */
router.get('/me', authenticate, getMe);

export default router;
