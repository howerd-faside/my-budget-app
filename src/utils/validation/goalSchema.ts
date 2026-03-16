import { z } from 'zod';

const positiveAmount = z
  .union([z.string(), z.number()])
  .transform(v => Number(v))
  .pipe(z.number({ error: 'Enter a valid number' }).positive('Amount must be greater than 0'));

/** Validates the Goal add/edit form. */
export type GoalFormData = z.infer<typeof goalSchema>;
export const goalSchema = z.object({
  name:       z.string().min(1, 'Name is required'),
  amount:     positiveAmount,
  targetDate: z.string().optional(),
});
