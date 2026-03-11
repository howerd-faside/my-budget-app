/**
 * Tests for the canonical Transaction model and its query helpers.
 *
 * Covers:
 *   Transaction adapters (src/models/Transaction.js):
 *     - transactionFromExpense    — maps Expense to outflow Transaction
 *     - transactionFromTransfer   — maps Transfer; captures both sides (source + target)
 *     - transactionFromContribution — maps InvestmentContribution to outflow Transaction
 *     - transactionFromDividend   — maps Dividend; amount = netAmount
 *     - transactionFromAssetIncome — maps AssetIncome to inflow Transaction
 *
 *   Query helpers (src/utils/finance/transactions.js):
 *     - getPortfolioActivity — combines contributions + dividends, resolves holding names
 *     - filterByYear         — filters by ISO year prefix
 *     - filterByDateRange    — inclusive date range filter
 *     - sumTransactions      — sums tx.amount across array
 *
 *   Projection equivalence (src/utils/finance/savings.js):
 *     - calcPortfolioStats still produces the same values after internal refactor
 */
import { describe, it, expect } from 'vitest';
import {
  TX_DIRECTION, TX_TYPE, TX_DOMAIN,
  transactionFromExpense,
  transactionFromTransfer,
  transactionFromContribution,
  transactionFromDividend,
  transactionFromAssetIncome,
} from '../../models/Transaction';
import {
  getPortfolioActivity,
  filterByYear,
  filterByYearMonth,
  filterByDateRange,
  sumTransactions,
  sumField,
  groupSumByCategory,
} from '../../utils/finance/transactions';
import { calcPortfolioStats } from '../../utils/finance/savings';

// ── transactionFromExpense ────────────────────────────────────────────────────

describe('transactionFromExpense', () => {
  const expense = {
    id: 'e1', name: 'Rent', category: 'Housing', type: 'standard', subtype: 'fixed',
    amount: 1800, frequency: 'monthly', startDate: '2025-01-01', endDate: '',
    forPerson: 'p1', notes: 'Main rent', paymentMethod: 'Direct Debit',
  };

  it('sets direction to outflow', () => {
    expect(transactionFromExpense(expense).direction).toBe(TX_DIRECTION.OUTFLOW);
  });

  it('sets type to expense', () => {
    expect(transactionFromExpense(expense).type).toBe(TX_TYPE.EXPENSE);
  });

  it('sets domain to finance', () => {
    expect(transactionFromExpense(expense).domain).toBe(TX_DOMAIN.FINANCE);
  });

  it('copies id and amount as a number', () => {
    const tx = transactionFromExpense(expense);
    expect(tx.id).toBe('e1');
    expect(tx.amount).toBe(1800);
    expect(typeof tx.amount).toBe('number');
  });

  it('uses startDate as the transaction date', () => {
    expect(transactionFromExpense(expense).date).toBe('2025-01-01');
  });

  it('sets date to null when startDate is absent', () => {
    expect(transactionFromExpense({ ...expense, startDate: '' }).date).toBeNull();
  });

  it('maps category from expense.category', () => {
    expect(transactionFromExpense(expense).category).toBe('Housing');
  });

  it('retains frequency as a supplemental field', () => {
    expect(transactionFromExpense(expense).frequency).toBe('monthly');
  });

  it('maps forPerson to sourceEntityId', () => {
    expect(transactionFromExpense(expense).sourceEntityId).toBe('p1');
  });

  it('sourceEntityId is null when forPerson is absent', () => {
    expect(transactionFromExpense({ ...expense, forPerson: '' }).sourceEntityId).toBeNull();
  });

  it('targetEntityType and targetEntityId are null (no specific target for expenses)', () => {
    const tx = transactionFromExpense(expense);
    expect(tx.targetEntityType).toBeNull();
    expect(tx.targetEntityId).toBeNull();
  });

  it('coerces string amount to number', () => {
    const tx = transactionFromExpense({ ...expense, amount: '2400' });
    expect(tx.amount).toBe(2400);
    expect(typeof tx.amount).toBe('number');
  });

  it('uses 0 for missing/invalid amount', () => {
    expect(transactionFromExpense({ ...expense, amount: '' }).amount).toBe(0);
    expect(transactionFromExpense({ ...expense, amount: null }).amount).toBe(0);
  });
});

