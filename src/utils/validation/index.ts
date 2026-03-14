/**
 * Central validation utilities.
 *
 * Each schema is co-located in its own file and re-exported here.
 * The `validate` helper converts a Zod SafeParseError into a flat
 * { fieldPath: 'message' } map that forms can bind directly to state.
 */

import type { ZodType } from 'zod';

export { expenseSchema, loanExpenseSchema }  from './expenseSchema';
export { accountSchema }                     from './accountSchema';
export { holdingSchema }                     from './holdingSchema';
export { propertyTaskSchema }                from './propertyTaskSchema';
export { propertyAssetSchema }               from './propertyAssetSchema';
export { wishlistItemSchema }                from './wishlistItemSchema';

export type { ExpenseFormData, LoanExpenseFormData } from './expenseSchema';
export type { AccountFormData }                      from './accountSchema';
export type { HoldingFormData }                      from './holdingSchema';
export type { PropertyTaskFormData }                 from './propertyTaskSchema';
export type { PropertyAssetFormData }                from './propertyAssetSchema';
export type { WishlistItemFormData }                 from './wishlistItemSchema';

interface ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
}

/**
 * Run a Zod schema against `data` and return a plain result.
 */
export function validate<T>(schema: ZodType<T>, data: unknown): ValidationResult {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, errors: {} };

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_root';
    if (!errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}
