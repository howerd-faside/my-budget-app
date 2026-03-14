import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calcFortnightlyExpensesAt,
  calcFortnightlyIncome,
  calcFortnightlyIncomeAt,
  calcFortnightlyAssetIncome,
  totalBalance,
  getPersonIncomeAt,
  calcPortfolioStats,
  enrichHoldings,
} from './savings';

// ── calcFortnightlyExpensesAt — boundary equality ────────────────────────────

describe('calcFortnightlyExpensesAt — date boundary equality', () => {
  it('includes expense whose startDate equals the query date', () => {
    const expenses = [{ amount: 500, frequency: 'fortnightly', startDate: '2026-06-01', endDate: '' }];
    expect(calcFortnightlyExpensesAt(expenses, '2026-06-01')).toBeCloseTo(500, 4);
  });

  it('includes expense whose endDate equals the query date', () => {
    // endDate < dateStr excludes when endDate < queryDate
    // When endDate === queryDate, endDate < dateStr is false, so expense IS included
    const expenses = [{ amount: 500, frequency: 'fortnightly', startDate: '2026-01-01', endDate: '2026-06-01' }];
    expect(calcFortnightlyExpensesAt(expenses, '2026-06-01')).toBeCloseTo(500, 4);
  });

  it('excludes expense whose endDate is one day before query date', () => {
    const expenses = [{ amount: 500, frequency: 'fortnightly', startDate: '2026-01-01', endDate: '2026-05-31' }];
    expect(calcFortnightlyExpensesAt(expenses, '2026-06-01')).toBe(0);
  });

  it('excludes expense whose startDate is one day after query date', () => {
    const expenses = [{ amount: 500, frequency: 'fortnightly', startDate: '2026-06-02', endDate: '' }];
    expect(calcFortnightlyExpensesAt(expenses, '2026-06-01')).toBe(0);
  });
});

// ── totalBalance — edge cases ────────────────────────────────────────────────

describe('totalBalance — additional edge cases', () => {
  it('handles negative balances', () => {
    const accounts = [{ id: 'a', balance: 1000 }, { id: 'b', balance: -500 }];
    expect(totalBalance(accounts)).toBe(500);
  });

  it('handles all-negative balances', () => {
    const accounts = [{ id: 'a', balance: -200 }, { id: 'b', balance: -300 }];
    expect(totalBalance(accounts)).toBe(-500);
  });

  it('handles decimal balances', () => {
    const accounts = [{ id: 'a', balance: 1000.50 }, { id: 'b', balance: 2000.75 }];
    expect(totalBalance(accounts)).toBeCloseTo(3001.25, 4);
  });
});

// ── getPersonIncomeAt — additional edge cases ────────────────────────────────

describe('getPersonIncomeAt — overlapping events', () => {
  it('picks the latest-starting event when multiple overlap', () => {
    const person = {
      grossAnnual: 80000,
      incomeEvents: [
        { id: 'ev1', label: 'Event A', startDate: '2026-01-01', endDate: '2026-12-31', grossAnnual: 30000 },
        { id: 'ev2', label: 'Event B', startDate: '2026-06-01', endDate: '2026-12-31', grossAnnual: 40000 },
      ],
      employmentHistory: [],
    };
    const result = getPersonIncomeAt(person, '2026-07-01');
    expect(result.grossAnnual).toBe(40000);
    expect(result.eventLabel).toBe('Event B');
  });

  it('falls back to earlier event when later event has not started', () => {
    const person = {
      grossAnnual: 80000,
      incomeEvents: [
        { id: 'ev1', label: 'Event A', startDate: '2026-01-01', endDate: '2026-12-31', grossAnnual: 30000 },
        { id: 'ev2', label: 'Event B', startDate: '2026-08-01', endDate: '2026-12-31', grossAnnual: 40000 },
      ],
      employmentHistory: [],
    };
    const result = getPersonIncomeAt(person, '2026-05-01');
    expect(result.grossAnnual).toBe(30000);
    expect(result.eventLabel).toBe('Event A');
  });
});

// ── getPersonIncomeAt — employer field ────────────────────────────────────────

describe('getPersonIncomeAt — employer from employment history', () => {
  it('returns employer from active role when income event is active', () => {
    const person = {
      grossAnnual: 80000,
      incomeEvents: [
        { id: 'ev1', label: 'Leave', startDate: '2026-01-01', endDate: '', grossAnnual: 20000 },
      ],
      employmentHistory: [
        { id: 'r1', employer: 'BigCo', startDate: '2024-01-01', endDate: '', grossAnnual: 90000 },
      ],
    };
    const result = getPersonIncomeAt(person, '2026-06-01');
    expect(result.employer).toBe('BigCo');
    expect(result.grossAnnual).toBe(20000); // event takes priority for income
  });

  it('returns null employer when no employment history exists', () => {
    const person = {
      grossAnnual: 80000,
      incomeEvents: [],
      employmentHistory: [],
    };
    const result = getPersonIncomeAt(person, '2026-06-01');
    expect(result.employer).toBeNull(); // fallback path doesn't include employer field
  });
});

