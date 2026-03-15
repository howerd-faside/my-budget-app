/**
 * Tests for src/utils/finance/portfolio.ts
 *
 * Covers the pure calculators for the transaction-led investment model:
 *   - calcAssetPosition: average-cost position from buy/sell history
 *   - enrichAsset / enrichAllAssets: position + price + derived metrics
 *   - calcIncomeTotals: dividend/fee aggregation
 *   - getAllocation: grouping by category / platform / asset
 *   - calcPortfolioOverview: portfolio-level aggregate stats
 *   - getRecentActivity: chronological feed with asset names
 *   - filterTxByYear / filterTxByDateRange / filterTxByType
 */
import { describe, it, expect } from 'vitest';
import {
  calcAssetPosition,
  calcAllPositions,
  getAssetPrice,
  enrichAsset,
  enrichAllAssets,
  calcIncomeTotals,
  getAllocation,
  calcPortfolioOverview,
  getRecentActivity,
  filterTxByYear,
  filterTxByDateRange,
  filterTxByType,
  calcPeriodReturns,
  buildUnitsTimeline,
  getUnitsAtDate,
  calcRealisedSells,
} from './portfolio';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeTx(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    portfolioId: 'p1',
    assetId: 'a1',
    date: '2025-06-01',
    type: 'buy',
    units: null,
    price: null,
    amount: 0,
    fee: 0,
    grossAmount: null,
    taxAmount: null,
    label: '',
    linkedTxId: null,
    notes: '',
    createdAt: '',
    ...overrides,
  };
}

function makeAsset(overrides = {}) {
  return {
    id: 'a1',
    portfolioId: 'p1',
    name: 'Apple Inc.',
    ticker: 'AAPL',
    platform: 'Sharesies',
    category: 'Shares',
    currency: 'NZD',
    notes: '',
    createdAt: '',
    ...overrides,
  };
}

// ── calcAssetPosition ───────────────────────────────────────────────────────

