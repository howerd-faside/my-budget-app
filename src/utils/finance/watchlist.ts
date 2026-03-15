/**
 * @fileoverview Pure helpers for the Discovery watchlist.
 *
 * No React, no store access. Designed for computing display values
 * from WatchlistItem + WatchlistPrice data.
 */

import type { WatchlistItem, WatchlistPrice } from '../../models/WatchlistItem';

// ── Price delta since added ─────────────────────────────────────────────────

export interface PriceDelta {
  absolute: number;
  percent: number;
}

/**
 * Calculate change from the price at time of adding to the current price.
 * Returns null if either price is unavailable.
 */
export function calcPriceDelta(
  item: WatchlistItem,
  currentPrice: number | null,
): PriceDelta | null {
  if (item.priceAtAdd == null || item.priceAtAdd === 0 || currentPrice == null) {
    return null;
  }
  const absolute = currentPrice - item.priceAtAdd;
  const percent  = (absolute / item.priceAtAdd) * 100;
  return { absolute, percent };
}

// ── Target price gap ────────────────────────────────────────────────────────

export interface TargetGap {
  /** Positive = current price is above target (i.e. need to drop). */
  absolute: number;
  percent: number;
  /** True if current price is at or below target. */
  atTarget: boolean;
}

/**
 * Calculate how far current price is from the user's target buy price.
 * Returns null if target or current price is not set.
 */
export function calcTargetGap(
  item: WatchlistItem,
  currentPrice: number | null,
): TargetGap | null {
  if (item.targetPrice == null || currentPrice == null || currentPrice === 0) {
    return null;
  }
  const absolute = currentPrice - item.targetPrice;
  const percent  = (absolute / currentPrice) * 100;
  return { absolute, percent, atTarget: absolute <= 0 };
}

// ── Price lookup helper ─────────────────────────────────────────────────────

/**
 * Build a ticker → WatchlistPrice map for fast lookups.
 */
export function buildPriceMap(
  prices: WatchlistPrice[],
): Record<string, WatchlistPrice> {
  const map: Record<string, WatchlistPrice> = {};
  for (const p of prices) {
    map[p.ticker.toUpperCase()] = p;
  }
  return map;
}

// ── Portfolio overlap ───────────────────────────────────────────────────────

/**
 * Build a set of tickers that already exist as portfolio assets.
 */
export function getPortfolioTickers(
  assets: { ticker: string }[],
): Set<string> {
  const set = new Set<string>();
  for (const a of assets) {
    if (a.ticker) set.add(a.ticker.toUpperCase());
  }
  return set;
}
