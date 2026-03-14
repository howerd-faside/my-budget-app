import { z } from 'zod';
import { FREQUENCIES, PAYMENT_METHODS } from '../../models/Expense';

const positiveAmount = z
  .union([z.string(), z.number()])
  .transform(v => Number(v))
  .pipe(z.number({ error: 'Enter a valid number' }).positive('Amount must be greater than 0'));

/** Validates a standard or spending-money expense form. */
export type ExpenseFormData = z.infer<typeof expenseSchema>;
export const expenseSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  amount: positiveAmount,
  frequency: z.enum(FREQUENCIES, { error: 'Select a valid frequency' }),
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
          .pipe(z.number().positive('Repayment must be greater than 0')),
      }),
      { error: 'Add at least one loan split' }
    )
    .min(1, 'Add at least one loan split'),
});