describe('calcAssetPosition', () => {
  it('returns zero position when no transactions exist', () => {
    const pos = calcAssetPosition('a1', []);
    expect(pos.units).toBe(0);
    expect(pos.totalCost).toBe(0);
    expect(pos.avgCost).toBe(0);
    expect(pos.realisedGL).toBe(0);
  });

  it('computes position from a single buy', () => {
    const txs = [makeTx({ type: 'buy', units: 10, price: 50 })];
    const pos = calcAssetPosition('a1', txs);

    expect(pos.units).toBe(10);
    expect(pos.totalCost).toBe(500);
    expect(pos.avgCost).toBe(50);
    expect(pos.realisedGL).toBe(0);
  });

  it('computes weighted average cost from multiple buys', () => {
    const txs = [
      makeTx({ type: 'buy', units: 10, price: 40, date: '2025-01-01' }),
      makeTx({ type: 'buy', units: 10, price: 60, date: '2025-02-01' }),
    ];
    const pos = calcAssetPosition('a1', txs);

    expect(pos.units).toBe(20);
    expect(pos.totalCost).toBe(1000); // 400 + 600
    expect(pos.avgCost).toBe(50);     // 1000 / 20
    expect(pos.realisedGL).toBe(0);
  });

  it('includes buy fees in cost basis', () => {
    const txs = [makeTx({ type: 'buy', units: 10, price: 50, fee: 10 })];
    const pos = calcAssetPosition('a1', txs);

    expect(pos.totalCost).toBe(510);  // 500 + 10 fee
    expect(pos.avgCost).toBe(51);     // 510 / 10
  });

  it('computes realised gain on sell at profit', () => {
    const txs = [
      makeTx({ type: 'buy',  units: 10, price: 50, date: '2025-01-01' }),
      makeTx({ type: 'sell', units: 5,  price: 70, date: '2025-06-01' }),
    ];
    const pos = calcAssetPosition('a1', txs);

    // Sell 5 @ 70, avg cost was 50 → realised GL = (5×70) - (5×50) = 100
    expect(pos.units).toBe(5);
    expect(pos.realisedGL).toBe(100);
    expect(pos.totalCost).toBe(250);  // 500 - (50 × 5)
    expect(pos.avgCost).toBe(50);
  });

  it('computes realised loss on sell at loss', () => {
    const txs = [
      makeTx({ type: 'buy',  units: 10, price: 50, date: '2025-01-01' }),
      makeTx({ type: 'sell', units: 10, price: 30, date: '2025-06-01' }),
    ];
    const pos = calcAssetPosition('a1', txs);

    // Sell all 10 @ 30, cost was 50 → GL = (300) - (500) = -200
    expect(pos.units).toBe(0);
    expect(pos.realisedGL).toBe(-200);
    expect(pos.totalCost).toBe(0);
  });

  it('deducts sell fees from proceeds', () => {
    const txs = [
      makeTx({ type: 'buy',  units: 10, price: 50, date: '2025-01-01' }),
      makeTx({ type: 'sell', units: 10, price: 60, date: '2025-06-01', fee: 20 }),
    ];
    const pos = calcAssetPosition('a1', txs);

    // proceeds = 10×60 - 20 = 580, cost = 10×50 = 500, GL = 80
    expect(pos.realisedGL).toBe(80);
  });

  it('handles partial sell then another buy correctly', () => {
    const txs = [
      makeTx({ type: 'buy',  units: 20, price: 40, date: '2025-01-01' }),
      makeTx({ type: 'sell', units: 10, price: 50, date: '2025-02-01' }),
      makeTx({ type: 'buy',  units: 5,  price: 60, date: '2025-03-01' }),
    ];
    const pos = calcAssetPosition('a1', txs);

    // After buy: 20 units, cost 800, avg 40
    // After sell 10@50: GL = 500 - 400 = 100. Remaining: 10 units, cost 400, avg 40
    // After buy 5@60: 15 units, cost 400+300 = 700, avg ≈ 46.67
    expect(pos.units).toBe(15);
    expect(pos.totalCost).toBe(700);
    expect(pos.avgCost).toBeCloseTo(46.667, 1);
    expect(pos.realisedGL).toBe(100);
  });

  it('processes transactions chronologically even if input is unordered', () => {
    const txs = [
      makeTx({ type: 'sell', units: 5,  price: 70, date: '2025-06-01' }),
      makeTx({ type: 'buy',  units: 10, price: 50, date: '2025-01-01' }),
    ];
    const pos = calcAssetPosition('a1', txs);

    // Should buy first, then sell (chronological)
    expect(pos.units).toBe(5);
    expect(pos.realisedGL).toBe(100);
  });

  it('ignores transactions for other assets', () => {
    const txs = [
      makeTx({ assetId: 'other', type: 'buy', units: 100, price: 10 }),
      makeTx({ assetId: 'a1',   type: 'buy', units: 5,   price: 20 }),
    ];
    const pos = calcAssetPosition('a1', txs);

    expect(pos.units).toBe(5);
    expect(pos.totalCost).toBe(100);
  });

  it('ignores transactions with null units (migrated contributions)', () => {
    const txs = [
      makeTx({ type: 'buy', units: 10, price: 50 }),
      makeTx({ type: 'buy', units: null, price: null, amount: 500 }), // contribution
    ];
    const pos = calcAssetPosition('a1', txs);

    expect(pos.units).toBe(10);   // only the first buy counts
    expect(pos.totalCost).toBe(500);
  });

  it('ignores dividend and fee transactions', () => {
    const txs = [
      makeTx({ type: 'buy', units: 10, price: 50 }),
      makeTx({ type: 'dividend', amount: 30, grossAmount: 40, taxAmount: 10 }),
      makeTx({ type: 'fee', amount: 5 }),
    ];
    const pos = calcAssetPosition('a1', txs);

    expect(pos.units).toBe(10);
    expect(pos.totalCost).toBe(500);
    expect(pos.realisedGL).toBe(0);
  });

  it('cleans up floating-point dust on full sell', () => {
    const txs = [
      makeTx({ type: 'buy',  units: 3, price: 33.33, date: '2025-01-01' }),
      makeTx({ type: 'sell', units: 3, price: 40,    date: '2025-06-01' }),
    ];
    const pos = calcAssetPosition('a1', txs);

    expect(pos.units).toBe(0);
    expect(pos.totalCost).toBe(0);
  });
});

// ── calcAllPositions ────────────────────────────────────────────────────────

describe('calcAllPositions', () => {
  it('returns one position per asset', () => {
    const assets = [makeAsset({ id: 'a1' }), makeAsset({ id: 'a2' })];
    const txs = [
      makeTx({ assetId: 'a1', type: 'buy', units: 10, price: 50 }),
      makeTx({ assetId: 'a2', type: 'buy', units: 20, price: 30 }),
    ];
    const positions = calcAllPositions(assets, txs);

    expect(positions).toHaveLength(2);
    expect(positions.find(p => p.assetId === 'a1').units).toBe(10);
    expect(positions.find(p => p.assetId === 'a2').units).toBe(20);
  });
});

// ── getAssetPrice ───────────────────────────────────────────────────────────

