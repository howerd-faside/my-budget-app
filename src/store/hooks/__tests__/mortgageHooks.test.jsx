// @vitest-environment jsdom
/**
 * Unit tests for the three derived mortgage hooks.
 *
 * Stores are seeded directly via setState; no component rendering required.
 * Tests verify computed values and structural guarantees — not implementation
 * details of the underlying mortgage.js helpers (those are tested separately).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { usePeopleStore } from '../../peopleStore';

import { useMortgageFacilities }   from '../useMortgageFacilities';
import { useMortgageSummary }      from '../useMortgageSummary';
import { useMortgageAmortisation } from '../useMortgageAmortisation';

// ── helpers ───────────────────────────────────────────────────────────────────

function seedExpenses(expenses) {
  usePeopleStore.setState({ people: [], expenses, wishlist: [] });
}

/** Creates a minimal loan-type expense with the given facilities array. */
function makeLoan({ id = 'loan1', name = 'Home Loan', lender = 'ANZ', facilities = [] } = {}) {
  return { id, name, lender, amount: 0, frequency: 'fortnightly', type: 'loan', facilities };
}

/** Creates a qualifying facility with sensible defaults. */
function makeFacility({
  id          = 'f1',
  label       = 'Fixed',
  balance     = 400000,
  rate        = 6.5,
  amount      = 1200,
  frequency   = 'fortnightly',
  rateType    = 'fixed',
  repaymentType = 'P&I',
} = {}) {
  return { id, label, balance, rate, amount, frequency, rateType, repaymentType };
}

// ── setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  seedExpenses([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── useMortgageFacilities ─────────────────────────────────────────────────────

describe('useMortgageFacilities', () => {
  it('hasLoans=false with no expenses', () => {
    const { result } = renderHook(() => useMortgageFacilities());
    expect(result.current.hasLoans).toBe(false);
    expect(result.current.facilities).toHaveLength(0);
    expect(result.current.loanExpenses).toHaveLength(0);
  });

  it('ignores standard-type expenses', () => {
    seedExpenses([{ id: 'e1', type: 'standard', amount: 500, frequency: 'fortnightly' }]);
    const { result } = renderHook(() => useMortgageFacilities());
    expect(result.current.hasLoans).toBe(false);
  });

  it('excludes facilities with balance=0', () => {
    seedExpenses([makeLoan({ facilities: [makeFacility({ balance: 0 })] })]);
    const { result } = renderHook(() => useMortgageFacilities());
    expect(result.current.hasLoans).toBe(false);
  });

  it('excludes facilities with rate=0', () => {
    seedExpenses([makeLoan({ facilities: [makeFacility({ rate: 0 })] })]);
    const { result } = renderHook(() => useMortgageFacilities());
    expect(result.current.hasLoans).toBe(false);
  });

  it('excludes facilities with amount=0', () => {
    seedExpenses([makeLoan({ facilities: [makeFacility({ amount: 0 })] })]);
    const { result } = renderHook(() => useMortgageFacilities());
    expect(result.current.hasLoans).toBe(false);
  });

  it('includes a fully qualifying facility', () => {
    seedExpenses([makeLoan({ facilities: [makeFacility()] })]);
    const { result } = renderHook(() => useMortgageFacilities());
    expect(result.current.hasLoans).toBe(true);
    expect(result.current.facilities).toHaveLength(1);
  });

  it('augments facility with loanId, loanName, loanLender', () => {
    seedExpenses([makeLoan({ id: 'loan1', name: 'Home Loan', lender: 'ANZ', facilities: [makeFacility({ id: 'f1' })] })]);
    const { result } = renderHook(() => useMortgageFacilities());
    const f = result.current.facilities[0];
    expect(f.loanId).toBe('loan1');
    expect(f.loanName).toBe('Home Loan');
    expect(f.loanLender).toBe('ANZ');
  });

  it('normalises monthly amount to fortnightly via amountFn', () => {
    // monthly 2600 → fortnightly = 2600 * 12 / 26 = 1200
    seedExpenses([makeLoan({ facilities: [makeFacility({ amount: 2600, frequency: 'monthly' })] })]);
    const { result } = renderHook(() => useMortgageFacilities());
    expect(result.current.facilities[0].amountFn).toBeCloseTo(2600 * 12 / 26, 2);
  });

  it('leaves fortnightly amount unchanged in amountFn', () => {
    seedExpenses([makeLoan({ facilities: [makeFacility({ amount: 1200, frequency: 'fortnightly' })] })]);
    const { result } = renderHook(() => useMortgageFacilities());
    expect(result.current.facilities[0].amountFn).toBe(1200);
  });

  it('returns facilities from multiple loans', () => {
    seedExpenses([
      makeLoan({ id: 'loan1', facilities: [makeFacility({ id: 'f1' })] }),
      makeLoan({ id: 'loan2', facilities: [makeFacility({ id: 'f2', balance: 100000, rate: 5.5, amount: 500 })] }),
    ]);
    const { result } = renderHook(() => useMortgageFacilities());
    expect(result.current.facilities).toHaveLength(2);
    expect(result.current.loanExpenses).toHaveLength(2);
  });

  it('returns multiple facilities within a single loan', () => {
    seedExpenses([makeLoan({ facilities: [
      makeFacility({ id: 'f1', balance: 300000, rate: 6.5, amount: 900, rateType: 'fixed' }),
      makeFacility({ id: 'f2', balance: 100000, rate: 7.0, amount: 350, rateType: 'floating' }),
    ] })]);
    const { result } = renderHook(() => useMortgageFacilities());
    expect(result.current.facilities).toHaveLength(2);
  });

  it('handles revolving rateType without error', () => {
    seedExpenses([makeLoan({ facilities: [makeFacility({ rateType: 'revolving', balance: 50000, rate: 7.5, amount: 500 })] })]);
    const { result } = renderHook(() => useMortgageFacilities());
    expect(result.current.hasLoans).toBe(true);
    expect(result.current.facilities[0].rateType).toBe('revolving');
  });
});

