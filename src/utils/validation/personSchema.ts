import { z } from 'zod';
import { TAX_CODES, KIWISAVER_RATES, PAY_FREQUENCIES } from '../../models/Person';

const nonNegativeAmount = z
  .union([z.string(), z.number()])
  .transform(v => Number(v))
  .pipe(z.number({ error: 'Enter a valid number' }).min(0, 'Cannot be negative'));

/** Validates the Person add/edit form (top-level fields only). */
export type PersonFormData = z.infer<typeof personSchema>;
export const personSchema = z.object({
  name:          z.string().min(1, 'Name is required'),
  grossAnnual:   nonNegativeAmount,
  taxCode:       z.enum(TAX_CODES, { error: 'Select a valid tax code' }),
  kiwiSaverRate: z.union([z.string(), z.number()])
    .transform(v => Number(v))
    .pipe(z.number().refine(v => (KIWISAVER_RATES as readonly number[]).includes(v), 'Select a valid KiwiSaver rate')),
  payFrequency:  z.enum(PAY_FREQUENCIES, { error: 'Select a valid pay frequency' }),
});