describe('getAssetPrice', () => {
  it('returns price from cache', () => {
    const cache = [{ assetId: 'a1', price: 123.45, currency: 'NZD', updatedAt: '' }];
    expect(getAssetPrice('a1', cache)).toBe(123.45);
  });

  it('returns 0 when asset is not in cache', () => {
    expect(getAssetPrice('missing', [])).toBe(0);
  });
});

// ── enrichAsset ─────────────────────────────────────────────────────────────

describe('enrichAsset', () => {
  it('computes current value and unrealised GL', () => {
    const asset = makeAsset();
    const pos = { assetId: 'a1', units: 10, totalCost: 500, avgCost: 50, realisedGL: 0 };
    const ea = enrichAsset(asset, pos, 70);

    expect(ea.currentValue).toBe(700);
    expect(ea.unrealisedGL).toBe(200);
    expect(ea.unrealisedGLPct).toBe(40);  // 200/500 × 100
    expect(ea.totalReturn).toBe(200);
  });

  it('includes realised GL in total return', () => {
    const asset = makeAsset();
    const pos = { assetId: 'a1', units: 5, totalCost: 250, avgCost: 50, realisedGL: 100 };
    const ea = enrichAsset(asset, pos, 60);

    expect(ea.currentValue).toBe(300);
    expect(ea.unrealisedGL).toBe(50);
    expect(ea.totalReturn).toBe(150);  // 50 unrealised + 100 realised
  });

  it('handles zero cost (no position) without division error', () => {
    const asset = makeAsset();
    const pos = { assetId: 'a1', units: 0, totalCost: 0, avgCost: 0, realisedGL: 0 };
    const ea = enrichAsset(asset, pos, 100);

    expect(ea.currentValue).toBe(0);
    expect(ea.unrealisedGL).toBe(0);
    expect(ea.unrealisedGLPct).toBe(0);
  });

  it('handles zero price', () => {
    const asset = makeAsset();
    const pos = { assetId: 'a1', units: 10, totalCost: 500, avgCost: 50, realisedGL: 0 };
    const ea = enrichAsset(asset, pos, 0);

    expect(ea.currentValue).toBe(0);
    expect(ea.unrealisedGL).toBe(-500);
    expect(ea.unrealisedGLPct).toBe(-100);
  });
});

// ── enrichAllAssets ─────────────────────────────────────────────────────────

describe('enrichAllAssets', () => {
  it('enriches every asset with position data and price', () => {
    const assets = [
      makeAsset({ id: 'a1', name: 'Apple' }),
      makeAsset({ id: 'a2', name: 'Google' }),
    ];
    const txs = [
      makeTx({ assetId: 'a1', type: 'buy', units: 10, price: 50 }),
      makeTx({ assetId: 'a2', type: 'buy', units: 5,  price: 100 }),
    ];
    const cache = [
      { assetId: 'a1', price: 60, currency: 'NZD', updatedAt: '' },
      { assetId: 'a2', price: 120, currency: 'NZD', updatedAt: '' },
    ];

    const result = enrichAllAssets(assets, txs, cache);

    expect(result).toHaveLength(2);
    const apple = result.find(e => e.asset.id === 'a1');
    expect(apple.currentValue).toBe(600);
    expect(apple.unrealisedGL).toBe(100);

    const google = result.find(e => e.asset.id === 'a2');
    expect(google.currentValue).toBe(600);
    expect(google.unrealisedGL).toBe(100);
  });
});

// ── calcIncomeTotals ────────────────────────────────────────────────────────

describe('calcIncomeTotals', () => {
  it('aggregates dividend gross, tax, and net', () => {
    const txs = [
      makeTx({ type: 'dividend', amount: 67, grossAmount: 100, taxAmount: 33 }),
      makeTx({ type: 'dividend', amount: 40, grossAmount: 50,  taxAmount: 10 }),
    ];
    const totals = calcIncomeTotals(txs);

    expect(totals.dividendGross).toBe(150);
    expect(totals.dividendTax).toBe(43);
    expect(totals.dividendNet).toBe(107);
  });

  it('aggregates fee transactions', () => {
    const txs = [
      makeTx({ type: 'fee', amount: 15 }),
      makeTx({ type: 'fee', amount: 25 }),
    ];
    const totals = calcIncomeTotals(txs);

    expect(totals.feesPaid).toBe(40);
  });

  it('ignores buy/sell transactions', () => {
    const txs = [
      makeTx({ type: 'buy', units: 10, price: 50, amount: 500 }),
      makeTx({ type: 'sell', units: 5, price: 60, amount: 300 }),
      makeTx({ type: 'dividend', amount: 20, grossAmount: 25, taxAmount: 5 }),
    ];
    const totals = calcIncomeTotals(txs);

    expect(totals.dividendNet).toBe(20);
    expect(totals.feesPaid).toBe(0);
  });

  it('handles dividends with null grossAmount/taxAmount', () => {
    const txs = [
      makeTx({ type: 'dividend', amount: 50, grossAmount: null, taxAmount: null }),
    ];
    const totals = calcIncomeTotals(txs);

    expect(totals.dividendGross).toBe(0);
    expect(totals.dividendTax).toBe(0);
    expect(totals.dividendNet).toBe(50);
  });

  it('returns zeros for empty array', () => {
    const totals = calcIncomeTotals([]);
    expect(totals.dividendGross).toBe(0);
    expect(totals.dividendNet).toBe(0);
    expect(totals.feesPaid).toBe(0);
  });
});

