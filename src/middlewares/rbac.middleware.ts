import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { Role } from '../../generated/prisma/client.js';
import { ApiError } from '../utils/apiError.js';

/**
 * রোল-ভিত্তিক এক্সেস কন্ট্রোল (RBAC) মিডলওয়্যার ফ্যাক্টরি
 * @param roles যে যে রোল এই রুটে অনুমোদন পাবে (SUPER_ADMIN, ADMIN, MANAGER)
 */
export const allowedRoles = (...roles: Role[]): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // ১. ইউজার অথেন্টিকেটেড কি না যাচাই
    if (!req.user) {
      next(ApiError.unauthorized('Authentication required before checking permissions'));
      return;
    }

    // ২. ইউজারের ভূমিকা অনুমোদিত তালিকার অন্তর্ভুক্ত কি না যাচাই
    if (!roles.includes(req.user.role)) {
      next(
        ApiError.forbidden(
          `Forbidden: Role '${req.user.role}' does not have permission to access this resource`
        )
      );
      return;
    }

    next();
  };
};

export default allowedRoles;
