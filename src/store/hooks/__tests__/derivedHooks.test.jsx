// @vitest-environment jsdom
/**
 * Unit tests for derived Overview hooks.
 *
 * Each hook is tested via renderHook with stores seeded directly via setState.
 * All tests verify computed values match expected maths — not implementation
 * details of the underlying helpers.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useFinanceStore }    from '../../financeStore';
import { usePeopleStore }     from '../../peopleStore';
import { useInvestmentStore } from '../../investmentStore';

import { useHouseholdSnapshot }   from '../useHouseholdSnapshot';
import { useMoneyFlow }           from '../useMoneyFlow';
import { useCashflowTrend }       from '../useCashflowTrend';
import { useObligationsSnapshot } from '../useObligationsSnapshot';
import { useSavingsPosition }     from '../useSavingsPosition';

// ── helpers ───────────────────────────────────────────────────────────────────

/** Seed stores to a minimal known state, then override slices as needed */
function seedStores({ people = [], expenses = [], accounts = [], assetIncomes = [], investmentContributions = [] } = {}) {
  usePeopleStore.setState({ people, expenses, wishlist: [] });
  useFinanceStore.setState({
    accounts,
    assetIncomes,
    fortnightlyData: {},
    goals: [],
    transfers: [],
    settings: { currentBalance: 0 },
  });
  useInvestmentStore.setState({
    investmentPortfolios: [],
    selectedPortfolioId: null,
    investments: [],
    investmentContributions,
    investmentDividends: [],
  });
}

function makePerson(grossAnnual = 104000) {
  return {
    id: 'p1',
    name: 'Alice',
    taxCode: 'M',
    kiwiSaverRate: 0.03,
    payFrequency: 'fortnightly',
    grossAnnual,
    secondaryIncomes: [],
    incomeEvents: [],
  };
}

// ── setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  seedStores();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── useHouseholdSnapshot ──────────────────────────────────────────────────────

describe('useHouseholdSnapshot', () => {
  it('returns zeros when no people or expenses configured', () => {
    const { result } = renderHook(() => useHouseholdSnapshot());
    expect(result.current.netIncome).toBe(0);
    expect(result.current.totalSpend).toBe(0);
    expect(result.current.netCashflow).toBe(0);
    expect(result.current.savingsRate).toBe(0);
  });

  it('savingsRate is 0 when netIncome is 0 (no division by zero)', () => {
    seedStores({ expenses: [{ id: 'e1', name: 'Rent', amount: 500, frequency: 'fortnightly', type: 'standard' }] });
    const { result } = renderHook(() => useHouseholdSnapshot());
    expect(result.current.savingsRate).toBe(0);
  });

  it('netCashflow = netIncome − totalSpend', () => {
    const person = makePerson(104000); // yields some fortnightly net income
    const expense = { id: 'e1', name: 'Rent', amount: 500, frequency: 'fortnightly', type: 'standard' };
    seedStores({ people: [person], expenses: [expense] });

    const { result } = renderHook(() => useHouseholdSnapshot());
    const { netIncome, totalSpend, netCashflow } = result.current;

    expect(netIncome).toBeGreaterThan(0);
    expect(totalSpend).toBeGreaterThan(0);
    expect(netCashflow).toBeCloseTo(netIncome - totalSpend, 5);
  });

  it('savingsRate = netCashflow / netIncome', () => {
    const person = makePerson(104000);
    const expense = { id: 'e1', name: 'Rent', amount: 500, frequency: 'fortnightly', type: 'standard' };
    seedStores({ people: [person], expenses: [expense] });

    const { result } = renderHook(() => useHouseholdSnapshot());
    const { netIncome, netCashflow, savingsRate } = result.current;

    expect(savingsRate).toBeCloseTo(netCashflow / netIncome, 5);
  });

  it('loan-type expenses do not inflate totalSpend (loan amount=0 at top level)', () => {
    const person = makePerson(104000);
    const loanExpense = {
      id: 'loan1', name: 'Home Loan', amount: 0, frequency: 'fortnightly', type: 'loan',
      facilities: [{ id: 'f1', balance: 400000, rate: 6.5, amount: 1200, frequency: 'fortnightly' }],
    };
    seedStores({ people: [person], expenses: [loanExpense] });

    const { result } = renderHook(() => useHouseholdSnapshot());
    // totalSpend should be 0 (no standard expenses), not 1200
    expect(result.current.totalSpend).toBe(0);
  });
});

// ── useMoneyFlow ──────────────────────────────────────────────────────────────

