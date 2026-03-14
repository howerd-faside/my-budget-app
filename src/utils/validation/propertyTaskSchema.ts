import { z } from 'zod';

/** Validates the PropertyTask modal form. */
export type PropertyTaskFormData = z.infer<typeof propertyTaskSchema>;
export const propertyTaskSchema = z.object({
  title:      z.string().min(1, 'Title is required'),
  propertyId: z.string().min(1, 'Select a property'),

  recurInterval: z
    .union([z.string(), z.number()])
    .transform(v => Number(v))
    .pipe(
      z
        .number({ error: 'Interval must be a number' })
        .int('Interval must be a whole number')
        .min(1, 'Interval must be at least 1')
    )
    .optional(),
});