// ── calcFortnightlyIncome — multi-person with secondaries ────────────────────

describe('calcFortnightlyIncome — complex scenarios', () => {
  it('sums multiple people with different secondary incomes', () => {
    const people = [
      {
        grossAnnual: 80000, taxCode: 'M', kiwiSaverRate: 3,
        secondaryIncomes: [
          { amount: 500, frequency: 'monthly' },
          { amount: 100, frequency: 'weekly' },
        ],
      },
      {
        grossAnnual: 60000, taxCode: 'M', kiwiSaverRate: 4,
        secondaryIncomes: [{ amount: 200, frequency: 'fortnightly' }],
      },
    ];
    const result = calcFortnightlyIncome(people);
    expect(result).toBeGreaterThan(0);
    // Verify it's more than just primary incomes
    const primaryOnly = calcFortnightlyIncome(people.map(p => ({ ...p, secondaryIncomes: [] })));
    expect(result).toBeGreaterThan(primaryOnly);
  });
});

// ── calcPortfolioStats — edge cases ──────────────────────────────────────────

describe('calcPortfolioStats — additional edge cases', () => {
  it('handles holdings with zero units', () => {
    const holdings = [{ units: 0, avgCost: 100, currentPrice: 120, category: 'ETF' }];
    const stats = calcPortfolioStats(holdings, [], []);
    expect(stats.totalValue).toBe(0);
    expect(stats.totalCost).toBe(0);
    expect(stats.unrealised).toBe(0);
    expect(stats.returnPct).toBe(0);
  });

  it('handles holdings at a loss (currentPrice < avgCost)', () => {
    const holdings = [{ units: 10, avgCost: 100, currentPrice: 80, category: 'Shares' }];
    const stats = calcPortfolioStats(holdings, [], []);
    expect(stats.unrealised).toBe(-200); // 800 - 1000
    expect(stats.returnPct).toBeCloseTo(-20, 4); // -200/1000 * 100
  });

  it('allocation handles single holding (100%)', () => {
    const holdings = [{ units: 10, avgCost: 50, currentPrice: 60, category: 'Bonds' }];
    const stats = calcPortfolioStats(holdings, [], []);
    expect(stats.allocation).toHaveLength(1);
    expect(stats.allocation[0].pct).toBeCloseTo(1, 4);
    expect(stats.allocation[0].cat).toBe('Bonds');
  });

  it('allocation groups multiple holdings in same category', () => {
    const holdings = [
      { units: 10, avgCost: 50, currentPrice: 60, category: 'Shares' },
      { units: 5, avgCost: 100, currentPrice: 120, category: 'Shares' },
      { units: 20, avgCost: 10, currentPrice: 15, category: 'Bonds' },
    ];
    const stats = calcPortfolioStats(holdings, [], []);
    expect(stats.allocation).toHaveLength(2);
    const sharesCat = stats.allocation.find(a => a.cat === 'Shares');
    expect(sharesCat.val).toBe(600 + 600); // 10*60 + 5*120
  });
});

// ── enrichHoldings — additional edge cases ───────────────────────────────────

describe('enrichHoldings — missing numeric fields', () => {
  it('handles undefined units (treated as 0)', () => {
    const result = enrichHoldings([{ currentPrice: 10, avgCost: 5 }]);
    expect(result[0].value).toBe(0);
    expect(result[0].cost).toBe(0);
    expect(result[0].gl).toBe(0);
  });

  it('handles undefined currentPrice (treated as 0)', () => {
    const result = enrichHoldings([{ units: 10, avgCost: 5 }]);
    expect(result[0].value).toBe(0);
    expect(result[0].gl).toBe(-50); // 0 - 50
  });

  it('handles all fields missing', () => {
    const result = enrichHoldings([{}]);
    expect(result[0].value).toBe(0);
    expect(result[0].cost).toBe(0);
    expect(result[0].gl).toBe(0);
    expect(result[0].glPct).toBe(0);
  });
});

// ── calcFortnightlyAssetIncome — mixed frequencies ───────────────────────────

describe('calcFortnightlyAssetIncome — mixed frequencies', () => {
  it('correctly combines multiple frequencies', () => {
    const assetIncomes = [
      { amount: 1000, frequency: 'weekly' },    // 2000/fn
      { amount: 2600, frequency: 'annual' },     // 100/fn
      { amount: 390, frequency: 'quarterly' },   // 390*4/26 = 60/fn
    ];
    const result = calcFortnightlyAssetIncome(assetIncomes);
    const expected = 1000 * 2 + 2600 / 26 + 390 * 4 / 26;
    expect(result).toBeCloseTo(expected, 4);
  });
});
