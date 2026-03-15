/**
 * Unit tests for the WatchlistItem model.
 */
import { describe, it, expect } from 'vitest';
import {
  createWatchlistItem,
  normalizeWatchlistItem,
  normalizeWatchlistPrice,
} from './WatchlistItem';

describe('createWatchlistItem', () => {
  it('returns defaults', () => {
    const item = createWatchlistItem();
    expect(item.id).toBe('');
    expect(item.ticker).toBe('');
    expect(item.category).toBe('Shares');
    expect(item.currency).toBe('NZD');
    expect(item.targetPrice).toBeNull();
    expect(item.thesis).toBe('');
    expect(item.tags).toEqual([]);
    expect(item.priceAtAdd).toBeNull();
  });

  it('applies overrides', () => {
    const item = createWatchlistItem({ ticker: 'VTI', name: 'Vanguard Total Stock', targetPrice: 240 });
    expect(item.ticker).toBe('VTI');
    expect(item.name).toBe('Vanguard Total Stock');
    expect(item.targetPrice).toBe(240);
  });
});

describe('normalizeWatchlistItem', () => {
  it('normalizes a well-formed item', () => {
    const raw = {
      id: 'w1', ticker: 'VTI', name: 'Test', category: 'ETF',
      currency: 'USD', targetPrice: 240, thesis: 'Broad market',
      tags: ['US', 'Core'], priceAtAdd: 250, addedAt: '2026-03-01',
    };
    const item = normalizeWatchlistItem(raw);
    expect(item.id).toBe('w1');
    expect(item.targetPrice).toBe(240);
    expect(item.tags).toEqual(['US', 'Core']);
    expect(item.priceAtAdd).toBe(250);
  });

  it('handles missing fields with defaults', () => {
    const item = normalizeWatchlistItem({});
    expect(item.id).toBe('');
    expect(item.ticker).toBe('');
    expect(item.category).toBe('Shares');
    expect(item.tags).toEqual([]);
    expect(item.targetPrice).toBeNull();
    expect(item.priceAtAdd).toBeNull();
  });

  it('coerces non-array tags to empty array', () => {
    const item = normalizeWatchlistItem({ tags: 'not-array' });
    expect(item.tags).toEqual([]);
  });

  it('coerces non-numeric targetPrice to null', () => {
    const item = normalizeWatchlistItem({ targetPrice: 'abc' });
    expect(item.targetPrice).toBeNull();
  });
});

describe('normalizeWatchlistPrice', () => {
  it('normalizes a price entry', () => {
    const p = normalizeWatchlistPrice({ ticker: 'VTI', price: 248.5, currency: 'USD', updatedAt: '2026-03-15T12:00:00Z' });
    expect(p.ticker).toBe('VTI');
    expect(p.price).toBe(248.5);
    expect(p.currency).toBe('USD');
  });

  it('defaults missing price to 0', () => {
    const p = normalizeWatchlistPrice({ ticker: 'X' });
    expect(p.price).toBe(0);
    expect(p.currency).toBe('NZD');
  });
});