// ── getAllocation ────────────────────────────────────────────────────────────

describe('getAllocation', () => {
  function makeEnriched(overrides = {}) {
    return {
      asset: makeAsset(overrides),
      position: { assetId: 'a1', units: 0, totalCost: 0, avgCost: 0, realisedGL: 0 },
      currentPrice: 0,
      currentValue: 0,
      unrealisedGL: 0,
      unrealisedGLPct: 0,
      totalReturn: 0,
      ...overrides,
    };
  }

  it('groups by category and computes percentages', () => {
    const enriched = [
      makeEnriched({ asset: makeAsset({ category: 'Shares' }), currentValue: 600 }),
      makeEnriched({ asset: makeAsset({ category: 'ETF' }),    currentValue: 400 }),
    ];
    const alloc = getAllocation(enriched, 'category');

    expect(alloc).toHaveLength(2);
    expect(alloc[0].cat).toBe('Shares');
    expect(alloc[0].val).toBe(600);
    expect(alloc[0].pct).toBeCloseTo(0.6);
    expect(alloc[1].cat).toBe('ETF');
    expect(alloc[1].pct).toBeCloseTo(0.4);
  });

  it('groups by platform', () => {
    const enriched = [
      makeEnriched({ asset: makeAsset({ platform: 'Sharesies' }), currentValue: 300 }),
      makeEnriched({ asset: makeAsset({ platform: 'Hatch' }),     currentValue: 700 }),
    ];
    const alloc = getAllocation(enriched, 'platform');

    expect(alloc[0].cat).toBe('Hatch');
    expect(alloc[1].cat).toBe('Sharesies');
  });

  it('groups by asset name', () => {
    const enriched = [
      makeEnriched({ asset: makeAsset({ id: 'a1', name: 'Apple' }), currentValue: 500 }),
      makeEnriched({ asset: makeAsset({ id: 'a2', name: 'Google' }), currentValue: 500 }),
    ];
    const alloc = getAllocation(enriched, 'asset');

    expect(alloc).toHaveLength(2);
    expect(alloc.map(a => a.cat).sort()).toEqual(['Apple', 'Google']);
    expect(alloc[0].pct).toBeCloseTo(0.5);
  });

  it('merges same-category assets', () => {
    const enriched = [
      makeEnriched({ asset: makeAsset({ id: 'a1', category: 'Shares' }), currentValue: 300 }),
      makeEnriched({ asset: makeAsset({ id: 'a2', category: 'Shares' }), currentValue: 200 }),
    ];
    const alloc = getAllocation(enriched, 'category');

    expect(alloc).toHaveLength(1);
    expect(alloc[0].val).toBe(500);
    expect(alloc[0].pct).toBe(1);
  });

  it('returns sorted by value descending', () => {
    const enriched = [
      makeEnriched({ asset: makeAsset({ category: 'Bonds' }),  currentValue: 100 }),
      makeEnriched({ asset: makeAsset({ category: 'Shares' }), currentValue: 900 }),
    ];
    const alloc = getAllocation(enriched, 'category');

    expect(alloc[0].cat).toBe('Shares');
    expect(alloc[1].cat).toBe('Bonds');
  });

  it('handles empty array', () => {
    expect(getAllocation([], 'category')).toEqual([]);
  });

  it('handles zero total value (all pct = 0)', () => {
    const enriched = [
      makeEnriched({ asset: makeAsset({ category: 'Shares' }), currentValue: 0 }),
    ];
    const alloc = getAllocation(enriched, 'category');

    expect(alloc[0].pct).toBe(0);
  });
});

// ── calcPortfolioOverview ───────────────────────────────────────────────────