// ── transactionFromTransfer ───────────────────────────────────────────────────

describe('transactionFromTransfer', () => {
  const transfer = {
    id: 't1', date: '2026-01-15', fromId: 'savings', toId: 'emergency',
    amount: 500, note: 'Top up emergency fund',
  };

  it('sets direction to transfer', () => {
    expect(transactionFromTransfer(transfer).direction).toBe(TX_DIRECTION.TRANSFER);
  });

  it('sets type to transfer', () => {
    expect(transactionFromTransfer(transfer).type).toBe(TX_TYPE.TRANSFER);
  });

  it('sets domain to finance', () => {
    expect(transactionFromTransfer(transfer).domain).toBe(TX_DOMAIN.FINANCE);
  });

  it('captures both sides — sourceEntityId (from) and targetEntityId (to)', () => {
    const tx = transactionFromTransfer(transfer);
    expect(tx.sourceEntityType).toBe('account');
    expect(tx.sourceEntityId).toBe('savings');
    expect(tx.targetEntityType).toBe('account');
    expect(tx.targetEntityId).toBe('emergency');
  });

  it('copies amount as a number', () => {
    const tx = transactionFromTransfer(transfer);
    expect(tx.amount).toBe(500);
    expect(typeof tx.amount).toBe('number');
  });

  it('copies date', () => {
    expect(transactionFromTransfer(transfer).date).toBe('2026-01-15');
  });

  it('maps note to notes', () => {
    expect(transactionFromTransfer(transfer).notes).toBe('Top up emergency fund');
  });

  it('coerces string amount to number', () => {
    expect(transactionFromTransfer({ ...transfer, amount: '250' }).amount).toBe(250);
  });

  it('uses 0 for missing amount', () => {
    expect(transactionFromTransfer({ ...transfer, amount: undefined }).amount).toBe(0);
  });
});

// ── transactionFromContribution ───────────────────────────────────────────────

describe('transactionFromContribution', () => {
  const contribution = {
    id: 'c1', portfolioId: 'port1', date: '2026-02-01',
    holdingId: 'h1', platform: 'Sharesies',
    amount: 500, type: 'Regular', notes: '', createdAt: '2026-02-01T10:00:00.000Z',
  };

  it('sets direction to outflow', () => {
    expect(transactionFromContribution(contribution).direction).toBe(TX_DIRECTION.OUTFLOW);
  });

  it('sets type to contribution', () => {
    expect(transactionFromContribution(contribution).type).toBe(TX_TYPE.CONTRIBUTION);
  });

  it('sets domain to investment', () => {
    expect(transactionFromContribution(contribution).domain).toBe(TX_DOMAIN.INVESTMENT);
  });

  it('copies amount as a number', () => {
    const tx = transactionFromContribution(contribution);
    expect(tx.amount).toBe(500);
    expect(typeof tx.amount).toBe('number');
  });

  it('maps portfolioId to sourceEntityId', () => {
    const tx = transactionFromContribution(contribution);
    expect(tx.sourceEntityType).toBe('portfolio');
    expect(tx.sourceEntityId).toBe('port1');
  });

  it('maps holdingId to targetEntityId', () => {
    const tx = transactionFromContribution(contribution);
    expect(tx.targetEntityType).toBe('holding');
    expect(tx.targetEntityId).toBe('h1');
  });

  it('maps contribution.type to category', () => {
    expect(transactionFromContribution(contribution).category).toBe('Regular');
  });

  it('copies date and createdAt', () => {
    const tx = transactionFromContribution(contribution);
    expect(tx.date).toBe('2026-02-01');
    expect(tx.createdAt).toBe('2026-02-01T10:00:00.000Z');
  });

  it('coerces string amount to number', () => {
    expect(transactionFromContribution({ ...contribution, amount: '1500' }).amount).toBe(1500);
  });

  it('uses 0 for empty amount', () => {
    expect(transactionFromContribution({ ...contribution, amount: '' }).amount).toBe(0);
  });

  it('targetEntityId is null when holdingId is absent (portfolio-level contribution)', () => {
    const tx = transactionFromContribution({ ...contribution, holdingId: '' });
    expect(tx.targetEntityId).toBeNull();
  });
});

