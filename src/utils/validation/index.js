/**
 * Central validation utilities.
 *
 * Each schema is co-located in its own file and re-exported here.
 * The `validate` helper converts a Zod SafeParseError into a flat
 * { fieldPath: 'message' } map that forms can bind directly to state.
 *
 * Usage:
 *   import { validate, expenseSchema } from '../utils/validation';
 *   const { ok, errors } = validate(expenseSchema, formData);
 *   if (!ok) { setErrors(errors); return; }
 */

export { expenseSchema, loanExpenseSchema } from './expenseSchema';
export { accountSchema }                    from './accountSchema';
export { holdingSchema }                    from './holdingSchema';
export { propertyTaskSchema }               from './propertyTaskSchema';
export { propertyAssetSchema }              from './propertyAssetSchema';
export { wishlistItemSchema }               from './wishlistItemSchema';

/**
 * Run a Zod schema against `data` and return a plain result.
 *
 * @template T
 * @param {import('zod').ZodType<T>} schema
 * @param {unknown} data
 * @returns {{ ok: boolean, errors: Record<string, string> }}
 */
export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, errors: {} };

  const errors = {};
  for (const issue of result.error.issues) {
    // Use dot-joined path so nested errors like 'tranches.0.units' are unique.
    const key = issue.path.length > 0 ? issue.path.join('.') : '_root';
    if (!errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}
