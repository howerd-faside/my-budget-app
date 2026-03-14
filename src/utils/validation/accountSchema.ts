import { z } from 'zod';

/** Validates the account balance inline-edit form. */
export type AccountFormData = z.infer<typeof accountSchema>;
export const accountSchema = z.object({
  balance: z
    .union([z.string(), z.number()])
    .transform(v => Number(v))
    .pipe(
      z
        .number({ error: 'Enter a valid number' })
        .min(0, 'Balance cannot be negative')
        .finite('Enter a valid number')
    ),
});
