import { z } from 'zod';
import { INV_TX_TYPES } from '../../models/InvestmentTransaction';

const positiveNum = z
  .union([z.string(), z.number()])
  .transform(v => (v === '' ? NaN : Number(v)))
  .pipe(z.number({ message: 'Required' }).positive('Must be > 0'));

const nonNegativeNum = z
  .union([z.string(), z.number()])
  .transform(v => (v === '' ? 0 : Number(v)))
  .pipe(z.number().min(0, 'Cannot be negative'));

const optionalPositive = z
  .union([z.string(), z.number()])
  .transform(v => (v === '' ? null : Number(v)))
  .pipe(z.number().positive('Must be > 0').nullable());

/** Transaction types that require an asset link. */
const ASSET_REQUIRED_TYPES = new Set(['buy', 'sell', 'dividend']);

/** Transaction types that require units + price. */
const POSITION_TYPES = new Set(['buy', 'sell']);

/**
 * Validates the InvestmentTransaction add/edit form.
 *
 * Type-adaptive rules:
 *   buy/sell   → assetId required, units+price required
 *   dividend   → assetId required, grossAmount required
 *   fee/deposit/withdrawal/transfer → amount required
 */
export type InvestmentTransactionFormData = z.infer<typeof investmentTransactionSchema>;
export const investmentTransactionSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  type: z.enum(INV_TX_TYPES),
  assetId: z.string(),
  units: z.union([z.string(), z.number()]).optional(),
  price: z.union([z.string(), z.number()]).optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  fee: nonNegativeNum.optional(),
  grossAmount: z.union([z.string(), z.number()]).optional(),
  taxAmount: z.union([z.string(), z.number()]).optional(),
}).superRefine((data, ctx) => {
  const type = data.type;

  // Asset required for buy/sell/dividend
  if (ASSET_REQUIRED_TYPES.has(type) && !data.assetId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Asset is required', path: ['assetId'] });
  }

  // Units + price required for buy/sell
  if (POSITION_TYPES.has(type)) {
    const units = data.units === '' || data.units == null ? NaN : Number(data.units);
    if (!isFinite(units) || units <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Units required', path: ['units'] });
    }
    const price = data.price === '' || data.price == null ? NaN : Number(data.price);
    if (!isFinite(price) || price < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Price required', path: ['price'] });
    }
  }

  // Dividend: grossAmount required
  if (type === 'dividend') {
    const gross = data.grossAmount === '' || data.grossAmount == null ? NaN : Number(data.grossAmount);
    if (!isFinite(gross) || gross <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Gross amount required', path: ['grossAmount'] });
    }
  }

  // Non-position types: amount required (fee, deposit, withdrawal, transfer)
  if (!POSITION_TYPES.has(type) && type !== 'dividend') {
    const amount = data.amount === '' || data.amount == null ? NaN : Number(data.amount);
    if (!isFinite(amount) || amount <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Amount required', path: ['amount'] });
    }
  }
});
