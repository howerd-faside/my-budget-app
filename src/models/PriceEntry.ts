/**
 * @fileoverview Cached market price for an asset.
 *
 * A PriceEntry stores the latest fetched price for an asset. Historical
 * price series are NOT persisted — they are fetched on demand by
 * priceService.js and held in component state only.
 *
 * One entry per asset. The price-refresh service overwrites the entry
 * each time it fetches; `updatedAt` tracks staleness.
 */

export interface PriceEntry {
  assetId: string;            // foreign key → Asset.id
  price: number;              // latest market price in asset's currency
  currency: string;           // price currency (mirrors Asset.currency at fetch time)
  updatedAt: string;          // ISO timestamp of last fetch
}

/**
 * Factory — blank PriceEntry with form-friendly defaults.
 */
export function createPriceEntry(overrides: any = {}) {
  return {
    assetId:   '',
    price:     '',
    currency:  'NZD',
    updatedAt: '',
    ...overrides,
  };
}

function toNum(val: any): number {
  const n = parseFloat(val);
  return isFinite(n) ? n : 0;
}

/**
 * Coerce a raw object to the canonical PriceEntry shape.
 */
export function normalizePriceEntry(raw: any = {}): PriceEntry {
  return {
    assetId:   raw.assetId   ?? '',
    price:     toNum(raw.price),
    currency:  raw.currency  ?? 'NZD',
    updatedAt: raw.updatedAt ?? '',
  };
}