describe('useMoneyFlow', () => {
  it('all buckets are 0 with empty stores', () => {
    const { result } = renderHook(() => useMoneyFlow());
    expect(result.current.netIncome).toBe(0);
    expect(result.current.mortgage).toBe(0);
    expect(result.current.livingCosts).toBe(0);
    expect(result.current.investments).toBe(0);
    expect(result.current.savings).toBe(0);
  });

  it('mortgage sourced from loan facilities, not standard expenses', () => {
    const person = makePerson(104000);
    const loanExpense = {
      id: 'loan1', name: 'Home Loan', amount: 0, frequency: 'fortnightly', type: 'loan',
      facilities: [{ id: 'f1', balance: 400000, rate: 6.5, amount: 1200, frequency: 'fortnightly' }],
    };
    seedStores({ people: [person], expenses: [loanExpense] });

    const { result } = renderHook(() => useMoneyFlow());
    expect(result.current.mortgage).toBeCloseTo(1200, 2);
    expect(result.current.livingCosts).toBe(0);
  });

  it('livingCosts sourced from standard-type expenses only', () => {
    const person = makePerson(104000);
    const standardExpense = { id: 'e1', name: 'Groceries', amount: 300, frequency: 'fortnightly', type: 'standard' };
    seedStores({ people: [person], expenses: [standardExpense] });

    const { result } = renderHook(() => useMoneyFlow());
    expect(result.current.livingCosts).toBeCloseTo(300, 2);
    expect(result.current.mortgage).toBe(0);
  });

  it('savings = netIncome − mortgage − livingCosts − investments', () => {
    const person = makePerson(104000);
    const standardExpense = { id: 'e1', name: 'Groceries', amount: 300, frequency: 'fortnightly', type: 'standard' };
    seedStores({ people: [person], expenses: [standardExpense] });

    const { result } = renderHook(() => useMoneyFlow());
    const { netIncome, mortgage, livingCosts, investments, savings } = result.current;
    expect(savings).toBeCloseTo(netIncome - mortgage - livingCosts - investments, 4);
  });
});

// ── useCashflowTrend ──────────────────────────────────────────────────────────

