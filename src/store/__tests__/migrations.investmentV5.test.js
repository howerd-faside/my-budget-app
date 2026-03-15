/**
 * Tests for investment domain migration v4 → v5.
 *
 * v5 converts old-model data (holdings, contributions, dividends) into
 * the new transaction-led model (assets, investment transactions, price cache).
 *
 * Covers:
 *   Conversion helpers (unit tests):
 *   - holdingToAsset: identity extraction, currency propagation
 *   - holdingToOpeningTx: opening buy from position data, skip when no units
 *   - holdingToPriceEntry: price cache from current price, skip when no price
 *   - contributionToTx: buy tx from contribution, label preservation
 *   - dividendToTx: dividend tx with gross/tax/net, net fallback to gross−tax
 *
 *   Full migration (integration):
 *   - complete data set converts all entities correctly
 *   - empty data produces empty arrays
 *   - old keys (investments, investmentContributions, investmentDividends) preserved
 *   - entries with missing id are skipped
 *   - holdings with zero units: asset created, no opening tx
 *   - holdings with zero price: asset created, no price entry
 *   - multi-portfolio currency propagation
 *   - full chain v3 → v5 through all intermediate steps
 */
import { describe, it, expect, vi } from 'vitest';
import {
  INVESTMENT_MIGRATIONS,
  holdingToAsset,
  holdingToOpeningTx,
  holdingToPriceEntry,
  contributionToTx,
  dividendToTx,
} from '../migrations/investment';

const migrateV4 = INVESTMENT_MIGRATIONS.find(m => m.toVersion === 4).migrate;
const migrateV5 = INVESTMENT_MIGRATIONS.find(m => m.toVersion === 5).migrate;

// ── Helper unit tests ───────────────────────────────────────────────────────

describe('holdingToAsset', () => {
  it('extracts identity fields and applies currency', () => {
    const h = {
      id: 'h1', portfolioId: 'p1', name: 'Apple Inc.',
      ticker: 'AAPL', platform: 'Sharesies', category: 'Shares',
      units: 10, avgCost: 150, currentPrice: 200,
      notes: 'tech stock', createdAt: '2025-06-01',
    };
    const asset = holdingToAsset(h, 'USD');

    expect(asset.id).toBe('h1');
    expect(asset.portfolioId).toBe('p1');
    expect(asset.name).toBe('Apple Inc.');
    expect(asset.ticker).toBe('AAPL');
    expect(asset.platform).toBe('Sharesies');
    expect(asset.category).toBe('Shares');
    expect(asset.currency).toBe('USD');
    expect(asset.notes).toBe('tech stock');
    expect(asset.createdAt).toBe('2025-06-01');
  });

  it('does not include position or price fields', () => {
    const h = { id: 'h1', units: 10, avgCost: 50, currentPrice: 60 };
    const asset = holdingToAsset(h, 'NZD');

    expect(asset).not.toHaveProperty('units');
    expect(asset).not.toHaveProperty('avgCost');
    expect(asset).not.toHaveProperty('currentPrice');
  });

  it('applies defaults for missing identity fields', () => {
    const asset = holdingToAsset({}, 'NZD');

    expect(asset.id).toBe('');
    expect(asset.name).toBe('');
    expect(asset.ticker).toBe('');
    expect(asset.category).toBe('Shares');
    expect(asset.currency).toBe('NZD');
  });
});

