/**
 * Unit tests for watchlist pure helpers.
 */
import { describe, it, expect } from 'vitest';
import {
  calcPriceDelta,
  calcTargetGap,
  buildPriceMap,
  getPortfolioTickers,
} from './watchlist';
import { createWatchlistItem } from '../../models/WatchlistItem';
import type { WatchlistPrice } from '../../models/WatchlistItem';

describe('calcPriceDelta', () => {
  it('calculates positive delta', () => {
    const item = createWatchlistItem({ priceAtAdd: 100 });
    const d = calcPriceDelta(item, 110);
    expect(d).not.toBeNull();
    expect(d!.absolute).toBe(10);
    expect(d!.percent).toBeCloseTo(10);
  });

  it('calculates negative delta', () => {
    const item = createWatchlistItem({ priceAtAdd: 200 });
    const d = calcPriceDelta(item, 180);
    expect(d!.absolute).toBe(-20);
    expect(d!.percent).toBeCloseTo(-10);
  });

  it('returns null when priceAtAdd is null', () => {
    const item = createWatchlistItem({ priceAtAdd: null });
    expect(calcPriceDelta(item, 100)).toBeNull();
  });

  it('returns null when currentPrice is null', () => {
    const item = createWatchlistItem({ priceAtAdd: 100 });
    expect(calcPriceDelta(item, null)).toBeNull();
  });

  it('returns null when priceAtAdd is 0', () => {
    const item = createWatchlistItem({ priceAtAdd: 0 });
    expect(calcPriceDelta(item, 100)).toBeNull();
  });
});

describe('calcTargetGap', () => {
  it('shows gap when price is above target', () => {
    const item = createWatchlistItem({ targetPrice: 200 });
    const g = calcTargetGap(item, 220);
    expect(g).not.toBeNull();
    expect(g!.absolute).toBe(20);
    expect(g!.atTarget).toBe(false);
  });

  it('shows atTarget when price equals target', () => {
    const item = createWatchlistItem({ targetPrice: 200 });
    const g = calcTargetGap(item, 200);
    expect(g!.atTarget).toBe(true);
  });

  it('shows atTarget when price is below target', () => {
    const item = createWatchlistItem({ targetPrice: 200 });
    const g = calcTargetGap(item, 190);
    expect(g!.atTarget).toBe(true);
  });

  it('returns null when targetPrice is null', () => {
    const item = createWatchlistItem({ targetPrice: null });
    expect(calcTargetGap(item, 100)).toBeNull();
  });

  it('returns null when currentPrice is null', () => {
    const item = createWatchlistItem({ targetPrice: 200 });
    expect(calcTargetGap(item, null)).toBeNull();
  });
});

describe('buildPriceMap', () => {
  it('builds case-insensitive map by ticker', () => {
    const prices: WatchlistPrice[] = [
      { ticker: 'VTI', price: 248, currency: 'USD', updatedAt: '' },
      { ticker: 'vt', price: 120, currency: 'USD', updatedAt: '' },
    ];
    const map = buildPriceMap(prices);
    expect(map['VTI']).toBeDefined();
    expect(map['VTI'].price).toBe(248);
    expect(map['VT']).toBeDefined();
    expect(map['VT'].price).toBe(120);
  });

  it('returns empty map for empty input', () => {
    expect(buildPriceMap([])).toEqual({});
  });
});

describe('getPortfolioTickers', () => {
  it('collects unique uppercase tickers', () => {
    const assets = [
      { ticker: 'VT' },
      { ticker: 'vti' },
      { ticker: '' },
      { ticker: 'VT' },
    ];
    const set = getPortfolioTickers(assets);
    expect(set.has('VT')).toBe(true);
    expect(set.has('VTI')).toBe(true);
    expect(set.size).toBe(2);
  });

  it('skips empty tickers', () => {
    const set = getPortfolioTickers([{ ticker: '' }]);
    expect(set.size).toBe(0);
  });
});