// ── transactionFromDividend ───────────────────────────────────────────────────

describe('transactionFromDividend', () => {
  const dividend = {
    id: 'd1', portfolioId: 'port1', date: '2026-03-15',
    holdingId: 'h1', platform: 'Sharesies',
    grossAmount: 100, taxAmount: 33, netAmount: 67,
    notes: 'Q1 dividend', createdAt: '2026-03-15T09:00:00.000Z',
  };

  it('sets direction to inflow', () => {
    expect(transactionFromDividend(dividend).direction).toBe(TX_DIRECTION.INFLOW);
  });

  it('sets type to dividend', () => {
    expect(transactionFromDividend(dividend).type).toBe(TX_TYPE.DIVIDEND);
  });

  it('sets domain to investment', () => {
    expect(transactionFromDividend(dividend).domain).toBe(TX_DOMAIN.INVESTMENT);
  });

  it('uses netAmount as the canonical amount', () => {
    const tx = transactionFromDividend(dividend);
    expect(tx.amount).toBe(67);
    expect(typeof tx.amount).toBe('number');
  });

  it('exposes grossAmount and taxAmount as supplemental fields', () => {
    const tx = transactionFromDividend(dividend);
    expect(tx.grossAmount).toBe(100);
    expect(tx.taxAmount).toBe(33);
  });

  it('maps holdingId to sourceEntityId (the paying holding)', () => {
    const tx = transactionFromDividend(dividend);
    expect(tx.sourceEntityType).toBe('holding');
    expect(tx.sourceEntityId).toBe('h1');
  });

  it('maps portfolioId to targetEntityId', () => {
    const tx = transactionFromDividend(dividend);
    expect(tx.targetEntityType).toBe('portfolio');
    expect(tx.targetEntityId).toBe('port1');
  });

  it('copies date and createdAt', () => {
    const tx = transactionFromDividend(dividend);
    expect(tx.date).toBe('2026-03-15');
    expect(tx.createdAt).toBe('2026-03-15T09:00:00.000Z');
  });

  it('coerces string amounts to numbers', () => {
    const tx = transactionFromDividend({
      ...dividend, grossAmount: '200', taxAmount: '66', netAmount: '134',
    });
    expect(tx.amount).toBe(134);
    expect(tx.grossAmount).toBe(200);
    expect(tx.taxAmount).toBe(66);
  });

  it('uses 0 for missing netAmount', () => {
    expect(transactionFromDividend({ ...dividend, netAmount: '' }).amount).toBe(0);
  });
});

// ── transactionFromAssetIncome ────────────────────────────────────────────────

describe('transactionFromAssetIncome', () => {
  const assetIncome = {
    id: 'ai1', name: 'Rental income', type: 'rental',
    amount: 1200, frequency: 'monthly', notes: 'Investment property',
  };

  it('sets direction to inflow', () => {
    expect(transactionFromAssetIncome(assetIncome).direction).toBe(TX_DIRECTION.INFLOW);
  });

  it('sets type to asset_income', () => {
    expect(transactionFromAssetIncome(assetIncome).type).toBe(TX_TYPE.ASSET_INCOME);
  });

  it('sets domain to finance', () => {
    expect(transactionFromAssetIncome(assetIncome).domain).toBe(TX_DOMAIN.FINANCE);
  });

  it('copies amount as a number', () => {
    const tx = transactionFromAssetIncome(assetIncome);
    expect(tx.amount).toBe(1200);
    expect(typeof tx.amount).toBe('number');
  });

  it('date is null (recurring flow has no single event date)', () => {
    expect(transactionFromAssetIncome(assetIncome).date).toBeNull();
  });

  it('maps assetIncome.type (rental/dividend/etc) to category', () => {
    expect(transactionFromAssetIncome(assetIncome).category).toBe('rental');
  });

  it('retains frequency as a supplemental field', () => {
    expect(transactionFromAssetIncome(assetIncome).frequency).toBe('monthly');
  });

  it('sourceEntityId and targetEntityId are null (not linked to a specific entity)', () => {
    const tx = transactionFromAssetIncome(assetIncome);
    expect(tx.sourceEntityId).toBeNull();
    expect(tx.targetEntityId).toBeNull();
  });

  it('coerces string amount to number', () => {
    expect(transactionFromAssetIncome({ ...assetIncome, amount: '800' }).amount).toBe(800);
  });

  it('uses 0 for missing amount', () => {
    expect(transactionFromAssetIncome({ ...assetIncome, amount: null }).amount).toBe(0);
  });
});