describe('holdingToOpeningTx', () => {
  it('creates a buy transaction from holding position', () => {
    const h = {
      id: 'h1', portfolioId: 'p1',
      units: 25, avgCost: 40,
      createdAt: '2025-06-01',
    };
    const tx = holdingToOpeningTx(h);

    expect(tx).not.toBeNull();
    expect(tx.portfolioId).toBe('p1');
    expect(tx.assetId).toBe('h1');
    expect(tx.type).toBe('buy');
    expect(tx.units).toBe(25);
    expect(tx.price).toBe(40);
    expect(tx.amount).toBe(1000);  // 25 × 40
    expect(tx.fee).toBe(0);
    expect(tx.label).toBe('Opening position (migrated)');
    expect(tx.date).toBe('2025-06-01');
    expect(tx.id).toBeTruthy();    // UUID generated
  });

  it('returns null when units is 0', () => {
    const tx = holdingToOpeningTx({ id: 'h1', units: 0, avgCost: 50 });
    expect(tx).toBeNull();
  });

  it('returns null when units is missing', () => {
    const tx = holdingToOpeningTx({ id: 'h1', avgCost: 50 });
    expect(tx).toBeNull();
  });

  it('returns null when units is negative', () => {
    const tx = holdingToOpeningTx({ id: 'h1', units: -5, avgCost: 50 });
    expect(tx).toBeNull();
  });

  it('handles string numeric values', () => {
    const tx = holdingToOpeningTx({ id: 'h1', units: '10', avgCost: '5.50' });
    expect(tx.units).toBe(10);
    expect(tx.price).toBe(5.5);
    expect(tx.amount).toBe(55);
  });
});

describe('holdingToPriceEntry', () => {
  it('creates a price entry from current price', () => {
    const h = {
      id: 'h1', currentPrice: 123.45,
      priceUpdatedAt: '2026-03-15T10:00:00Z',
    };
    const pe = holdingToPriceEntry(h, 'NZD');

    expect(pe).not.toBeNull();
    expect(pe.assetId).toBe('h1');
    expect(pe.price).toBe(123.45);
    expect(pe.currency).toBe('NZD');
    expect(pe.updatedAt).toBe('2026-03-15T10:00:00Z');
  });

  it('returns null when currentPrice is 0', () => {
    const pe = holdingToPriceEntry({ id: 'h1', currentPrice: 0 }, 'NZD');
    expect(pe).toBeNull();
  });

  it('returns null when currentPrice is missing', () => {
    const pe = holdingToPriceEntry({ id: 'h1' }, 'NZD');
    expect(pe).toBeNull();
  });

  it('handles missing priceUpdatedAt', () => {
    const pe = holdingToPriceEntry({ id: 'h1', currentPrice: 50 }, 'USD');
    expect(pe.updatedAt).toBe('');
  });
});

describe('contributionToTx', () => {
  it('creates a buy transaction from a contribution', () => {
    const c = {
      id: 'c1', portfolioId: 'p1', holdingId: 'h1',
      date: '2026-01-15', amount: 500, type: 'Lump Sum',
      notes: 'extra', createdAt: '2026-01-15',
    };
    const tx = contributionToTx(c);

    expect(tx).not.toBeNull();
    expect(tx.portfolioId).toBe('p1');
    expect(tx.assetId).toBe('h1');
    expect(tx.type).toBe('buy');
    expect(tx.units).toBeNull();   // contributions don't record units
    expect(tx.price).toBeNull();
    expect(tx.amount).toBe(500);
    expect(tx.label).toBe('Lump Sum');
    expect(tx.notes).toBe('extra');
    expect(tx.id).toBeTruthy();
  });

  it('returns null when id is missing', () => {
    const tx = contributionToTx({ portfolioId: 'p1', amount: 100 });
    expect(tx).toBeNull();
  });

  it('returns null when id is empty string', () => {
    const tx = contributionToTx({ id: '', amount: 100 });
    expect(tx).toBeNull();
  });

  it('defaults label to Regular when type is missing', () => {
    const tx = contributionToTx({ id: 'c1', amount: 100 });
    expect(tx.label).toBe('Regular');
  });

  it('handles string amount', () => {
    const tx = contributionToTx({ id: 'c1', amount: '250.50' });
    expect(tx.amount).toBe(250.5);
  });

  it('handles missing holdingId gracefully', () => {
    const tx = contributionToTx({ id: 'c1', amount: 100 });
    expect(tx.assetId).toBe('');
  });
});

