import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import userRoutes from '../modules/user/user.routes.js';
import classRoutes from '../modules/class/class.routes.js';
import subjectRoutes from '../modules/subject/subject.routes.js';
import branchRoutes from '../modules/branch/branch.routes.js';
import writerRoutes from '../modules/writer/writer.routes.js';
import khataRoutes from '../modules/khata/khata.routes.js';
import paymentRoutes from '../modules/payment/payment.routes.js';
import stockRoutes from '../modules/stock/stock.routes.js';
import reportRoutes from '../modules/report/report.routes.js';
import {
  publicRouter as publicOrderRoutes,
  adminOrderRouter as orderRoutes,
  subjectPricingRouter,
} from '../modules/order/order.routes.js';
import healthRoutes from './health.route.js';

const rootRouter = Router();

// হেলথ চেক রুট (/api/health)
rootRouter.use('/health', healthRoutes);

// পাবলিক বি২সি রুটস (/api/public/*) — কোনো অথেনটিকেশন ছাড়াই অ্যাক্সেসযোগ্য
rootRouter.use('/public', publicOrderRoutes);

// ফিচার মডিউল রুটস (প্রটেক্টেড)
rootRouter.use('/auth', authRoutes);
rootRouter.use('/users', userRoutes);
rootRouter.use('/classes', classRoutes);
rootRouter.use('/subjects', subjectRoutes);
rootRouter.use('/branches', branchRoutes);
rootRouter.use('/writers', writerRoutes);
rootRouter.use('/khatas', khataRoutes);
rootRouter.use('/payments', paymentRoutes);
rootRouter.use('/stocks', stockRoutes);
rootRouter.use('/reports', reportRoutes);
rootRouter.use('/orders', orderRoutes);
rootRouter.use('/subject-pricing', subjectPricingRouter);

export default rootRouter;