// ── getPortfolioActivity ──────────────────────────────────────────────────────

describe('getPortfolioActivity', () => {
  const holdings = [
    { id: 'h1', name: 'Apple Inc.', portfolioId: 'port1' },
    { id: 'h2', name: 'NZ ETF',    portfolioId: 'port1' },
  ];

  const contributions = [
    { id: 'c1', portfolioId: 'port1', date: '2026-03-01', holdingId: 'h1', platform: 'Sharesies', amount: 500, type: 'Regular' },
    { id: 'c2', portfolioId: 'port1', date: '2026-01-15', holdingId: 'h2', platform: 'Sharesies', amount: 200, type: 'Lump Sum' },
  ];

  const dividends = [
    { id: 'd1', portfolioId: 'port1', date: '2026-02-10', holdingId: 'h1', platform: 'Sharesies', grossAmount: 80, taxAmount: 26, netAmount: 54 },
    { id: 'd2', portfolioId: 'port1', date: '2026-04-01', holdingId: '',   platform: 'ANZ', grossAmount: 30, taxAmount: 10, netAmount: 20 },
  ];

  it('returns Transaction[] augmented with label and holding fields', () => {
    const result = getPortfolioActivity(contributions, dividends, holdings);
    expect(result[0]).toHaveProperty('label');
    expect(result[0]).toHaveProperty('holding');
    expect(result[0]).toHaveProperty('amount');
    expect(result[0]).toHaveProperty('type');
    expect(result[0]).toHaveProperty('date');
  });

  it('sorts results newest first', () => {
    const result = getPortfolioActivity(contributions, dividends, holdings);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].date <= result[i - 1].date).toBe(true);
    }
  });

  it('limits results to 8 by default', () => {
    const manyCx = Array.from({ length: 10 }, (_, i) => ({
      id: `c${i}`, portfolioId: 'port1', date: `2026-0${(i % 9) + 1}-01`,
      holdingId: 'h1', platform: 'P', amount: 100, type: 'Regular',
    }));
    expect(getPortfolioActivity(manyCx, [], holdings).length).toBeLessThanOrEqual(8);
  });

  it('respects custom limit', () => {
    expect(getPortfolioActivity(contributions, dividends, holdings, 2).length).toBe(2);
  });

  it('resolves holding name from holdings array for contributions', () => {
    const result = getPortfolioActivity(contributions, [], holdings);
    const c1Item = result.find(r => r.id === 'c1');
    expect(c1Item.holding).toBe('Apple Inc.');
  });

  it('resolves holding name from holdings array for dividends', () => {
    const result = getPortfolioActivity([], dividends, holdings);
    const d1Item = result.find(r => r.id === 'd1');
    expect(d1Item.holding).toBe('Apple Inc.');
  });

  it('falls back to platform name when holdingId does not match any holding', () => {
    const result = getPortfolioActivity([], dividends, holdings);
    const d2Item = result.find(r => r.id === 'd2');
    expect(d2Item.holding).toBe('ANZ');
  });

  it('uses "—" when holdingId is absent and platform is empty', () => {
    const noPlatform = [{ ...dividends[1], platform: '' }];
    const result = getPortfolioActivity([], noPlatform, holdings);
    expect(result[0].holding).toBe('—');
  });

  it('sets label to contribution.type for contributions', () => {
    const result = getPortfolioActivity(contributions, [], holdings);
    const c1Item = result.find(r => r.id === 'c1');
    expect(c1Item.label).toBe('Regular');
    const c2Item = result.find(r => r.id === 'c2');
    expect(c2Item.label).toBe('Lump Sum');
  });

  it('sets label to "Dividend" for dividends', () => {
    const result = getPortfolioActivity([], dividends, holdings);
    expect(result[0].label).toBe('Dividend');
  });

  it('excludes items with no date', () => {
    const noDate = [{ ...contributions[0], date: '' }];
    const result = getPortfolioActivity(noDate, [], holdings);
    expect(result).toHaveLength(0);
  });

  it('returns empty array for all-empty inputs', () => {
    expect(getPortfolioActivity([], [], [])).toEqual([]);
    expect(getPortfolioActivity(null, null, null)).toEqual([]);
  });

  it('uses dividend.amount (netAmount) as the item amount', () => {
    const result = getPortfolioActivity([], dividends, holdings);
    const d1Item = result.find(r => r.id === 'd1');
    expect(d1Item.amount).toBe(54); // netAmount, not grossAmount
  });
});