describe('dividendToTx', () => {
  it('creates a dividend transaction with gross/tax/net', () => {
    const d = {
      id: 'd1', portfolioId: 'p1', holdingId: 'h1',
      date: '2026-02-01', grossAmount: 100, taxAmount: 33,
      netAmount: 67, notes: 'Q4', createdAt: '2026-02-01',
    };
    const tx = dividendToTx(d);

    expect(tx).not.toBeNull();
    expect(tx.portfolioId).toBe('p1');
    expect(tx.assetId).toBe('h1');
    expect(tx.type).toBe('dividend');
    expect(tx.amount).toBe(67);
    expect(tx.grossAmount).toBe(100);
    expect(tx.taxAmount).toBe(33);
    expect(tx.label).toBe('Dividend');
    expect(tx.units).toBeNull();
    expect(tx.price).toBeNull();
  });

  it('falls back to gross − tax when netAmount is missing', () => {
    const d = { id: 'd1', grossAmount: 200, taxAmount: 66 };
    const tx = dividendToTx(d);

    expect(tx.amount).toBe(134);  // 200 − 66
  });

  it('falls back to gross − tax when netAmount is empty string', () => {
    const d = { id: 'd1', grossAmount: 80, taxAmount: 26.4, netAmount: '' };
    const tx = dividendToTx(d);

    expect(tx.amount).toBeCloseTo(53.6);
  });

  it('handles zero netAmount as valid (does not fall back)', () => {
    // Edge case: netAmount explicitly 0 should NOT be replaced with gross−tax
    const d = { id: 'd1', grossAmount: 100, taxAmount: 100, netAmount: 0 };
    const tx = dividendToTx(d);

    expect(tx.amount).toBe(0);
  });

  it('returns null when id is missing', () => {
    const tx = dividendToTx({ grossAmount: 100 });
    expect(tx).toBeNull();
  });

  it('sets grossAmount/taxAmount to null when they are 0', () => {
    const d = { id: 'd1', grossAmount: 0, taxAmount: 0, netAmount: 50 };
    const tx = dividendToTx(d);

    expect(tx.grossAmount).toBeNull();
    expect(tx.taxAmount).toBeNull();
  });

  it('handles string amounts', () => {
    const d = { id: 'd1', grossAmount: '100', taxAmount: '33', netAmount: '67' };
    const tx = dividendToTx(d);

    expect(tx.amount).toBe(67);
    expect(tx.grossAmount).toBe(100);
    expect(tx.taxAmount).toBe(33);
  });
});

// ── Full v5 migration tests ─────────────────────────────────────────────────

