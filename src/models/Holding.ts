/**
 * @fileoverview Domain model for an investment holding within a portfolio.
 *
 * Legacy model — retained for backward compatibility with persisted data and
 * migration pipelines. Active UI now uses Asset + InvestmentTransaction models.
 *
 * Notes:
 * - `ticker` is optional — holdings like KiwiSaver managed funds often have no
 *   ticker, which causes the price-fetch service to skip them silently.
 *
 * Numeric normalization:
 *   `normalizeHolding` coerces `units`, `avgCost`, `currentPrice` to numbers (0 if absent).
 *   `createHolding` retains `''` defaults for form binding.
 */

export const HOLDING_CATEGORIES = ['Shares', 'ETF', 'Managed Fund', 'Bonds', 'Term Deposit', 'Crypto', 'Other'] as const;
export type HoldingCategory = typeof HOLDING_CATEGORIES[number];

export interface Holding {
  id: string;
  portfolioId: string;
  name: string;
  ticker: string;
  platform: string;
  category: HoldingCategory;
  units: number;
  avgCost: number;
  currentPrice: number;
  priceUpdatedAt: string | null;
  notes: string;
  createdAt: string;
}

export function createHolding(overrides: any = {}) {
  return {
    id:           '',
    portfolioId:  '',
    name:         '',
    ticker:       '',
    platform:     '',
    category:     'Shares',
    units:        '',
    avgCost:      '',
    currentPrice: '',
    notes:        '',
    createdAt:    '',
    ...overrides,
  };
}

function toNum(val: any): number {
  const n = parseFloat(val);
  return isFinite(n) ? n : 0;
}

export function normalizeHolding(raw: any = {}): Holding {
  return createHolding({
    id:             raw.id             ?? '',
    portfolioId:    raw.portfolioId    ?? '',
    name:           raw.name           ?? '',
    ticker:         raw.ticker         ?? '',
    platform:       raw.platform       ?? '',
    category:       raw.category       ?? 'Shares',
    units:          toNum(raw.units),
    avgCost:        toNum(raw.avgCost),
    currentPrice:   toNum(raw.currentPrice),
    priceUpdatedAt: raw.priceUpdatedAt ?? null,
    notes:          raw.notes          ?? '',
    createdAt:      raw.createdAt      ?? '',
  });
}
