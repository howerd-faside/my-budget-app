import { z } from 'zod';
import { FREQUENCIES, PAYMENT_METHODS } from '../../models/Expense';

const positiveAmount = z
  .union([z.string(), z.number()])
  .transform(v => Number(v))
  .pipe(z.number({ error: 'Enter a valid number' }).positive('Amount must be greater than 0'));

/** Optional direct-debit day (1–31 or empty). */
const optionalDdDay = z
  .union([z.string(), z.number(), z.null()])
  .transform(v => {
    if (v === '' || v == null) return null;
    return Number(v);
  })
  .pipe(
    z.number().int('Day must be a whole number').min(1, 'Day must be 1–31').max(31, 'Day must be 1–31').nullable(),
  )
  .optional();

/** Validates a standard or spending-money expense form. */
export type ExpenseFormData = z.infer<typeof expenseSchema>;
export const expenseSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  amount: positiveAmount,
  frequency: z.enum(FREQUENCIES, { error: 'Select a valid frequency' }),
  ddDay: optionalDdDay,
});

/** Validates a loan expense form (facilities instead of amount). */
export type LoanExpenseFormData = z.infer<typeof loanExpenseSchema>;
export const loanExpenseSchema = z.object({
  name: z.string().min(1, 'Loan name is required'),
  facilities: z
    .array(
      z.object({
        amount: z
          .union([z.string(), z.number()])
          .transform(v => Number(v))
          .pipe(z.number().min(0, 'Repayment cannot be negative')),
      }),
      { error: 'Add at least one loan split' }
    )
    .min(1, 'Add at least one loan split'),
});