describe('investment migration v4 → v5', () => {
  function makeSlice(overrides = {}) {
    return {
      investmentPortfolios: [{ id: 'p1', name: 'Main', currency: 'NZD', costBasisMethod: 'average', createdAt: '2025-01-01' }],
      selectedPortfolioId: 'p1',
      investments: [],
      investmentContributions: [],
      investmentDividends: [],
      investmentAssets: [],
      investmentTransactions: [],
      priceCache: [],
      ...overrides,
    };
  }

  it('converts a complete data set correctly', () => {
    const slice = makeSlice({
      investments: [
        { id: 'h1', portfolioId: 'p1', name: 'Apple', ticker: 'AAPL', platform: 'Sharesies', category: 'Shares', units: 10, avgCost: 150, currentPrice: 200, priceUpdatedAt: '2026-03-15', notes: '', createdAt: '2025-06-01' },
      ],
      investmentContributions: [
        { id: 'c1', portfolioId: 'p1', holdingId: 'h1', date: '2025-07-01', amount: 1500, type: 'Regular', notes: '', createdAt: '2025-07-01' },
      ],
      investmentDividends: [
        { id: 'd1', portfolioId: 'p1', holdingId: 'h1', date: '2025-09-01', grossAmount: 50, taxAmount: 16.5, netAmount: 33.5, notes: '', createdAt: '2025-09-01' },
      ],
    });

    const result = migrateV5(slice);

    // Assets: 1 from holding
    expect(result.investmentAssets).toHaveLength(1);
    expect(result.investmentAssets[0].id).toBe('h1');
    expect(result.investmentAssets[0].name).toBe('Apple');
    expect(result.investmentAssets[0].ticker).toBe('AAPL');
    expect(result.investmentAssets[0].currency).toBe('NZD');

    // Transactions: 1 opening buy + 1 contribution buy + 1 dividend = 3
    expect(result.investmentTransactions).toHaveLength(3);

    const openingTx = result.investmentTransactions.find(t => t.label === 'Opening position (migrated)');
    expect(openingTx).toBeDefined();
    expect(openingTx.type).toBe('buy');
    expect(openingTx.units).toBe(10);
    expect(openingTx.price).toBe(150);
    expect(openingTx.amount).toBe(1500);
    expect(openingTx.assetId).toBe('h1');

    const contribTx = result.investmentTransactions.find(t => t.label === 'Regular');
    expect(contribTx).toBeDefined();
    expect(contribTx.type).toBe('buy');
    expect(contribTx.amount).toBe(1500);
    expect(contribTx.assetId).toBe('h1');
    expect(contribTx.units).toBeNull();

    const divTx = result.investmentTransactions.find(t => t.label === 'Dividend');
    expect(divTx).toBeDefined();
    expect(divTx.type).toBe('dividend');
    expect(divTx.amount).toBe(33.5);
    expect(divTx.grossAmount).toBe(50);
    expect(divTx.taxAmount).toBe(16.5);

    // Price cache: 1 from holding
    expect(result.priceCache).toHaveLength(1);
    expect(result.priceCache[0].assetId).toBe('h1');
    expect(result.priceCache[0].price).toBe(200);
  });

  it('produces empty arrays when there is no legacy data', () => {
    const result = migrateV5(makeSlice());

    expect(result.investmentAssets).toEqual([]);
    expect(result.investmentTransactions).toEqual([]);
    expect(result.priceCache).toEqual([]);
  });

  it('preserves old keys unchanged', () => {
    const holdings = [{ id: 'h1', portfolioId: 'p1', name: 'Test', units: 5, avgCost: 10, currentPrice: 12, createdAt: '2025-01-01' }];
    const contributions = [{ id: 'c1', portfolioId: 'p1', holdingId: 'h1', amount: 100, date: '2025-02-01', type: 'Regular', createdAt: '2025-02-01' }];
    const dividends = [{ id: 'd1', portfolioId: 'p1', holdingId: 'h1', grossAmount: 10, taxAmount: 3, netAmount: 7, date: '2025-03-01', createdAt: '2025-03-01' }];

    const slice = makeSlice({
      investments: holdings,
      investmentContributions: contributions,
      investmentDividends: dividends,
    });

    const result = migrateV5(slice);

    // Old keys are still present and unchanged
    expect(result.investments).toBe(holdings);
    expect(result.investmentContributions).toBe(contributions);
    expect(result.investmentDividends).toBe(dividends);
  });

  it('skips entries with missing id', () => {
    const slice = makeSlice({
      investments: [
        { id: 'h1', portfolioId: 'p1', name: 'Valid', units: 5, avgCost: 10, currentPrice: 15, createdAt: '2025-01-01' },
      ],
      investmentContributions: [
        { portfolioId: 'p1', amount: 100 },       // no id
        { id: '', portfolioId: 'p1', amount: 200 }, // empty id
      ],
      investmentDividends: [
        { portfolioId: 'p1', grossAmount: 50 },    // no id
      ],
    });

    const result = migrateV5(slice);

    // Holding always produces an asset (even without id in theory, but real data has ids)
    expect(result.investmentAssets).toHaveLength(1);
    // Only the opening tx from the holding — contributions and dividends skipped
    expect(result.investmentTransactions).toHaveLength(1);
    expect(result.investmentTransactions[0].label).toBe('Opening position (migrated)');
  });

  it('creates asset but no opening tx when units is 0', () => {
    const slice = makeSlice({
      investments: [
        { id: 'h1', portfolioId: 'p1', name: 'Empty', units: 0, avgCost: 0, currentPrice: 50, createdAt: '2025-01-01' },
      ],
    });

    const result = migrateV5(slice);

    expect(result.investmentAssets).toHaveLength(1);
    expect(result.investmentAssets[0].name).toBe('Empty');

    // No opening tx since units = 0
    const openingTxs = result.investmentTransactions.filter(t => t.label === 'Opening position (migrated)');
    expect(openingTxs).toHaveLength(0);

    // But price entry IS created since currentPrice > 0
    expect(result.priceCache).toHaveLength(1);
    expect(result.priceCache[0].price).toBe(50);
  });

  it('creates asset but no price entry when currentPrice is 0', () => {
    const slice = makeSlice({
      investments: [
        { id: 'h1', portfolioId: 'p1', name: 'NoPriceYet', units: 10, avgCost: 5, currentPrice: 0, createdAt: '2025-01-01' },
      ],
    });

    const result = migrateV5(slice);

    expect(result.investmentAssets).toHaveLength(1);
    expect(result.priceCache).toHaveLength(0);
    // Opening tx still created since units > 0
    expect(result.investmentTransactions).toHaveLength(1);
  });

  it('propagates per-portfolio currency to assets and price entries', () => {
    const slice = makeSlice({
      investmentPortfolios: [
        { id: 'p1', name: 'NZ', currency: 'NZD', createdAt: '' },
        { id: 'p2', name: 'US', currency: 'USD', createdAt: '' },
      ],
      investments: [
        { id: 'h1', portfolioId: 'p1', name: 'NZ Stock', units: 1, avgCost: 10, currentPrice: 12, createdAt: '2025-01-01' },
        { id: 'h2', portfolioId: 'p2', name: 'US Stock', units: 2, avgCost: 20, currentPrice: 25, createdAt: '2025-01-01' },
      ],
    });

    const result = migrateV5(slice);

    expect(result.investmentAssets.find(a => a.id === 'h1').currency).toBe('NZD');
    expect(result.investmentAssets.find(a => a.id === 'h2').currency).toBe('USD');
    expect(result.priceCache.find(p => p.assetId === 'h1').currency).toBe('NZD');
    expect(result.priceCache.find(p => p.assetId === 'h2').currency).toBe('USD');
  });

  it('defaults currency to NZD when portfolio has no currency field', () => {
    const slice = makeSlice({
      investmentPortfolios: [{ id: 'p1', name: 'Legacy', createdAt: '' }], // no currency
      investments: [
        { id: 'h1', portfolioId: 'p1', name: 'Test', units: 1, avgCost: 10, currentPrice: 15, createdAt: '2025-01-01' },
      ],
    });

    const result = migrateV5(slice);
    expect(result.investmentAssets[0].currency).toBe('NZD');
  });

  it('handles missing arrays gracefully', () => {
    const result = migrateV5({
      investmentPortfolios: [],
      selectedPortfolioId: null,
    });

    expect(result.investmentAssets).toEqual([]);
    expect(result.investmentTransactions).toEqual([]);
    expect(result.priceCache).toEqual([]);
  });

  it('generates unique ids for each transaction', () => {
    const slice = makeSlice({
      investments: [
        { id: 'h1', portfolioId: 'p1', name: 'A', units: 1, avgCost: 10, currentPrice: 15, createdAt: '2025-01-01' },
      ],
      investmentContributions: [
        { id: 'c1', portfolioId: 'p1', holdingId: 'h1', amount: 100, date: '2025-02-01', createdAt: '2025-02-01' },
        { id: 'c2', portfolioId: 'p1', holdingId: 'h1', amount: 200, date: '2025-03-01', createdAt: '2025-03-01' },
      ],
    });

    const result = migrateV5(slice);
    const ids = result.investmentTransactions.map(t => t.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(ids.length);
  });
});

// ── Full chain test ─────────────────────────────────────────────────────────

describe('investment migration chain v3 → v5', () => {
  it('migrates raw v3 data through v4 and v5 correctly', () => {
    // Simulate data that was persisted at v3 (pre-new-model)
    const v3Slice = {
      investmentPortfolios: [{ id: 'p1', name: 'Main', createdAt: '2025-01-01' }],
      selectedPortfolioId: 'p1',
      investments: [
        {
          id: 'h1', portfolioId: 'p1', name: 'Fisher Funds', ticker: '',
          platform: 'InvestNow', category: 'Managed Fund',
          units: 1000, avgCost: 2.5, currentPrice: 3.1,
          priceUpdatedAt: '2026-03-10', notes: 'KS fund', createdAt: '2024-06-01',
        },
      ],
      investmentContributions: [
        { id: 'c1', portfolioId: 'p1', holdingId: 'h1', date: '2025-01-15', platform: 'InvestNow', amount: 250, type: 'KiwiSaver', notes: '', createdAt: '2025-01-15' },
      ],
      investmentDividends: [
        { id: 'd1', portfolioId: 'p1', holdingId: 'h1', date: '2025-06-30', platform: 'InvestNow', grossAmount: 45, taxAmount: 12.6, netAmount: '', notes: 'FY dist', createdAt: '2025-07-01' },
      ],
    };

    // Run v4 then v5 in sequence
    const afterV4 = migrateV4(JSON.parse(JSON.stringify(v3Slice)));
    const afterV5 = migrateV5(afterV4);

    // v4 should have added portfolio fields
    expect(afterV5.investmentPortfolios[0].currency).toBe('NZD');
    expect(afterV5.investmentPortfolios[0].costBasisMethod).toBe('average');

    // Asset created from holding
    expect(afterV5.investmentAssets).toHaveLength(1);
    const asset = afterV5.investmentAssets[0];
    expect(asset.id).toBe('h1');
    expect(asset.name).toBe('Fisher Funds');
    expect(asset.category).toBe('Managed Fund');
    expect(asset.ticker).toBe('');
    expect(asset.currency).toBe('NZD');

    // Transactions: 1 opening + 1 contribution + 1 dividend = 3
    expect(afterV5.investmentTransactions).toHaveLength(3);

    const openTx = afterV5.investmentTransactions.find(t => t.label === 'Opening position (migrated)');
    expect(openTx.units).toBe(1000);
    expect(openTx.price).toBe(2.5);
    expect(openTx.amount).toBe(2500);

    const ksTx = afterV5.investmentTransactions.find(t => t.label === 'KiwiSaver');
    expect(ksTx.type).toBe('buy');
    expect(ksTx.amount).toBe(250);
    expect(ksTx.assetId).toBe('h1');

    const divTx = afterV5.investmentTransactions.find(t => t.type === 'dividend');
    expect(divTx.amount).toBeCloseTo(32.4); // 45 − 12.6 (netAmount was blank)
    expect(divTx.grossAmount).toBe(45);
    expect(divTx.taxAmount).toBe(12.6);

    // Price cache from holding
    expect(afterV5.priceCache).toHaveLength(1);
    expect(afterV5.priceCache[0].price).toBe(3.1);
    expect(afterV5.priceCache[0].updatedAt).toBe('2026-03-10');

    // Old keys preserved
    expect(afterV5.investments).toHaveLength(1);
    expect(afterV5.investmentContributions).toHaveLength(1);
    expect(afterV5.investmentDividends).toHaveLength(1);
  });
});
