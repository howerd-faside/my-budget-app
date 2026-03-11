/**
 * Tests for pure derived-helper functions exported from src/store.jsx.
 *
 * These helpers are pure functions (no Zustand hooks, no localStorage access)
 * and can be called directly in a Node test environment.
 *
 * Covers:
 *   totalBalance              — sums account balances
 *   calcFortnightlyIncome     — net fortnightly income for all people (current gross)
 *   calcFortnightlyIncomeAt   — date-aware net income (income events + employment history)
 *   calcFortnightlyExpenses   — sum of all expenses normalised to fortnightly
 *   calcFortnightlyExpensesAt — date-aware expense sum (startDate / endDate filtering)
 *   calcFortnightlyAssetIncome — asset income normalised to fortnightly
 *   getPersonIncomeAt         — priority: income events > employment history > grossAnnual
 *
 * Note: importing store.jsx causes the Zustand stores to initialise. In the Node
 * environment localStorage is undefined; the budgetStorage adapter catches that
 * error and returns null, so the stores initialise with their defaults. A console
 * spy suppresses the resulting noise.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  totalBalance,
  calcFortnightlyIncome,
  calcFortnightlyIncomeAt,
  calcFortnightlyExpenses,
  calcFortnightlyExpensesAt,
  calcFortnightlyAssetIncome,
  getPersonIncomeAt,
} from '../../store.jsx';

// Suppress persist-middleware noise (localStorage unavailable in node)
let consoleSpy;
beforeAll(() => {
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterAll(() => {
  consoleSpy.mockRestore();
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// totalBalance
// ─────────────────────────────────────────────────────────────────────────────

describe('totalBalance', () => {
  it('sums all account balances', () => {
    const accounts = [
      { id: 'main',      balance: 1000 },
      { id: 'emergency', balance: 500  },
      { id: 'travel',    balance: 200  },
    ];
    expect(totalBalance(accounts)).toBe(1700);
  });

  it('returns 0 for an empty array', () => {
    expect(totalBalance([])).toBe(0);
  });

  it('returns 0 for null/undefined input', () => {
    expect(totalBalance(null)).toBe(0);
    expect(totalBalance(undefined)).toBe(0);
  });

  it('treats missing balance as 0', () => {
    const accounts = [{ id: 'x' }, { id: 'y', balance: 300 }];
    expect(totalBalance(accounts)).toBe(300);
  });

  it('handles a single account', () => {
    expect(totalBalance([{ id: 'main', balance: 4200 }])).toBe(4200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calcFortnightlyIncome
// ─────────────────────────────────────────────────────────────────────────────

describe('calcFortnightlyIncome', () => {
  it('returns 0 for an empty people array', () => {
    expect(calcFortnightlyIncome([])).toBe(0);
  });

  it('returns 0 for null/undefined input', () => {
    expect(calcFortnightlyIncome(null)).toBe(0);
    expect(calcFortnightlyIncome(undefined)).toBe(0);
  });

  it('returns a positive value for a person with a positive gross income', () => {
    const people = [{ grossAnnual: 80000, taxCode: 'M', kiwiSaverRate: 3 }];
    expect(calcFortnightlyIncome(people)).toBeGreaterThan(0);
  });

  it('is less than grossAnnual / 26 due to tax and KiwiSaver deductions', () => {
    const gross = 80000;
    const people = [{ grossAnnual: gross, taxCode: 'M', kiwiSaverRate: 3 }];
    expect(calcFortnightlyIncome(people)).toBeLessThan(gross / 26);
  });

  it('sums contributions from multiple people', () => {
    const one  = [{ grossAnnual: 60000, taxCode: 'M', kiwiSaverRate: 3 }];
    const two  = [{ grossAnnual: 80000, taxCode: 'M', kiwiSaverRate: 3 }];
    const both = [...one, ...two];
    const summed = calcFortnightlyIncome(both);
    expect(summed).toBeGreaterThan(calcFortnightlyIncome(one));
    expect(summed).toBeCloseTo(
      calcFortnightlyIncome(one) + calcFortnightlyIncome(two),
      4,
    );
  });

  it('includes secondary income (net) in the fortnightly total', () => {
    const withoutSec = [{ grossAnnual: 70000, taxCode: 'M', kiwiSaverRate: 3, secondaryIncomes: [] }];
    const withSec    = [{
      grossAnnual: 70000, taxCode: 'M', kiwiSaverRate: 3,
      secondaryIncomes: [{ amount: 500, frequency: 'monthly' }],
    }];
    expect(calcFortnightlyIncome(withSec)).toBeGreaterThan(calcFortnightlyIncome(withoutSec));
  });

  it('handles zero gross income correctly', () => {
    const people = [{ grossAnnual: 0, taxCode: 'M', kiwiSaverRate: 0 }];
    expect(calcFortnightlyIncome(people)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getPersonIncomeAt — priority order for date-aware income lookup
// ─────────────────────────────────────────────────────────────────────────────

describe('getPersonIncomeAt', () => {
  const BASE_DATE = '2026-06-01';

  const basePerson = {
    grossAnnual:       80000,
    taxCode:           'M',
    kiwiSaverRate:     3,
    incomeEvents:      [],
    employmentHistory: [],
  };

  it('returns grossAnnual when no events or employment history exist', () => {
    const result = getPersonIncomeAt(basePerson, BASE_DATE);
    expect(result.grossAnnual).toBe(80000);
    expect(result.eventLabel).toBeNull();
  });

  it('returns the active income event gross when an event covers the date', () => {
    const person = {
      ...basePerson,
      incomeEvents: [{
        id: 'ev1', label: 'Maternity Leave',
        startDate: '2026-01-01', endDate: '2026-12-31',
        grossAnnual: 30000,
      }],
    };
    const result = getPersonIncomeAt(person, BASE_DATE);
    expect(result.grossAnnual).toBe(30000);
    expect(result.eventLabel).toBe('Maternity Leave');
  });

  it('ignores an income event whose endDate is before the query date', () => {
    const person = {
      ...basePerson,
      incomeEvents: [{
        id: 'ev1', label: 'Past Event',
        startDate: '2025-01-01', endDate: '2025-12-31',
        grossAnnual: 20000,
      }],
    };
    const result = getPersonIncomeAt(person, BASE_DATE);
    expect(result.grossAnnual).toBe(80000); // falls back to grossAnnual
    expect(result.eventLabel).toBeNull();
  });

  it('ignores an income event whose startDate is after the query date', () => {
    const person = {
      ...basePerson,
      incomeEvents: [{
        id: 'ev1', label: 'Future Event',
        startDate: '2027-01-01', endDate: '',
        grossAnnual: 50000,
      }],
    };
    const result = getPersonIncomeAt(person, BASE_DATE);
    expect(result.grossAnnual).toBe(80000);
  });

  it('treats an empty endDate as ongoing (no end)', () => {
    const person = {
      ...basePerson,
      incomeEvents: [{
        id: 'ev1', label: 'Ongoing Override',
        startDate: '2026-01-01', endDate: '',
        grossAnnual: 45000,
      }],
    };
    const result = getPersonIncomeAt(person, BASE_DATE);
    expect(result.grossAnnual).toBe(45000);
  });

  it('returns the active employment role gross when no income event covers the date', () => {
    const person = {
      ...basePerson,
      employmentHistory: [{
        id: 'r1', employer: 'ACME', role: 'Engineer',
        startDate: '2024-01-01', endDate: '',
        grossAnnual: 95000,
      }],
    };
    const result = getPersonIncomeAt(person, BASE_DATE);
    expect(result.grossAnnual).toBe(95000);
    expect(result.eventLabel).toBeNull();
    expect(result.employer).toBe('ACME');
  });

  it('income event takes priority over employment history when both are active', () => {
    const person = {
      ...basePerson,
      incomeEvents: [{
        id: 'ev1', label: 'Leave',
        startDate: '2026-01-01', endDate: '',
        grossAnnual: 30000,
      }],
      employmentHistory: [{
        id: 'r1', employer: 'Bigco', role: 'Dev',
        startDate: '2024-01-01', endDate: '',
        grossAnnual: 110000,
      }],
    };
    const result = getPersonIncomeAt(person, BASE_DATE);
    expect(result.grossAnnual).toBe(30000);
    expect(result.eventLabel).toBe('Leave');
  });

  it('returns 0 when employment history exists but date is before the earliest start', () => {
    const person = {
      ...basePerson,
      employmentHistory: [{
        id: 'r1', employer: 'Co', role: 'Dev',
        startDate: '2027-01-01', endDate: '',
        grossAnnual: 100000,
      }],
    };
    // Query date 2026-06-01 is before earliest role start 2027-01-01
    const result = getPersonIncomeAt(person, BASE_DATE);
    expect(result.grossAnnual).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calcFortnightlyIncomeAt
// ─────────────────────────────────────────────────────────────────────────────

describe('calcFortnightlyIncomeAt', () => {
  it('returns 0 for an empty array', () => {
    expect(calcFortnightlyIncomeAt([], '2026-01-01')).toBe(0);
  });

  it('uses income events when the date falls within one', () => {
    const people = [{
      grossAnnual: 80000, taxCode: 'M', kiwiSaverRate: 3,
      secondaryIncomes: [],
      incomeEvents: [{
        id: 'ev1', label: 'Parental Leave',
        startDate: '2026-01-01', endDate: '2026-12-31',
        grossAnnual: 30000,
      }],
      employmentHistory: [],
    }];
    const during = calcFortnightlyIncomeAt(people, '2026-06-01');
    const outside = calcFortnightlyIncomeAt(people, '2025-06-01');
    expect(during).toBeLessThan(outside); // lower income during leave
  });

  it('sums income across multiple people at the same date', () => {
    const alice = {
      grossAnnual: 60000, taxCode: 'M', kiwiSaverRate: 3,
      secondaryIncomes: [], incomeEvents: [], employmentHistory: [],
    };
    const bob = {
      grossAnnual: 80000, taxCode: 'M', kiwiSaverRate: 3,
      secondaryIncomes: [], incomeEvents: [], employmentHistory: [],
    };
    const combined = calcFortnightlyIncomeAt([alice, bob], '2026-01-01');
    const aliceOnly = calcFortnightlyIncomeAt([alice], '2026-01-01');
    expect(combined).toBeGreaterThan(aliceOnly);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calcFortnightlyExpenses
// ─────────────────────────────────────────────────────────────────────────────

describe('calcFortnightlyExpenses', () => {
  it('returns 0 for an empty array', () => {
    expect(calcFortnightlyExpenses([])).toBe(0);
  });

  it('converts monthly expenses to fortnightly correctly', () => {
    const expenses = [{ amount: 1300, frequency: 'monthly' }];
    expect(calcFortnightlyExpenses(expenses)).toBeCloseTo(1300 * 12 / 26, 4);
  });

  it('sums expenses across multiple frequencies', () => {
    const expenses = [
      { amount: 500,  frequency: 'fortnightly' },
      { amount: 1000, frequency: 'monthly' },
    ];
    const result = calcFortnightlyExpenses(expenses);
    expect(result).toBeCloseTo(500 + 1000 * 12 / 26, 4);
  });

  it('returns 0 for null/undefined input', () => {
    expect(calcFortnightlyExpenses(null)).toBe(0);
    expect(calcFortnightlyExpenses(undefined)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calcFortnightlyExpensesAt — date-aware with startDate / endDate
// ─────────────────────────────────────────────────────────────────────────────

describe('calcFortnightlyExpensesAt', () => {
  const QUERY_DATE = '2026-06-01';

  it('includes an expense with no startDate or endDate', () => {
    const expenses = [{ amount: 500, frequency: 'fortnightly', startDate: '', endDate: '' }];
    expect(calcFortnightlyExpensesAt(expenses, QUERY_DATE)).toBeCloseTo(500, 4);
  });

  it('includes an expense whose startDate is before the query date', () => {
    const expenses = [{ amount: 500, frequency: 'fortnightly', startDate: '2026-01-01', endDate: '' }];
    expect(calcFortnightlyExpensesAt(expenses, QUERY_DATE)).toBeCloseTo(500, 4);
  });

  it('excludes an expense whose startDate is after the query date', () => {
    const expenses = [{ amount: 500, frequency: 'fortnightly', startDate: '2027-01-01', endDate: '' }];
    expect(calcFortnightlyExpensesAt(expenses, QUERY_DATE)).toBe(0);
  });

  it('excludes an expense whose endDate is before the query date', () => {
    const expenses = [{ amount: 500, frequency: 'fortnightly', startDate: '2025-01-01', endDate: '2026-01-01' }];
    expect(calcFortnightlyExpensesAt(expenses, QUERY_DATE)).toBe(0);
  });

  it('includes an expense whose endDate is after the query date', () => {
    const expenses = [{ amount: 500, frequency: 'fortnightly', startDate: '2025-01-01', endDate: '2027-01-01' }];
    expect(calcFortnightlyExpensesAt(expenses, QUERY_DATE)).toBeCloseTo(500, 4);
  });

  it('sums only active expenses at the date', () => {
    const expenses = [
      { amount: 400, frequency: 'fortnightly', startDate: '2025-01-01', endDate: '' },          // active
      { amount: 200, frequency: 'fortnightly', startDate: '2027-01-01', endDate: '' },          // future — excluded
      { amount: 100, frequency: 'fortnightly', startDate: '2024-01-01', endDate: '2025-12-31' }, // past — excluded
    ];
    expect(calcFortnightlyExpensesAt(expenses, QUERY_DATE)).toBeCloseTo(400, 4);
  });

  it('accepts a Date object for the date parameter', () => {
    const expenses = [{ amount: 500, frequency: 'fortnightly', startDate: '', endDate: '' }];
    expect(calcFortnightlyExpensesAt(expenses, new Date(QUERY_DATE))).toBeCloseTo(500, 4);
  });

  it('returns 0 for an empty array', () => {
    expect(calcFortnightlyExpensesAt([], QUERY_DATE)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calcFortnightlyAssetIncome
// ─────────────────────────────────────────────────────────────────────────────

describe('calcFortnightlyAssetIncome', () => {
  it('returns 0 for an empty array', () => {
    expect(calcFortnightlyAssetIncome([])).toBe(0);
  });

  it('returns 0 for null/undefined input', () => {
    expect(calcFortnightlyAssetIncome(null)).toBe(0);
    expect(calcFortnightlyAssetIncome(undefined)).toBe(0);
  });

  it('converts monthly asset income to fortnightly', () => {
    const assetIncomes = [{ amount: 1300, frequency: 'monthly' }];
    expect(calcFortnightlyAssetIncome(assetIncomes)).toBeCloseTo(1300 * 12 / 26, 4);
  });

  it('sums multiple asset income sources', () => {
    const assetIncomes = [
      { amount: 500,  frequency: 'fortnightly' },
      { amount: 1000, frequency: 'monthly' },
    ];
    const result = calcFortnightlyAssetIncome(assetIncomes);
    expect(result).toBeCloseTo(500 + 1000 * 12 / 26, 4);
  });
});