// ── filterByYear ──────────────────────────────────────────────────────────────

describe('filterByYear', () => {
  const txs = [
    { id: 't1', date: '2025-06-01', amount: 100, type: 'contribution', direction: 'outflow', domain: 'investment' },
    { id: 't2', date: '2026-01-15', amount: 200, type: 'dividend',     direction: 'inflow',  domain: 'investment' },
    { id: 't3', date: '2026-12-31', amount:  50, type: 'contribution', direction: 'outflow', domain: 'investment' },
    { id: 't4', date: null,         amount:  80, type: 'asset_income', direction: 'inflow',  domain: 'finance'    },
  ];

  it('returns only transactions from the specified year', () => {
    const result = filterByYear(txs, 2026);
    expect(result).toHaveLength(2);
    expect(result.map(t => t.id)).toEqual(['t2', 't3']);
  });

  it('accepts year as a string', () => {
    const result = filterByYear(txs, '2025');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
  });

  it('excludes transactions with null date', () => {
    const result = filterByYear(txs, 2026);
    expect(result.find(t => t.id === 't4')).toBeUndefined();
  });

  it('returns empty array for an empty input', () => {
    expect(filterByYear([], 2026)).toEqual([]);
    expect(filterByYear(null, 2026)).toEqual([]);
  });

  it('returns empty array when no transactions match the year', () => {
    expect(filterByYear(txs, 2030)).toEqual([]);
  });
});

// ── filterByDateRange ─────────────────────────────────────────────────────────

describe('filterByDateRange', () => {
  const txs = [
    { id: 't1', date: '2026-01-01', amount: 100 },
    { id: 't2', date: '2026-06-15', amount: 200 },
    { id: 't3', date: '2026-12-31', amount:  50 },
    { id: 't4', date: null,         amount:  80 },
  ];

  it('returns transactions within range (inclusive)', () => {
    const result = filterByDateRange(txs, '2026-01-01', '2026-06-15');
    expect(result.map(t => t.id)).toEqual(['t1', 't2']);
  });

  it('excludes transactions outside range', () => {
    const result = filterByDateRange(txs, '2026-02-01', '2026-06-30');
    expect(result.map(t => t.id)).toEqual(['t2']);
  });

  it('excludes null-date transactions', () => {
    const result = filterByDateRange(txs, '2026-01-01', '2026-12-31');
    expect(result.find(t => t.id === 't4')).toBeUndefined();
  });

  it('returns all dated transactions when range spans the full dataset', () => {
    const result = filterByDateRange(txs, '2026-01-01', '2026-12-31');
    expect(result).toHaveLength(3);
  });

  it('returns empty for null/empty input', () => {
    expect(filterByDateRange(null, '2026-01-01', '2026-12-31')).toEqual([]);
    expect(filterByDateRange([],   '2026-01-01', '2026-12-31')).toEqual([]);
  });
});

// ── sumTransactions ───────────────────────────────────────────────────────────

describe('sumTransactions', () => {
  it('sums amounts across a Transaction array', () => {
    const txs = [{ amount: 100 }, { amount: 200 }, { amount: 50 }];
    expect(sumTransactions(txs)).toBe(350);
  });

  it('returns 0 for an empty array', () => {
    expect(sumTransactions([])).toBe(0);
    expect(sumTransactions(null)).toBe(0);
  });

  it('handles a single-element array', () => {
    expect(sumTransactions([{ amount: 999 }])).toBe(999);
  });

  it('handles decimal amounts without floating-point overflow', () => {
    const txs = [{ amount: 100.50 }, { amount: 200.25 }];
    expect(sumTransactions(txs)).toBeCloseTo(300.75, 4);
  });
});