describe('calcPortfolioOverview', () => {
  it('aggregates across multiple assets', () => {
    const assets = [
      makeAsset({ id: 'a1', category: 'Shares' }),
      makeAsset({ id: 'a2', category: 'ETF' }),
    ];
    const txs = [
      makeTx({ assetId: 'a1', type: 'buy', units: 10, price: 50 }),
      makeTx({ assetId: 'a2', type: 'buy', units: 20, price: 25 }),
      makeTx({ assetId: 'a1', type: 'dividend', amount: 30, grossAmount: 40, taxAmount: 10 }),
    ];
    const cache = [
      { assetId: 'a1', price: 60, currency: 'NZD', updatedAt: '' },
      { assetId: 'a2', price: 30, currency: 'NZD', updatedAt: '' },
    ];

    const overview = calcPortfolioOverview(assets, txs, cache);

    // a1: value=600, cost=500, unrealised=100
    // a2: value=600, cost=500, unrealised=100
    expect(overview.totalValue).toBe(1200);
    expect(overview.totalCost).toBe(1000);
    expect(overview.unrealisedGL).toBe(200);
    expect(overview.realisedGL).toBe(0);
    expect(overview.totalReturn).toBe(200);
    expect(overview.returnPct).toBe(20);

    // Income
    expect(overview.income.dividendNet).toBe(30);
    expect(overview.income.dividendGross).toBe(40);

    // Allocation (by category, sorted desc)
    expect(overview.allocation).toHaveLength(2);
  });

  it('includes realised GL from sell transactions', () => {
    const assets = [makeAsset({ id: 'a1' })];
    const txs = [
      makeTx({ assetId: 'a1', type: 'buy',  units: 10, price: 50, date: '2025-01-01' }),
      makeTx({ assetId: 'a1', type: 'sell', units: 5,  price: 80, date: '2025-06-01' }),
    ];
    const cache = [{ assetId: 'a1', price: 80, currency: 'NZD', updatedAt: '' }];

    const overview = calcPortfolioOverview(assets, txs, cache);

    // 5 remaining × 80 = 400 value, 5 × 50 = 250 cost
    expect(overview.totalValue).toBe(400);
    expect(overview.totalCost).toBe(250);
    expect(overview.unrealisedGL).toBe(150);
    expect(overview.realisedGL).toBe(150);  // sold 5 @ 80, cost 50 each
    expect(overview.totalReturn).toBe(300);
  });

  it('handles empty portfolio', () => {
    const overview = calcPortfolioOverview([], [], []);

    expect(overview.totalValue).toBe(0);
    expect(overview.totalCost).toBe(0);
    expect(overview.returnPct).toBe(0);
    expect(overview.allocation).toEqual([]);
  });
});

// ── getRecentActivity ───────────────────────────────────────────────────────

describe('getRecentActivity', () => {
  it('returns transactions sorted by date descending', () => {
    const txs = [
      makeTx({ date: '2025-01-01', type: 'buy' }),
      makeTx({ date: '2025-06-01', type: 'sell' }),
      makeTx({ date: '2025-03-01', type: 'dividend' }),
    ];
    const assets = [makeAsset({ id: 'a1', name: 'Apple' })];
    const activity = getRecentActivity(txs, assets);

    expect(activity[0].tx.date).toBe('2025-06-01');
    expect(activity[1].tx.date).toBe('2025-03-01');
    expect(activity[2].tx.date).toBe('2025-01-01');
  });

  it('respects limit parameter', () => {
    const txs = Array.from({ length: 20 }, (_, i) =>
      makeTx({ date: `2025-${String(i + 1).padStart(2, '0')}-01` })
    );
    const activity = getRecentActivity(txs, [], 5);

    expect(activity).toHaveLength(5);
  });

  it('enriches with asset name', () => {
    const txs = [makeTx({ assetId: 'a1', date: '2025-06-01' })];
    const assets = [makeAsset({ id: 'a1', name: 'Tesla' })];
    const activity = getRecentActivity(txs, assets);

    expect(activity[0].assetName).toBe('Tesla');
  });

  it('uses empty string for unknown asset', () => {
    const txs = [makeTx({ assetId: 'unknown', date: '2025-06-01' })];
    const activity = getRecentActivity(txs, []);

    expect(activity[0].assetName).toBe('');
  });

  it('filters out transactions with no date', () => {
    const txs = [
      makeTx({ date: '', type: 'fee' }),
      makeTx({ date: '2025-06-01', type: 'buy' }),
    ];
    const activity = getRecentActivity(txs, []);

    expect(activity).toHaveLength(1);
  });
});

// ── Filtering helpers ───────────────────────────────────────────────────────