// ── useMortgageSummary ────────────────────────────────────────────────────────

describe('useMortgageSummary', () => {
  it('returns zeros and nulls with no loans', () => {
    const { result } = renderHook(() => useMortgageSummary());
    expect(result.current.hasLoans).toBe(false);
    expect(result.current.totalBalance).toBe(0);
    expect(result.current.repaymentFn).toBe(0);
    expect(result.current.totalInterest).toBe(0);
    expect(result.current.intPct).toBe(0);
    expect(result.current.payoffYear).toBeNull();
    expect(result.current.crossoverYear).toBeNull();
  });

  it('totalBalance sums balances across facilities', () => {
    seedExpenses([makeLoan({ facilities: [
      makeFacility({ id: 'f1', balance: 300000, rate: 6.5, amount: 900, rateType: 'fixed' }),
      makeFacility({ id: 'f2', balance: 100000, rate: 7.0, amount: 350, rateType: 'floating' }),
    ] })]);
    const { result } = renderHook(() => useMortgageSummary());
    expect(result.current.totalBalance).toBeCloseTo(400000, 0);
  });

  it('repaymentFn sums amountFn (normalised) across facilities', () => {
    seedExpenses([makeLoan({ facilities: [
      makeFacility({ id: 'f1', balance: 300000, rate: 6.5, amount: 900 }),
      makeFacility({ id: 'f2', balance: 100000, rate: 7.0, amount: 350 }),
    ] })]);
    const { result } = renderHook(() => useMortgageSummary());
    expect(result.current.repaymentFn).toBeCloseTo(1250, 1);
  });

  it('repaymentFn uses toFortnightly normalisation for monthly facilities', () => {
    // monthly 2600 → fortnightly ≈ 1200
    seedExpenses([makeLoan({ facilities: [makeFacility({ amount: 2600, frequency: 'monthly' })] })]);
    const { result } = renderHook(() => useMortgageSummary());
    expect(result.current.repaymentFn).toBeCloseTo(1200, 1);
  });

  it('totalInterest > 0 for a qualifying facility', () => {
    seedExpenses([makeLoan({ facilities: [makeFacility()] })]);
    const { result } = renderHook(() => useMortgageSummary());
    expect(result.current.totalInterest).toBeGreaterThan(0);
  });

  it('intPct is between 1 and 100 for a normal loan', () => {
    seedExpenses([makeLoan({ facilities: [makeFacility()] })]);
    const { result } = renderHook(() => useMortgageSummary());
    expect(result.current.intPct).toBeGreaterThan(0);
    expect(result.current.intPct).toBeLessThanOrEqual(100);
  });

  it('payoffYear is a future calendar year', () => {
    seedExpenses([makeLoan({ facilities: [makeFacility()] })]);
    const { result } = renderHook(() => useMortgageSummary());
    expect(result.current.payoffYear).toBeGreaterThan(new Date().getFullYear());
  });

  it('payoffYear reflects the longest-term facility', () => {
    // f1: 400k at 6.5%, $1200/fn — long term
    // f2:  50k at 5.5%, $2000/fn — clears quickly
    seedExpenses([makeLoan({ facilities: [
      makeFacility({ id: 'f1', balance: 400000, rate: 6.5, amount: 1200, rateType: 'fixed' }),
      makeFacility({ id: 'f2', balance: 50000,  rate: 5.5, amount: 2000, rateType: 'floating' }),
    ] })]);
    const { result } = renderHook(() => useMortgageSummary());
    // payoffYear driven by f1 — should be well past 5 years from now
    expect(result.current.payoffYear).toBeGreaterThan(new Date().getFullYear() + 5);
  });

  it('crossoverYear is a future calendar year when it exists', () => {
    seedExpenses([makeLoan({ facilities: [makeFacility({ balance: 400000, rate: 6.5, amount: 1200 })] })]);
    const { result } = renderHook(() => useMortgageSummary());
    if (result.current.crossoverYear !== null) {
      expect(result.current.crossoverYear).toBeGreaterThan(new Date().getFullYear());
    }
  });

  it('crossoverYear is derived from amortisation piData — same year as first row where principal > interest', () => {
    seedExpenses([makeLoan({ facilities: [makeFacility()] })]);

    const { result: facResult } = renderHook(() => useMortgageAmortisation());
    const { result: sumResult } = renderHook(() => useMortgageSummary());

    const piCrossover = facResult.current.piData.find(d => d.principal > d.interest);
    if (piCrossover) {
      expect(sumResult.current.crossoverYear).toBe(new Date().getFullYear() + piCrossover.year);
    } else {
      expect(sumResult.current.crossoverYear).toBeNull();
    }
  });
});

