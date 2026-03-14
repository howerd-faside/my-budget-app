/**
 * @fileoverview Domain model for a dividend payment received from a holding.
 *
 * Numeric normalization:
 *   `normalizeDividend` coerces `grossAmount`, `taxAmount`, `netAmount` to numbers.
 *   `createDividend` retains `''` defaults for form binding.
 */

export interface Dividend {
  id: string;
  portfolioId: string;
  date: string;
  holdingId: string;
  platform: string;
  grossAmount: number;
  taxAmount: number;
  netAmount: number;
  notes: string;
  createdAt: string;
}

export function createDividend(overrides: any = {}) {
  return {
    id:          '',
    portfolioId: '',
    date:        '',
    holdingId:   '',
    platform:    '',
    grossAmount: '',
    taxAmount:   '',
    netAmount:   '',
    notes:       '',
    createdAt:   '',
    ...overrides,
  };
}

function toNum(val: any): number {
  const n = parseFloat(val);
  return isFinite(n) ? n : 0;
}

export function normalizeDividend(raw: any = {}): Dividend {
  return createDividend({
    id:          raw.id          ?? '',
    portfolioId: raw.portfolioId ?? '',
    date:        raw.date        ?? '',
    holdingId:   raw.holdingId   ?? '',
    platform:    raw.platform    ?? '',
    grossAmount: toNum(raw.grossAmount),
    taxAmount:   toNum(raw.taxAmount),
    netAmount:   toNum(raw.netAmount),
    notes:       raw.notes       ?? '',
    createdAt:   raw.createdAt   ?? '',
  });
}
