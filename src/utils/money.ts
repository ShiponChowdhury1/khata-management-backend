import { z } from 'zod';
import { Decimal } from '../lib/prisma.js';

// রেগুলার এক্সপ্রেশন: পজিটিভ সংখ্যা এবং সর্বোচ্চ ২ দশমিক স্থান (যেমন: 10, 10.5, 10.50)
const TWO_DECIMAL_PLACES_REGEX = /^\d+(\.\d{1,2})?$/;

/**
 * Zod স্কিমা হেল্পার — পজিটিভ মান (> 0) গ্রহণ করবে (number বা numeric string),
 * সর্বোচ্চ ২ দশমিক স্থান নিশ্চিত করবে এবং Decimal অবজেক্টে রূপান্তর করবে।
 */
export const positiveMoneySchema = (
  errorMessage = 'Amount must be a positive number with at most 2 decimal places'
) =>
  z
    .union([z.number(), z.string(), z.instanceof(Decimal)])
    .refine(
      (val) => {
        if (val instanceof Decimal) {
          return val.isPositive() && !val.isZero() && val.decimalPlaces() <= 2;
        }
        const str = typeof val === 'number' ? val.toString() : val.trim();
        const num = Number(str);
        return !isNaN(num) && num > 0 && TWO_DECIMAL_PLACES_REGEX.test(str);
      },
      { message: errorMessage }
    )
    .transform((val) => {
      if (val instanceof Decimal) return val;
      const str = typeof val === 'number' ? val.toFixed(2) : val.trim();
      return new Decimal(str);
    });

/**
 * Zod স্কিমা হেল্পার — নন-নেগেটিভ মান (>= 0) গ্রহণ করবে (number বা numeric string),
 * সর্বোচ্চ ২ দশমিক স্থান নিশ্চিত করবে এবং Decimal অবজেক্টে রূপান্তর করবে।
 */
export const nonNegativeMoneySchema = (
  errorMessage = 'Amount cannot be negative and must have at most 2 decimal places'
) =>
  z
    .union([z.number(), z.string(), z.instanceof(Decimal)])
    .refine(
      (val) => {
        if (val instanceof Decimal) {
          return !val.isNegative() && val.decimalPlaces() <= 2;
        }
        const str = typeof val === 'number' ? val.toString() : val.trim();
        const num = Number(str);
        return !isNaN(num) && num >= 0 && TWO_DECIMAL_PLACES_REGEX.test(str);
      },
      { message: errorMessage }
    )
    .transform((val) => {
      if (val instanceof Decimal) return val;
      const str = typeof val === 'number' ? val.toFixed(2) : val.trim();
      return new Decimal(str);
    });

/**
 * Decimal অবজেক্ট বা মানকে নিরাপদ ২ দশমিক বিশিষ্ট স্ট্রিংয়ে রূপান্তর হেল্পার
 */
export const formatMoneyString = (val: Decimal | number | string | null | undefined): string => {
  if (val === null || val === undefined) return '0.00';
  if (val instanceof Decimal) {
    return val.toFixed(2);
  }
  return new Decimal(val).toFixed(2);
};
