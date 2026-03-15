/**
 * @fileoverview Investment asset identity model.
 *
 * An Asset is "what do I own" — name, ticker, platform, category. It carries
 * no position or price data. Those concerns live in InvestmentTransaction
 * (position = derived from buy/sell history) and PriceEntry (cached market
 * price), respectively.
 *
 * Categories are identical to HOLDING_CATEGORIES so v4 migration is 1:1.
 */

export const ASSET_CATEGORIES = ['Shares', 'ETF', 'Managed Fund', 'Bonds', 'Term Deposit', 'Crypto', 'Other'] as const;
export type AssetCategory = typeof ASSET_CATEGORIES[number];

export interface Asset {
  id: string;
  portfolioId: string;
  name: string;
  ticker: string;           // '' for non-traded assets (KiwiSaver managed funds, etc.)
  platform: string;         // broker / exchange
  category: AssetCategory;
  currency: string;         // price currency, defaults to portfolio.currency at creation
  notes: string;
  createdAt: string;
}

/**
 * Factory — blank Asset with form-friendly defaults.
 */
export function createAsset(overrides: any = {}) {
  return {
    id:          '',
    portfolioId: '',
    name:        '',
    ticker:      '',
    platform:    '',
    category:    'Shares',
    currency:    'NZD',
    notes:       '',
    createdAt:   '',
    ...overrides,
  };
}

/**
 * Coerce a raw object to the canonical Asset shape.
 */
export function normalizeAsset(raw: any = {}): Asset {
  return {
    id:          raw.id          ?? '',
    portfolioId: raw.portfolioId ?? '',
    name:        raw.name        ?? '',
    ticker:      raw.ticker      ?? '',
    platform:    raw.platform    ?? '',
    category:    raw.category    ?? 'Shares',
    currency:    raw.currency    ?? 'NZD',
    notes:       raw.notes       ?? '',
    createdAt:   raw.createdAt   ?? '',
  };
}
