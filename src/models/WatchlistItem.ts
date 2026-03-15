/**
 * @fileoverview Watchlist item model for the Discovery section.
 *
 * A WatchlistItem represents an asset the user is evaluating but has not yet
 * purchased. It carries identity, user notes/thesis, and a snapshot of the
 * price when the item was added. Live prices are stored separately in
 * watchlistPrices (keyed by ticker).
 *
 * Watchlist items are global — not scoped to a portfolio. When converting
 * to a portfolio asset, the user picks the target portfolio.
 */

import { ASSET_CATEGORIES } from './Asset';
import type { AssetCategory } from './Asset';

export interface WatchlistItem {
  id:          string;
  ticker:      string;              // e.g. "VTI"
  name:        string;              // e.g. "Vanguard Total Stock Market ETF"
  category:    AssetCategory;       // reuse ASSET_CATEGORIES
  currency:    string;              // e.g. "USD", "NZD"
  targetPrice: number | null;       // user's target buy price
  thesis:      string;              // user's investment thesis / reasoning
  tags:        string[];            // freeform tags for organisation
  priceAtAdd:  number | null;       // snapshot price when added
  addedAt:     string;              // ISO date
}

export interface WatchlistPrice {
  ticker:    string;
  price:     number;
  currency:  string;
  updatedAt: string;                // ISO timestamp
}

/**
 * Factory — blank WatchlistItem with form-friendly defaults.
 */
export function createWatchlistItem(overrides: any = {}): WatchlistItem {
  return {
    id:          '',
    ticker:      '',
    name:        '',
    category:    'Shares',
    currency:    'NZD',
    targetPrice: null,
    thesis:      '',
    tags:        [],
    priceAtAdd:  null,
    addedAt:     '',
    ...overrides,
  };
}

function toNumOrNull(val: any): number | null {
  if (val == null || val === '') return null;
  const n = parseFloat(val);
  return isFinite(n) ? n : null;
}

/**
 * Coerce a raw object to the canonical WatchlistItem shape.
 */
export function normalizeWatchlistItem(raw: any = {}): WatchlistItem {
  return {
    id:          raw.id          ?? '',
    ticker:      raw.ticker      ?? '',
    name:        raw.name        ?? '',
    category:    raw.category    ?? 'Shares',
    currency:    raw.currency    ?? 'NZD',
    targetPrice: toNumOrNull(raw.targetPrice),
    thesis:      raw.thesis      ?? '',
    tags:        Array.isArray(raw.tags) ? raw.tags : [],
    priceAtAdd:  toNumOrNull(raw.priceAtAdd),
    addedAt:     raw.addedAt     ?? '',
  };
}

/**
 * Coerce a raw object to the canonical WatchlistPrice shape.
 */
export function normalizeWatchlistPrice(raw: any = {}): WatchlistPrice {
  const n = parseFloat(raw.price);
  return {
    ticker:    raw.ticker    ?? '',
    price:     isFinite(n) ? n : 0,
    currency:  raw.currency  ?? 'NZD',
    updatedAt: raw.updatedAt ?? '',
  };
}