describe('filterTxByYear', () => {
  it('filters transactions to the given year', () => {
    const txs = [
      makeTx({ date: '2024-12-31' }),
      makeTx({ date: '2025-01-01' }),
      makeTx({ date: '2025-06-15' }),
      makeTx({ date: '2026-01-01' }),
    ];
    const filtered = filterTxByYear(txs, 2025);
    expect(filtered).toHaveLength(2);
  });

  it('accepts string year', () => {
    const txs = [makeTx({ date: '2025-06-01' })];
    expect(filterTxByYear(txs, '2025')).toHaveLength(1);
  });
});

describe('filterTxByDateRange', () => {
  it('filters inclusively within range', () => {
    const txs = [
      makeTx({ date: '2025-01-01' }),
      makeTx({ date: '2025-03-15' }),
      makeTx({ date: '2025-06-30' }),
      makeTx({ date: '2025-07-01' }),
    ];
    const filtered = filterTxByDateRange(txs, '2025-01-01', '2025-06-30');
    expect(filtered).toHaveLength(3);
  });
});

describe('filterTxByType', () => {
  it('filters to a single transaction type', () => {
    const txs = [
      makeTx({ type: 'buy' }),
      makeTx({ type: 'sell' }),
      makeTx({ type: 'dividend' }),
      makeTx({ type: 'buy' }),
    ];
    expect(filterTxByType(txs, 'buy')).toHaveLength(2);
    expect(filterTxByType(txs, 'dividend')).toHaveLength(1);
  });
});

// ── calcPeriodReturns ───────────────────────────────────────────────────────

describe('calcPeriodReturns', () => {
  it('sums buy amounts as invested', () => {
    const txs = [
      makeTx({ type: 'buy', units: 10, price: 50, amount: 500, date: '2025-03-01' }),
      makeTx({ type: 'buy', units: 5,  price: 60, amount: 300, date: '2025-04-01' }),
    ];
    const pr = calcPeriodReturns(txs, '2025-01-01', '2025-12-31');
    expect(pr.invested).toBe(800);
    expect(pr.txCount).toBe(2);
  });

  it('sums sell amounts as disposed', () => {
    const txs = [
      makeTx({ type: 'buy',  units: 10, price: 50, amount: 500, date: '2025-01-01' }),
      makeTx({ type: 'sell', units: 5,  price: 70, amount: 350, date: '2025-06-01' }),
    ];
    const pr = calcPeriodReturns(txs, '2025-01-01', '2025-12-31');
    expect(pr.disposed).toBe(350);
  });

  it('computes realised GL from sells in period', () => {
    const txs = [
      makeTx({ type: 'buy',  units: 10, price: 50, amount: 500, date: '2025-01-01' }),
      makeTx({ type: 'sell', units: 5,  price: 70, amount: 350, date: '2025-06-01' }),
    ];
    // Avg cost = 50, sell 5 @ 70 → GL = (350 - 0 fee) - (50×5) = 100
    const pr = calcPeriodReturns(txs, '2025-01-01', '2025-12-31');
    expect(pr.realisedGL).toBe(100);
  });

  it('computes realised GL only for sells in the requested period', () => {
    const txs = [
      makeTx({ type: 'buy',  units: 10, price: 50, amount: 500, date: '2025-01-01' }),
      makeTx({ type: 'sell', units: 5,  price: 70, amount: 350, date: '2025-03-01' }),
      makeTx({ type: 'sell', units: 5,  price: 80, amount: 400, date: '2025-09-01' }),
    ];
    // Only include the second sell (Sep) in the H2 period
    const pr = calcPeriodReturns(txs, '2025-07-01', '2025-12-31');
    // After first sell: 5 units remain, cost=250, avg=50
    // Second sell: (5×80) - (50×5) = 400-250 = 150
    expect(pr.realisedGL).toBe(150);
    expect(pr.disposed).toBe(400);
  });

  it('sums dividend totals', () => {
    const txs = [
      makeTx({ type: 'dividend', amount: 50, grossAmount: 70, taxAmount: 20, date: '2025-06-01' }),
      makeTx({ type: 'dividend', amount: 30, grossAmount: 40, taxAmount: 10, date: '2025-07-01' }),
    ];
    const pr = calcPeriodReturns(txs, '2025-01-01', '2025-12-31');
    expect(pr.dividendNet).toBe(80);
    expect(pr.dividendGross).toBe(110);
    expect(pr.dividendTax).toBe(30);
  });

  it('sums fee amounts', () => {
    const txs = [
      makeTx({ type: 'fee', amount: 15, date: '2025-03-01' }),
      makeTx({ type: 'fee', amount: 25, date: '2025-06-01' }),
    ];
    const pr = calcPeriodReturns(txs, '2025-01-01', '2025-12-31');
    expect(pr.feesPaid).toBe(40);
  });

  it('excludes transactions outside the date range', () => {
    const txs = [
      makeTx({ type: 'buy', units: 10, price: 50, amount: 500, date: '2024-12-01' }),
      makeTx({ type: 'buy', units: 5,  price: 60, amount: 300, date: '2025-06-01' }),
    ];
    const pr = calcPeriodReturns(txs, '2025-01-01', '2025-12-31');
    expect(pr.invested).toBe(300);
    expect(pr.txCount).toBe(1);
  });

  it('returns zeros for empty transactions', () => {
    const pr = calcPeriodReturns([], '2025-01-01', '2025-12-31');
    expect(pr.invested).toBe(0);
    expect(pr.disposed).toBe(0);
    expect(pr.realisedGL).toBe(0);
    expect(pr.txCount).toBe(0);
  });
});

