import { z } from 'zod';

/** Validates the Wishlist add/edit form. */
export const wishlistItemSchema = z.object({
  name: z.string().min(1, 'Name is required'),

  estimatedCost: z
    .union([z.string(), z.number(), z.null()])
    .transform(v => (v === '' || v == null ? null : Number(v)))
    .pipe(
      z
        .number()
        .min(0, 'Cost cannot be negative')
        .nullable()
        .optional()
    ),
});
