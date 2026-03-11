import { z } from 'zod';

/** Validates the account balance inline-edit form. */
export const accountSchema = z.object({
  balance: z
    .union([z.string(), z.number()])
    .transform(v => Number(v))
    .pipe(
      z
        .number({ invalid_type_error: 'Enter a valid number' })
        .min(0, 'Balance cannot be negative')
        .finite('Enter a valid number')
    ),
});