// ── buildUnitsTimeline / getUnitsAtDate ─────────────────────────────────────

describe('buildUnitsTimeline', () => {
  it('builds cumulative timeline from buy/sell history', () => {
    const txs = [
      makeTx({ type: 'buy',  units: 10, date: '2025-01-01' }),
      makeTx({ type: 'buy',  units: 5,  date: '2025-02-01' }),
      makeTx({ type: 'sell', units: 3,  date: '2025-03-01' }),
    ];
    const tl = buildUnitsTimeline('a1', txs);

    expect(tl).toHaveLength(3);
    expect(tl[0]).toEqual({ date: '2025-01-01', units: 10 });
    expect(tl[1]).toEqual({ date: '2025-02-01', units: 15 });
    expect(tl[2]).toEqual({ date: '2025-03-01', units: 12 });
  });

  it('ignores non-position transactions', () => {
    const txs = [
      makeTx({ type: 'buy', units: 10, date: '2025-01-01' }),
      makeTx({ type: 'dividend', amount: 50, date: '2025-02-01' }),
      makeTx({ type: 'fee', amount: 5, date: '2025-03-01' }),
    ];
    const tl = buildUnitsTimeline('a1', txs);
    expect(tl).toHaveLength(1);
    expect(tl[0].units).toBe(10);
  });

  it('ignores transactions for other assets', () => {
    const txs = [
      makeTx({ assetId: 'a1', type: 'buy', units: 10, date: '2025-01-01' }),
      makeTx({ assetId: 'a2', type: 'buy', units: 20, date: '2025-01-01' }),
    ];
    const tl = buildUnitsTimeline('a1', txs);
    expect(tl).toHaveLength(1);
    expect(tl[0].units).toBe(10);
  });

  it('cleans up to zero when fully sold', () => {
    const txs = [
      makeTx({ type: 'buy',  units: 10, date: '2025-01-01' }),
      makeTx({ type: 'sell', units: 10, date: '2025-06-01' }),
    ];
    const tl = buildUnitsTimeline('a1', txs);
    expect(tl[1].units).toBe(0);
  });

  it('returns empty for no transactions', () => {
    expect(buildUnitsTimeline('a1', [])).toEqual([]);
  });
});

describe('getUnitsAtDate', () => {
  it('returns cumulative units at a given date', () => {
    const tl = [
      { date: '2025-01-01', units: 10 },
      { date: '2025-02-01', units: 15 },
      { date: '2025-03-01', units: 12 },
    ];
    expect(getUnitsAtDate(tl, '2025-01-15')).toBe(10);
    expect(getUnitsAtDate(tl, '2025-02-01')).toBe(15);
    expect(getUnitsAtDate(tl, '2025-04-01')).toBe(12);
  });

  it('returns 0 before first trade', () => {
    const tl = [{ date: '2025-01-01', units: 10 }];
    expect(getUnitsAtDate(tl, '2024-12-31')).toBe(0);
  });

  it('returns 0 for empty timeline', () => {
    expect(getUnitsAtDate([], '2025-06-01')).toBe(0);
  });
});

// ── calcRealisedSells ────────────────────────────────────────────────────────