describe('useCashflowTrend', () => {
  it('returns 26 fortnightly points with hasData=false when no income or expenses', () => {
    const { result } = renderHook(() => useCashflowTrend());
    expect(result.current.points).toHaveLength(26);
    expect(result.current.hasData).toBe(false);
  });

  it('all cashflow values are 0 when no income or expenses', () => {
    const { result } = renderHook(() => useCashflowTrend());
    result.current.points.forEach(p => {
      expect(p.cashflow).toBe(0);
    });
  });

  it('hasData=true when income is configured', () => {
    const person = makePerson(104000);
    seedStores({ people: [person] });

    const { result } = renderHook(() => useCashflowTrend());
    expect(result.current.hasData).toBe(true);
  });

  it('each point has date in YYYY-MM-DD format', () => {
    const { result } = renderHook(() => useCashflowTrend());
    result.current.points.forEach(p => {
      expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('points are in chronological order', () => {
    const { result } = renderHook(() => useCashflowTrend());
    const dates = result.current.points.map(p => p.date);
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
  });

  it('last point is within the current fortnight', () => {
    const { result } = renderHook(() => useCashflowTrend());
    const now = new Date();
    const lastDateStr = result.current.points[result.current.points.length - 1].date;
    // Parse as local time (the hook formats dates using local date components)
    const [y, m, d] = lastDateStr.split('-').map(Number);
    const lastDate = new Date(y, m - 1, d);
    const diffDays = (now - lastDate) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(0);
    expect(diffDays).toBeLessThan(14);
  });
});

// ── useObligationsSnapshot ────────────────────────────────────────────────────

describe('useObligationsSnapshot', () => {
  it('hasLoans=false with no expenses', () => {
    const { result } = renderHook(() => useObligationsSnapshot());
    expect(result.current.hasLoans).toBe(false);
    expect(result.current.totalBalance).toBe(0);
    expect(result.current.repaymentFn).toBe(0);
    expect(result.current.totalInterest).toBe(0);
    expect(result.current.payoffYear).toBeNull();
  });

  it('excludes facilities with balance=0', () => {
    const loanExpense = {
      id: 'loan1', type: 'loan',
      facilities: [{ id: 'f1', balance: 0, rate: 6.5, amount: 1200, frequency: 'fortnightly' }],
    };
    seedStores({ expenses: [loanExpense] });

    const { result } = renderHook(() => useObligationsSnapshot());
    expect(result.current.hasLoans).toBe(false);
  });

  it('includes zero-rate (interest-free) facilities in total obligations', () => {
    const loanExpense = {
      id: 'loan1', type: 'loan',
      facilities: [{ id: 'f1', balance: 400000, rate: 0, amount: 1200, frequency: 'fortnightly' }],
    };
    seedStores({ expenses: [loanExpense] });

    const { result } = renderHook(() => useObligationsSnapshot());
    expect(result.current.hasLoans).toBe(true);
    expect(result.current.totalBalance).toBe(400000);
    expect(result.current.totalInterest).toBe(0);
  });

  it('totalBalance sums all facility balances', () => {
    const loanExpense = {
      id: 'loan1', type: 'loan',
      facilities: [
        { id: 'f1', balance: 400000, rate: 6.5, amount: 1200, frequency: 'fortnightly' },
        { id: 'f2', balance: 100000, rate: 5.5, amount: 600, frequency: 'fortnightly' },
      ],
    };
    seedStores({ expenses: [loanExpense] });

    const { result } = renderHook(() => useObligationsSnapshot());
    expect(result.current.hasLoans).toBe(true);
    expect(result.current.totalBalance).toBeCloseTo(500000, 0);
  });

  it('repaymentFn normalises non-fortnightly facilities', () => {
    const loanExpense = {
      id: 'loan1', type: 'loan',
      facilities: [{ id: 'f1', balance: 400000, rate: 6.5, amount: 2400, frequency: 'monthly' }],
    };
    seedStores({ expenses: [loanExpense] });

    const { result } = renderHook(() => useObligationsSnapshot());
    // monthly 2400 → fortnightly = 2400 * 12 / 26 ≈ 1107.69
    expect(result.current.repaymentFn).toBeCloseTo(2400 * 12 / 26, 1);
  });

  it('payoffYear is a plausible future year', () => {
    const loanExpense = {
      id: 'loan1', type: 'loan',
      facilities: [{ id: 'f1', balance: 400000, rate: 6.5, amount: 1200, frequency: 'fortnightly' }],
    };
    seedStores({ expenses: [loanExpense] });

    const { result } = renderHook(() => useObligationsSnapshot());
    const currentYear = new Date().getFullYear();
    expect(result.current.payoffYear).toBeGreaterThan(currentYear);
  });
});

// ── useSavingsPosition ────────────────────────────────────────────────────────

describe('useSavingsPosition', () => {
  it('currentBalance = 0 with no accounts', () => {
    const { result } = renderHook(() => useSavingsPosition());
    expect(result.current.currentBalance).toBe(0);
  });

  it('currentBalance reflects seeded account balances', () => {
    seedStores({
      accounts: [
        { id: 'main',      name: 'Savings',   balance: 10000 },
        { id: 'emergency', name: 'Emergency', balance: 5000 },
        { id: 'travel',    name: 'Travel',    balance: 2000 },
      ],
    });

    const { result } = renderHook(() => useSavingsPosition());
    expect(result.current.currentBalance).toBeCloseTo(17000, 0);
  });

  it('sparkline is an array of { month, balance } objects', () => {
    seedStores({ accounts: [{ id: 'main', name: 'Savings', balance: 10000 }] });

    const { result } = renderHook(() => useSavingsPosition());
    result.current.sparkline.forEach(p => {
      expect(p).toHaveProperty('month');
      expect(p).toHaveProperty('balance');
      expect(p.month).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  it('sparkline has at most 12 points', () => {
    seedStores({
      people: [makePerson(104000)],
      accounts: [{ id: 'main', name: 'Savings', balance: 10000 }],
    });

    const { result } = renderHook(() => useSavingsPosition());
    expect(result.current.sparkline.length).toBeLessThanOrEqual(12);
  });

  it('yearEndBalance equals currentBalance when no income or expenses', () => {
    seedStores({ accounts: [{ id: 'main', name: 'Savings', balance: 5000 }] });

    const { result } = renderHook(() => useSavingsPosition());
    // With no income/expenses, trajectory is flat — yearEnd = current
    expect(result.current.yearEndBalance).toBeCloseTo(5000, 0);
  });

  it('fortnightlyCashflow > 0 with positive income and no expenses', () => {
    seedStores({
      people: [makePerson(104000)],
      accounts: [{ id: 'main', name: 'Savings', balance: 10000 }],
    });

    const { result } = renderHook(() => useSavingsPosition());
    expect(result.current.fortnightlyCashflow).toBeGreaterThan(0);
  });
});
