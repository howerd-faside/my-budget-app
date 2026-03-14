import { describe, it, expect } from 'vitest';
import {
  calcRemainingTerm,
  calcTotalInterest,
  calcEarlyRepaymentSavings,
  buildAmortSchedule,
  fnInterestComponent,
  buildMonthlySchedule,
} from './mortgage';

// ── Effective fortnightly rate helper (test-only) ────────────────────────────

function effectiveFnRate(annualRatePct) {
  return Math.pow(1 + annualRatePct / 100, 1 / 26) - 1;
}

// ── calcRemainingTerm — numerical precision ──────────────────────────────────

describe('calcRemainingTerm — numerical precision', () => {
  it('years and months decompose correctly for a ~30-year loan', () => {
    // $500k at 6.5%, payment set to roughly 30-year amortisation
    const r = effectiveFnRate(6.5);
    // Standard annuity: P = B * r / (1 - (1+r)^(-n))
    const n = 30 * 26; // 780 fortnights
    const payment = 500_000 * r / (1 - Math.pow(1 + r, -n));
    const term = calcRemainingTerm(500_000, 6.5, payment);

    expect(term).not.toBeNull();
    // Math.ceil may add 1 fortnight due to floating-point rounding
    expect(term.fortnights).toBeGreaterThanOrEqual(780);
    expect(term.fortnights).toBeLessThanOrEqual(781);
    expect(term.years).toBe(30);
    expect(term.months).toBeLessThanOrEqual(1);
  });

  it('years and months decompose for a ~15-year loan', () => {
    const r = effectiveFnRate(5.0);
    const n = 15 * 26;
    const payment = 300_000 * r / (1 - Math.pow(1 + r, -n));
    const term = calcRemainingTerm(300_000, 5.0, payment);

    expect(term).not.toBeNull();
    expect(term.years).toBe(15);
    expect(term.months).toBe(0);
  });

  it('small balance with large payment finishes quickly', () => {
    const term = calcRemainingTerm(1000, 6, 500);
    expect(term).not.toBeNull();
    expect(term.fortnights).toBeLessThanOrEqual(3);
  });

  it('very large balance at minimum viable payment has very long term', () => {
    const r = effectiveFnRate(7);
    const minInterest = 2_000_000 * r;
    const term = calcRemainingTerm(2_000_000, 7, minInterest + 100);
    expect(term).not.toBeNull();
    expect(term.years).toBeGreaterThan(50);
  });
});

// ── calcTotalInterest — precision cross-checks ──────────────────────────────

describe('calcTotalInterest — precision', () => {
  it('total interest for a known 30-year loan matches manual calculation', () => {
    const r = effectiveFnRate(6);
    const n = 30 * 26;
    const payment = 400_000 * r / (1 - Math.pow(1 + r, -n));
    const totalInterest = calcTotalInterest(400_000, 6, payment);

    // payment * n - balance = total interest
    const expected = payment * n - 400_000;
    expect(totalInterest).toBeCloseTo(expected, -1); // within $10
  });

  it('total interest increases with rate (fixed payment)', () => {
    const rates = [4, 5, 6, 7, 8];
    let prevInterest = 0;
    for (const rate of rates) {
      const interest = calcTotalInterest(300_000, rate, 1500);
      if (prevInterest > 0) {
        expect(interest).toBeGreaterThan(prevInterest);
      }
      prevInterest = interest;
    }
  });

  it('low interest rate (1%) produces much less total interest than high (10%)', () => {
    const low = calcTotalInterest(200_000, 1, 1000);
    const high = calcTotalInterest(200_000, 10, 1000);
    expect(high).toBeGreaterThan(low * 3); // at least 3x more interest
  });
});

// ── calcEarlyRepaymentSavings — precision ────────────────────────────────────

describe('calcEarlyRepaymentSavings — precision', () => {
  it('saved interest + new total interest ≈ original total interest', () => {
    const origInterest = calcTotalInterest(400_000, 6, 1800);
    const result = calcEarlyRepaymentSavings(400_000, 6, 1800, 200);
    expect(result.savedInterest + result.newTotalInterest).toBeCloseTo(origInterest, -1);
  });

  it('savedMonths is proportional to savedFortnights', () => {
    const result = calcEarlyRepaymentSavings(400_000, 6, 1800, 300);
    const expectedMonths = Math.round(result.savedFortnights / 26 * 12);
    expect(result.savedMonths).toBe(expectedMonths);
  });

  it('negative extra payment treated as 0', () => {
    const result = calcEarlyRepaymentSavings(400_000, 6, 1800, -200);
    expect(result.savedInterest).toBe(0);
    expect(result.savedFortnights).toBe(0);
  });

  it('very large extra payment (doubling) saves significantly', () => {
    const result = calcEarlyRepaymentSavings(400_000, 6, 1800, 1800);
    expect(result.savedInterest).toBeGreaterThan(50_000);
    expect(result.savedFortnights).toBeGreaterThan(100);
  });
});

// ── buildAmortSchedule — invariants ──────────────────────────────────────────