describe('calcRealisedSells', () => {
  const assets = [
    { id: 'a1', name: 'Fund A', category: 'ETF', platform: 'Hatch', ticker: 'FA', currency: 'NZD', portfolioId: 'p1', notes: '', createdAt: '' },
  ];

  it('returns per-sell rows with correct G/L', () => {
    const txs = [
      { id: '1', portfolioId: 'p1', assetId: 'a1', date: '2025-01-01', type: 'buy', units: 10, price: 100, amount: 1000, fee: 0, grossAmount: null, taxAmount: null, label: '', linkedTxId: null, notes: '', createdAt: '' },
      { id: '2', portfolioId: 'p1', assetId: 'a1', date: '2025-06-01', type: 'sell', units: 5, price: 150, amount: 750, fee: 0, grossAmount: null, taxAmount: null, label: '', linkedTxId: null, notes: '', createdAt: '' },
    ];
    const rows = calcRealisedSells(txs, assets, '2025-01-01', '2025-12-31');
    expect(rows).toHaveLength(1);
    expect(rows[0].assetName).toBe('Fund A');
    expect(rows[0].proceeds).toBe(750);
    expect(rows[0].costBasis).toBe(500);
    expect(rows[0].gainLoss).toBe(250);
  });

  it('only includes sells within the date range', () => {
    const txs = [
      { id: '1', portfolioId: 'p1', assetId: 'a1', date: '2024-06-01', type: 'buy', units: 10, price: 100, amount: 1000, fee: 0, grossAmount: null, taxAmount: null, label: '', linkedTxId: null, notes: '', createdAt: '' },
      { id: '2', portfolioId: 'p1', assetId: 'a1', date: '2024-12-01', type: 'sell', units: 3, price: 120, amount: 360, fee: 0, grossAmount: null, taxAmount: null, label: '', linkedTxId: null, notes: '', createdAt: '' },
      { id: '3', portfolioId: 'p1', assetId: 'a1', date: '2025-03-01', type: 'sell', units: 2, price: 140, amount: 280, fee: 0, grossAmount: null, taxAmount: null, label: '', linkedTxId: null, notes: '', createdAt: '' },
    ];
    // Only 2025 sells should appear
    const rows = calcRealisedSells(txs, assets, '2025-01-01', '2025-12-31');
    expect(rows).toHaveLength(1);
    expect(rows[0].tx.id).toBe('3');
    // After 2024 sell of 3 @ avg 100: units=7, cost=700
    // Sell 2 @ 140 → proceeds=280, cost=2*100=200, GL=80
    expect(rows[0].gainLoss).toBe(80);
  });

  it('accounts for fees in G/L calculation', () => {
    const txs = [
      { id: '1', portfolioId: 'p1', assetId: 'a1', date: '2025-01-01', type: 'buy', units: 10, price: 100, amount: 1000, fee: 50, grossAmount: null, taxAmount: null, label: '', linkedTxId: null, notes: '', createdAt: '' },
      { id: '2', portfolioId: 'p1', assetId: 'a1', date: '2025-06-01', type: 'sell', units: 5, price: 120, amount: 600, fee: 10, grossAmount: null, taxAmount: null, label: '', linkedTxId: null, notes: '', createdAt: '' },
    ];
    const rows = calcRealisedSells(txs, assets, '2025-01-01', '2025-12-31');
    expect(rows).toHaveLength(1);
    // Buy: cost = 10*100+50 = 1050, avgCost = 105
    // Sell: proceeds = 5*120-10 = 590, costBasis = 5*105 = 525
    expect(rows[0].proceeds).toBe(590);
    expect(rows[0].costBasis).toBe(525);
    expect(rows[0].gainLoss).toBe(65);
  });

  it('returns empty array when no sells in period', () => {
    const txs = [
      { id: '1', portfolioId: 'p1', assetId: 'a1', date: '2025-01-01', type: 'buy', units: 10, price: 100, amount: 1000, fee: 0, grossAmount: null, taxAmount: null, label: '', linkedTxId: null, notes: '', createdAt: '' },
    ];
    const rows = calcRealisedSells(txs, assets, '2025-01-01', '2025-12-31');
    expect(rows).toHaveLength(0);
  });

  it('returns rows sorted by date descending', () => {
    const txs = [
      { id: '1', portfolioId: 'p1', assetId: 'a1', date: '2025-01-01', type: 'buy', units: 20, price: 100, amount: 2000, fee: 0, grossAmount: null, taxAmount: null, label: '', linkedTxId: null, notes: '', createdAt: '' },
      { id: '2', portfolioId: 'p1', assetId: 'a1', date: '2025-03-01', type: 'sell', units: 5, price: 120, amount: 600, fee: 0, grossAmount: null, taxAmount: null, label: '', linkedTxId: null, notes: '', createdAt: '' },
      { id: '3', portfolioId: 'p1', assetId: 'a1', date: '2025-09-01', type: 'sell', units: 3, price: 130, amount: 390, fee: 0, grossAmount: null, taxAmount: null, label: '', linkedTxId: null, notes: '', createdAt: '' },
    ];
    const rows = calcRealisedSells(txs, assets, '2025-01-01', '2025-12-31');
    expect(rows).toHaveLength(2);
    expect(rows[0].tx.date).toBe('2025-09-01');
    expect(rows[1].tx.date).toBe('2025-03-01');
  });
});