// ── calcPortfolioStats projection equivalence ─────────────────────────────────
//
// Verifies that the internal refactor to use Transaction adapters does not
// change the numeric results of calcPortfolioStats. These values are compared
// against independently computed expected values.

describe('calcPortfolioStats — projection equivalence after Transaction refactor', () => {
  const holdings = [
    { units: 10, avgCost: 100, currentPrice: 120, category: 'Shares' },
    { units: 5,  avgCost: 200, currentPrice: 180, category: 'ETF'    },
  ];
  const contributions = [
    { id: 'c1', portfolioId: 'p1', amount: 500,  type: 'Regular', date: '2026-01-01' },
    { id: 'c2', portfolioId: 'p1', amount: 300,  type: 'Regular', date: '2026-02-01' },
  ];
  const dividends = [
    { id: 'd1', portfolioId: 'p1', grossAmount: 120, taxAmount: 39.6, netAmount: 80.4, date: '2026-01-15' },
    { id: 'd2', portfolioId: 'p1', grossAmount:  50, taxAmount: 16.5, netAmount: 33.5, date: '2026-02-20' },
  ];

  const stats = calcPortfolioStats(holdings, contributions, dividends);

  it('totalValue = 10*120 + 5*180 = 2100', () => {
    expect(stats.totalValue).toBeCloseTo(2100, 4);
  });

  it('totalCost = 10*100 + 5*200 = 2000', () => {
    expect(stats.totalCost).toBeCloseTo(2000, 4);
  });

  it('totalContrib = 500 + 300 = 800 (via Transaction adapters)', () => {
    expect(stats.totalContrib).toBeCloseTo(800, 4);
  });

  it('totalDivNet = 80.4 + 33.5 = 113.9 (netAmount via Transaction adapters)', () => {
    expect(stats.totalDivNet).toBeCloseTo(113.9, 4);
  });

  it('unrealised = totalValue − totalCost = 100', () => {
    expect(stats.unrealised).toBeCloseTo(100, 4);
  });

  it('returnPct = 100 / 2000 * 100 = 5%', () => {
    expect(stats.returnPct).toBeCloseTo(5, 4);
  });

  it('still handles string-typed amounts (backwards compatibility with raw records)', () => {
    const strContribs = [{ id: 'c1', portfolioId: 'p1', amount: '750', type: 'Regular', date: '2026-01-01' }];
    const strDivs     = [{ id: 'd1', portfolioId: 'p1', grossAmount: '100', taxAmount: '33', netAmount: '67', date: '2026-01-15' }];
    const s = calcPortfolioStats([], strContribs, strDivs);
    expect(s.totalContrib).toBeCloseTo(750, 4);
    expect(s.totalDivNet).toBeCloseTo(67, 4);
  });

  it('returns zero totals when contributions and dividends are empty', () => {
    const s = calcPortfolioStats(holdings, [], []);
    expect(s.totalContrib).toBe(0);
    expect(s.totalDivNet).toBe(0);
  });

  it('returns zero totals when contributions and dividends are null', () => {
    const s = calcPortfolioStats(holdings, null, null);
    expect(s.totalContrib).toBe(0);
    expect(s.totalDivNet).toBe(0);
  });

  it('allocation pcts still sum to 1', () => {
    const total = stats.allocation.reduce((s, a) => s + a.pct, 0);
    expect(total).toBeCloseTo(1, 4);
  });
});

// ── filterByYearMonth ─────────────────────────────────────────────────────────

