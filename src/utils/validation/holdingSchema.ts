import { z } from 'zod';

const optionalPositive = z
  .union([z.string(), z.number()])
  .transform(v => (v === '' ? null : Number(v)))
  .pipe(z.number().min(0, 'Cannot be negative').nullable().optional());

/** Validates the HoldingModal form. */
export type HoldingFormData = z.infer<typeof holdingSchema>;
export const holdingSchema = z.object({
  name: z.string().min(1, 'Asset name is required'),

  currentPrice: optionalPositive,

  tranches: z
    .array(
      z.object({
        units: z
          .union([z.string(), z.number()])
          .transform(v => Number(v))
          .pipe(z.number({ error: 'Enter units' }).positive('Units must be greater than 0')),
        costPerUnit: z
          .union([z.string(), z.number()])
          .transform(v => Number(v))
          .pipe(z.number({ error: 'Enter cost' }).min(0, 'Cost cannot be negative')),
      })
    )
    .min(1, 'Add at least one purchase tranche'),
});
