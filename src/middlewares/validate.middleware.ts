import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { type ZodTypeAny, ZodError } from 'zod';
import { ApiError } from '../utils/apiError.js';

export interface RequestValidationSchema {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * রিকোয়েস্ট বডি, কুয়েরি ও প্যারামস ভ্যালিডেশন মিডলওয়্যার (Express 5 ও Zod সামঞ্জস্যপূর্ণ)
 */
export const validate = (schema: RequestValidationSchema): RequestHandler => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schema.params) {
        const parsedParams = await schema.params.parseAsync(req.params);
        try {
          req.params = parsedParams as Record<string, string>;
        } catch {
          Object.defineProperty(req, 'params', {
            value: parsedParams,
            configurable: true,
            writable: true,
            enumerable: true,
          });
        }
      }

      if (schema.query) {
        const parsedQuery = await schema.query.parseAsync(req.query);
        try {
          req.query = parsedQuery as Record<string, any>;
        } catch {
          // Express 5-এ req.query শুধুমাত্র getter হওয়ায় defineProperty দিয়ে সেট করা হয়
          Object.defineProperty(req, 'query', {
            value: parsedQuery,
            configurable: true,
            writable: true,
            enumerable: true,
          });
        }
      }

      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.issues.map((err) => ({
          field: err.path.map(String).join('.'),
          message: err.message,
        }));
        next(ApiError.badRequest('Validation failed', formattedErrors));
        return;
      }
      next(error);
    }
  };
};

export default validate;