// ── useMortgageAmortisation ───────────────────────────────────────────────────

describe('useMortgageAmortisation', () => {
  it('returns empty datasets with no facilities', () => {
    const { result } = renderHook(() => useMortgageAmortisation());
    expect(result.current.hasData).toBe(false);
    expect(result.current.balanceData).toHaveLength(0);
    expect(result.current.piData).toHaveLength(0);
    expect(result.current.facilities).toHaveLength(0);
  });

  it('hasData=true with a qualifying facility', () => {
    seedExpenses([makeLoan({ facilities: [makeFacility()] })]);
    const { result } = renderHook(() => useMortgageAmortisation());
    expect(result.current.hasData).toBe(true);
  });

  it('balanceData year-0 entry holds the starting balance', () => {
    seedExpenses([makeLoan({ facilities: [makeFacility({ balance: 400000 })] })]);
    const { result } = renderHook(() => useMortgageAmortisation());
    expect(result.current.balanceData[0].year).toBe(0);
    expect(result.current.balanceData[0].f0).toBeCloseTo(400000, 0);
    expect(result.current.balanceData[0].total).toBeCloseTo(400000, 0);
  });

  it('balance declines to near zero by the last balanceData entry', () => {
    seedExpenses([makeLoan({ facilities: [makeFacility()] })]);
    const { result } = renderHook(() => useMortgageAmortisation());
    const last = result.current.balanceData.at(-1);
    expect(last.total).toBeLessThan(20000); // schedule runs to near-zero (annual boundary may leave residual)
  });

  it('piData excludes year 0', () => {
    seedExpenses([makeLoan({ facilities: [makeFacility()] })]);
    const { result } = renderHook(() => useMortgageAmortisation());
    expect(result.current.piData.every(d => d.year > 0)).toBe(true);
  });

  it('piData year-1 entry has positive interest and principal', () => {
    seedExpenses([makeLoan({ facilities: [makeFacility()] })]);
    const { result } = renderHook(() => useMortgageAmortisation());
    const first = result.current.piData[0];
    expect(first.interest).toBeGreaterThan(0);
    expect(first.principal).toBeGreaterThan(0);
  });

  it('interest is higher than principal in year 1 for a long-term loan', () => {
    // On a 400k/6.5% loan, early payments are mostly interest
    seedExpenses([makeLoan({ facilities: [makeFacility({ balance: 400000, rate: 6.5, amount: 1200 })] })]);
    const { result } = renderHook(() => useMortgageAmortisation());
    const first = result.current.piData[0];
    expect(first.interest).toBeGreaterThan(first.principal);
  });

  it('balanceData has f0 and f1 keys for two facilities', () => {
    seedExpenses([makeLoan({ facilities: [
      makeFacility({ id: 'f1', balance: 300000, rate: 6.5, amount: 900,  rateType: 'fixed' }),
      makeFacility({ id: 'f2', balance: 100000, rate: 7.0, amount: 350,  rateType: 'floating' }),
    ] })]);
    const { result } = renderHook(() => useMortgageAmortisation());
    const row0 = result.current.balanceData[0];
    expect(row0).toHaveProperty('f0');
    expect(row0).toHaveProperty('f1');
    expect(row0).toHaveProperty('total');
  });

  it('total equals sum of all fi values at every year', () => {
    seedExpenses([makeLoan({ facilities: [
      makeFacility({ id: 'f1', balance: 300000, rate: 6.5, amount: 900,  rateType: 'fixed' }),
      makeFacility({ id: 'f2', balance: 100000, rate: 7.0, amount: 350,  rateType: 'floating' }),
    ] })]);
    const { result } = renderHook(() => useMortgageAmortisation());
    result.current.balanceData.forEach(row => {
      expect(row.total).toBeCloseTo((row.f0 || 0) + (row.f1 || 0), 0);
    });
  });

  it('shorter-term facility contributes 0 after it clears', () => {
    // f2: $2000/fn on $50k — clears in roughly a year; f1 runs much longer
    seedExpenses([makeLoan({ facilities: [
      makeFacility({ id: 'f1', balance: 400000, rate: 6.5, amount: 1200, rateType: 'fixed' }),
      makeFacility({ id: 'f2', balance: 50000,  rate: 5.5, amount: 2000, rateType: 'floating' }),
    ] })]);
    const { result } = renderHook(() => useMortgageAmortisation());
    const { balanceData, facilities } = result.current;

    const f2idx = facilities.findIndex(f => f.id === 'f2');
    // Find a row after f2 clears: f2 balance = 0 but f1 still positive
    const afterClear = balanceData.find(row => row[`f${f2idx}`] === 0 && row.f0 > 0);
    expect(afterClear).toBeDefined();
  });

  it('mixed rateTypes produce data for all three facilities', () => {
    seedExpenses([makeLoan({ facilities: [
      makeFacility({ id: 'f1', balance: 200000, rate: 6.5, amount: 800,  rateType: 'fixed' }),
      makeFacility({ id: 'f2', balance: 100000, rate: 7.0, amount: 350,  rateType: 'floating' }),
      makeFacility({ id: 'f3', balance: 50000,  rate: 7.5, amount: 250,  rateType: 'revolving' }),
    ] })]);
    const { result } = renderHook(() => useMortgageAmortisation());
    expect(result.current.hasData).toBe(true);
    const row0 = result.current.balanceData[0];
    expect(row0).toHaveProperty('f0');
    expect(row0).toHaveProperty('f1');
    expect(row0).toHaveProperty('f2');
    expect(row0.total).toBeCloseTo(350000, 0);
  });

  it('facilities with different end-dates do not corrupt total after the shorter one clears', () => {
    seedExpenses([makeLoan({ facilities: [
      makeFacility({ id: 'f1', balance: 400000, rate: 6.5, amount: 1200, rateType: 'fixed' }),
      makeFacility({ id: 'f2', balance: 50000,  rate: 5.5, amount: 2000, rateType: 'floating' }),
    ] })]);
    const { result } = renderHook(() => useMortgageAmortisation());
    // After f2 clears, total should equal f0 (not include stale f1 value)
    result.current.balanceData.forEach(row => {
      expect(row.total).toBeGreaterThanOrEqual(0);
      expect(row.total).toBeCloseTo((row.f0 || 0) + (row.f1 || 0), 0);
    });
  });
});