describe('buildAmortSchedule — invariants', () => {
  it('annualInterest + annualPrincipal ≈ 26 payments per year', () => {
    const schedule = buildAmortSchedule(300_000, 6, 1400);
    // For year 1 (idx 1): annualInterest + annualPrincipal ≈ 26 * 1400
    // (slightly less if loan ends mid-year)
    const yr1 = schedule[1];
    expect(yr1.annualInterest + yr1.annualPrincipal).toBeCloseTo(26 * 1400, -2);
  });

  it('cumulativeInterest + cumulativePrincipal grow consistently', () => {
    const schedule = buildAmortSchedule(300_000, 6, 1400);
    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i].cumulativeInterest).toBeGreaterThanOrEqual(schedule[i - 1].cumulativeInterest);
      expect(schedule[i].cumulativePrincipal).toBeGreaterThanOrEqual(schedule[i - 1].cumulativePrincipal);
    }
  });

  it('schedule terminates with balance approaching zero', () => {
    // buildAmortSchedule samples annually, so the last point may have a partial-year
    // remaining balance that is non-trivial
    const schedule = buildAmortSchedule(100_000, 6, 800);
    const last = schedule[schedule.length - 1];
    // Last sampled point should be significantly less than the original balance
    expect(last.balance).toBeLessThan(100_000 * 0.2);
  });

  it('final cumulativeInterest is in the same order of magnitude as calcTotalInterest', () => {
    const balance = 300_000;
    const rate = 6;
    const payment = 1400;
    const schedule = buildAmortSchedule(balance, rate, payment);
    const totalInterest = calcTotalInterest(balance, rate, payment);
    const last = schedule[schedule.length - 1];
    // buildAmortSchedule samples annually and rounds to integers;
    // calcTotalInterest uses ceil'd fortnights — expect within 2%
    const diff = Math.abs(last.cumulativeInterest - totalInterest);
    expect(diff / totalInterest).toBeLessThan(0.02);
  });

  it('interest-only scenario (payment barely covers interest) breaks early', () => {
    const r = effectiveFnRate(6);
    const interestOnly = 500_000 * r; // exactly covers interest
    const schedule = buildAmortSchedule(500_000, 6, interestOnly);
    // Principal ≤ 0, so loop breaks immediately
    expect(schedule.length).toBeLessThanOrEqual(1);
  });

  it('maxPeriods cap is respected', () => {
    const schedule = buildAmortSchedule(500_000, 6, 500, 52); // very small payment, capped at 52 periods
    // Should not run more than 52 fortnights (which is 2 years at most)
    expect(schedule.length).toBeLessThanOrEqual(3); // year 0 + up to 2 annual snapshots
  });
});

// ── buildMonthlySchedule — invariants ────────────────────────────────────────

describe('buildMonthlySchedule — invariants', () => {
  it('interest + principal ≈ monthly payment for each period', () => {
    const fnPayment = 1400;
    const monthlyPayment = fnPayment * 26 / 12;
    const schedule = buildMonthlySchedule(300_000, 6, fnPayment);

    for (const pt of schedule) {
      // Rounded values: interest + principal should be close to monthlyPayment
      // (last month may be partial)
      if (pt.month < schedule.length) {
        expect(pt.interest + pt.principal).toBeCloseTo(monthlyPayment, -1);
      }
    }
  });

  it('label field marks the first month of each year', () => {
    const schedule = buildMonthlySchedule(300_000, 6, 1400);
    const labeled = schedule.filter(pt => pt.label !== '');
    // First labeled month should be month 1
    expect(labeled[0].month).toBe(1);
    // Labeled months occur every 12 months
    for (let i = 1; i < labeled.length; i++) {
      expect(labeled[i].month - labeled[i - 1].month).toBe(12);
    }
  });

  it('final cumulative interest is in the same ballpark as annual schedule', () => {
    const balance = 200_000;
    const rate = 5.5;
    const payment = 1200;
    const monthly = buildMonthlySchedule(balance, rate, payment);
    const annual = buildAmortSchedule(balance, rate, payment);

    const monthlyTotal = monthly[monthly.length - 1].cumulativeInterest;
    const annualTotal = annual[annual.length - 1].cumulativeInterest;

    // They use slightly different rate formulas but should be within 5%
    const diff = Math.abs(monthlyTotal - annualTotal);
    expect(diff / annualTotal).toBeLessThan(0.05);
  });
});

// ── fnInterestComponent — precision ──────────────────────────────────────────

describe('fnInterestComponent — precision', () => {
  it('matches effective fortnightly rate formula exactly', () => {
    const balance = 450_000;
    const rate = 6.5;
    const expected = balance * effectiveFnRate(rate);
    expect(fnInterestComponent(balance, rate)).toBeCloseTo(expected, 8);
  });

  it('is always less than simple interest (balance * rate / 26)', () => {
    // Compound rate per fortnight < simple rate per fortnight for NZ annual compounding
    const balance = 500_000;
    const rate = 6;
    const compound = fnInterestComponent(balance, rate);
    const simple = balance * rate / 100 / 26;
    expect(compound).toBeLessThan(simple);
  });

  it('handles very low rate (0.5%)', () => {
    const result = fnInterestComponent(500_000, 0.5);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(500_000 * 0.005 / 26 + 1);
  });

  it('handles very high rate (15%)', () => {
    const result = fnInterestComponent(100_000, 15);
    expect(result).toBeGreaterThan(0);
    // Still bounded by simple interest
    expect(result).toBeLessThan(100_000 * 0.15 / 26 + 10);
  });
});