describe('filterByYearMonth', () => {
  const txs = [
    { id: 't1', date: '2026-02-10', amount: 100 },
    { id: 't2', date: '2026-03-01', amount: 200 },
    { id: 't3', date: '2026-03-31', amount:  50 },
    { id: 't4', date: '2026-04-01', amount:  80 },
    { id: 't5', date: null,         amount:  60 },
  ];

  it('returns only transactions from the specified YYYY-MM month', () => {
    const result = filterByYearMonth(txs, '2026-03');
    expect(result).toHaveLength(2);
    expect(result.map(t => t.id)).toEqual(['t2', 't3']);
  });

  it('excludes adjacent months', () => {
    const result = filterByYearMonth(txs, '2026-03');
    expect(result.find(t => t.id === 't1')).toBeUndefined();
    expect(result.find(t => t.id === 't4')).toBeUndefined();
  });

  it('excludes null-date transactions', () => {
    const result = filterByYearMonth(txs, '2026-03');
    expect(result.find(t => t.id === 't5')).toBeUndefined();
  });

  it('returns empty array for no matches', () => {
    expect(filterByYearMonth(txs, '2025-01')).toEqual([]);
  });

  it('returns empty array for null/empty input', () => {
    expect(filterByYearMonth(null, '2026-03')).toEqual([]);
    expect(filterByYearMonth([],   '2026-03')).toEqual([]);
  });
});

// ── sumField ──────────────────────────────────────────────────────────────────

describe('sumField', () => {
  const dividendTxs = [
    { amount: 67, grossAmount: 100, taxAmount: 33 },
    { amount: 33.5, grossAmount:  50, taxAmount: 16.5 },
  ];

  it('sums a named field across the array', () => {
    expect(sumField(dividendTxs, 'grossAmount')).toBeCloseTo(150, 4);
    expect(sumField(dividendTxs, 'taxAmount')).toBeCloseTo(49.5, 4);
  });

  it('returns 0 for an empty array', () => {
    expect(sumField([], 'grossAmount')).toBe(0);
    expect(sumField(null, 'grossAmount')).toBe(0);
  });

  it('treats absent or non-numeric fields as 0', () => {
    const mixed = [
      { grossAmount: 100 },
      { grossAmount: undefined },
      { grossAmount: null },
      { grossAmount: '' },
      {},
    ];
    expect(sumField(mixed, 'grossAmount')).toBeCloseTo(100, 4);
  });

  it('coerces string values to numbers', () => {
    const stringTxs = [{ grossAmount: '80' }, { grossAmount: '120' }];
    expect(sumField(stringTxs, 'grossAmount')).toBeCloseTo(200, 4);
  });

  it('handles decimal amounts without floating-point overflow', () => {
    const txs = [{ taxAmount: 39.6 }, { taxAmount: 16.5 }];
    expect(sumField(txs, 'taxAmount')).toBeCloseTo(56.1, 4);
  });
});

// ── groupSumByCategory ────────────────────────────────────────────────────────

describe('groupSumByCategory', () => {
  it('groups amounts by category', () => {
    const txs = [
      { category: 'Regular',  amount: 500 },
      { category: 'Regular',  amount: 200 },
      { category: 'Lump Sum', amount: 1000 },
    ];
    const result = groupSumByCategory(txs);
    expect(result['Regular']).toBeCloseTo(700, 4);
    expect(result['Lump Sum']).toBeCloseTo(1000, 4);
  });

  it('groups null/undefined category under "Other"', () => {
    const txs = [
      { category: null,      amount: 100 },
      { category: undefined, amount: 200 },
      { category: '',        amount:  50 },
    ];
    const result = groupSumByCategory(txs);
    expect(result['Other']).toBeCloseTo(350, 4);
    expect(Object.keys(result)).toEqual(['Other']);
  });

  it('returns empty object for empty array', () => {
    expect(groupSumByCategory([])).toEqual({});
    expect(groupSumByCategory(null)).toEqual({});
  });

  it('handles single category', () => {
    const txs = [{ category: 'KiwiSaver', amount: 300 }];
    expect(groupSumByCategory(txs)).toEqual({ KiwiSaver: 300 });
  });

  it('returns correct keys for multiple distinct categories', () => {
    const txs = [
      { category: 'A', amount: 1 },
      { category: 'B', amount: 2 },
      { category: 'C', amount: 3 },
    ];
    expect(Object.keys(groupSumByCategory(txs)).sort()).toEqual(['A', 'B', 'C']);
  });
});
