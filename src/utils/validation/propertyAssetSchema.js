import { z } from 'zod';

/** Validates the PropertyAsset modal form. */
export const propertyAssetSchema = z.object({
  name:       z.string().min(1, 'Name is required'),
  propertyId: z.string().min(1, 'Select a property'),

  expectedLifespan: z
    .union([z.string(), z.number()])
    .transform(v => (v === '' || v == null ? null : Number(v)))
    .pipe(
      z
        .number()
        .int('Must be a whole number')
        .min(1, 'Must be at least 1 year')
        .nullable()
        .optional()
    ),
});
