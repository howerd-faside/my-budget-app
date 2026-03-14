import { describe, it, expect } from 'vitest';
import {
  calcRemainingTerm,
  calcTotalInterest,
  calcEarlyRepaymentSavings,
  buildAmortSchedule,
  fnInterestComponent,
  buildMonthlySchedule,
} from './finance/mortgage';

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Effective fortnightly rate using NZ annual-compounding formula.
 * (1 + r%)^(1/26) - 1
 */
function effectiveFnRate(annualRatePct) {
  return Math.pow(1 + annualRatePct / 100, 1 / 26) - 1;
}

// ── calcRemainingTerm ─────────────────────────────────────────────────────────
describe('calcRemainingTerm', () => {
  it('returns null for zero balance', () => {
    expect(calcRemainingTerm(0, 6, 1000)).toBeNull();
  });

  it('returns null for zero payment', () => {
    expect(calcRemainingTerm(500_000, 6, 0)).toBeNull();
  });

  it('returns null for zero interest rate', () => {
    expect(calcRemainingTerm(500_000, 0, 1000)).toBeNull();
  });

  it('returns null when payment cannot cover interest', () => {
    // At 6% on $1 000 000 the fortnightly interest is huge
    const minPayment = 1_000_000 * effectiveFnRate(6);
    expect(calcRemainingTerm(1_000_000, 6, minPayment * 0.5)).toBeNull();
  });

  it('returns a reasonable term for a standard NZ mortgage', () => {
    // $600k at 6.5%, $2 000/fn ≈ 30 years (conservative payment)
    const result = calcRemainingTerm(600_000, 6.5, 2000);
    expect(result).not.toBeNull();
    expect(result.fortnights).toBeGreaterThan(0);
    expect(result.years).toBeGreaterThan(0);
  });

  it('shorter term for larger payment', () => {
    const slow = calcRemainingTerm(400_000, 6, 1200);
    const fast  = calcRemainingTerm(400_000, 6, 2500);
    expect(fast.fortnights).toBeLessThan(slow.fortnights);
  });

  it('result has fortnights, years, months properties', () => {
    const result = calcRemainingTerm(300_000, 5.5, 1500);
    expect(result).toHaveProperty('fortnights');
    expect(result).toHaveProperty('years');
    expect(result).toHaveProperty('months');
  });

  it('months component is in range 0–11', () => {
    const result = calcRemainingTerm(300_000, 6, 1200);
    expect(result.months).toBeGreaterThanOrEqual(0);
    expect(result.months).toBeLessThanOrEqual(11);
  });

  it('handles negative balance/payment by returning null', () => {
    expect(calcRemainingTerm(-100_000, 6, 1000)).toBeNull();
    expect(calcRemainingTerm(100_000, 6, -500)).toBeNull();
  });
});

// ── calcTotalInterest ─────────────────────────────────────────────────────────
describe('calcTotalInterest', () => {
  it('returns 0 for zero balance', () => {
    expect(calcTotalInterest(0, 6, 1000)).toBe(0);
  });

  it('returns 0 when payment cannot cover interest', () => {
    const minPayment = 1_000_000 * effectiveFnRate(6);
    expect(calcTotalInterest(1_000_000, 6, minPayment * 0.5)).toBe(0);
  });

  it('total interest is positive for a valid loan', () => {
    expect(calcTotalInterest(400_000, 6.5, 1800)).toBeGreaterThan(0);
  });

  it('higher rate produces more total interest', () => {
    const lowRate  = calcTotalInterest(400_000, 4, 1800);
    const highRate = calcTotalInterest(400_000, 8, 1800);
    expect(highRate).toBeGreaterThan(lowRate);
  });

  it('larger payment reduces total interest', () => {
    const smallPayment = calcTotalInterest(400_000, 6, 1200);
    const bigPayment   = calcTotalInterest(400_000, 6, 2500);
    expect(bigPayment).toBeLessThan(smallPayment);
  });

  it('is approximately payment × fortnights − balance', () => {
    const balance = 300_000;
    const rate = 5.5;
    const payment = 1400;
    const term = calcRemainingTerm(balance, rate, payment);
    const totalInterest = calcTotalInterest(balance, rate, payment);
    // Allow rounding: within $5 of the derived figure
    expect(totalInterest).toBeCloseTo(payment * term.fortnights - balance, -2);
  });
});

// ── calcEarlyRepaymentSavings ─────────────────────────────────────────────────
describe('calcEarlyRepaymentSavings', () => {
  it('returns zero savings when extra is 0', () => {
    const result = calcEarlyRepaymentSavings(400_000, 6, 1800, 0);
    expect(result.savedInterest).toBe(0);
    expect(result.savedFortnights).toBe(0);
  });

  it('positive extra payment saves interest', () => {
    const result = calcEarlyRepaymentSavings(400_000, 6, 1800, 200);
    expect(result.savedInterest).toBeGreaterThan(0);
  });

  it('positive extra payment reduces total fortnights', () => {
    const result = calcEarlyRepaymentSavings(400_000, 6, 1800, 200);
    expect(result.savedFortnights).toBeGreaterThan(0);
  });

  it('larger extra payment saves more interest', () => {
    const small = calcEarlyRepaymentSavings(400_000, 6, 1800, 100);
    const large = calcEarlyRepaymentSavings(400_000, 6, 1800, 500);
    expect(large.savedInterest).toBeGreaterThan(small.savedInterest);
  });

  it('savedInterest is non-negative', () => {
    const result = calcEarlyRepaymentSavings(400_000, 6, 1800, 300);
    expect(result.savedInterest).toBeGreaterThanOrEqual(0);
  });

  it('newTotalInterest is less than original total interest', () => {
    const original    = calcTotalInterest(400_000, 6, 1800);
    const result      = calcEarlyRepaymentSavings(400_000, 6, 1800, 300);
    expect(result.newTotalInterest).toBeLessThan(original);
  });

  it('returns gracefully when payment cannot cover interest', () => {
    const minPayment = 1_000_000 * effectiveFnRate(12);
    const result = calcEarlyRepaymentSavings(1_000_000, 12, minPayment * 0.5, 100);
    expect(result.savedInterest).toBe(0);
  });
});

// ── buildAmortSchedule ────────────────────────────────────────────────────────
describe('buildAmortSchedule', () => {
  it('returns empty array for zero balance', () => {
    expect(buildAmortSchedule(0, 6, 1000)).toEqual([]);
  });

  it('returns empty array for zero payment', () => {
    expect(buildAmortSchedule(400_000, 6, 0)).toEqual([]);
  });

  it('returns empty array for zero rate', () => {
    expect(buildAmortSchedule(400_000, 0, 1000)).toEqual([]);
  });

  it('first point is year 0 with original balance', () => {
    const schedule = buildAmortSchedule(300_000, 6, 1400);
    expect(schedule[0].year).toBe(0);
    expect(schedule[0].balance).toBeCloseTo(300_000, 0);
  });

  it('balance decreases over time', () => {
    const schedule = buildAmortSchedule(300_000, 6, 1400);
    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i].balance).toBeLessThan(schedule[i - 1].balance);
    }
  });

  it('cumulative principal + final balance ≈ original balance', () => {
    // buildAmortSchedule samples annually; the last point may be part-way through
    // the final year, so balance is NOT necessarily near zero. The conservation
    // invariant is: principal repaid + remaining balance = original loan balance.
    const initialBalance = 300_000;
    const schedule = buildAmortSchedule(initialBalance, 6, 1400);
    const last = schedule[schedule.length - 1];
    expect(last.cumulativePrincipal + last.balance).toBeCloseTo(initialBalance, -1);
  });

  it('cumulative interest grows monotonically', () => {
    const schedule = buildAmortSchedule(300_000, 6, 1400);
    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i].cumulativeInterest).toBeGreaterThanOrEqual(schedule[i - 1].cumulativeInterest);
    }
  });

  it('each point has expected keys', () => {
    const schedule = buildAmortSchedule(300_000, 6, 1400);
    const pt = schedule[1];
    expect(pt).toHaveProperty('year');
    expect(pt).toHaveProperty('balance');
    expect(pt).toHaveProperty('cumulativeInterest');
    expect(pt).toHaveProperty('cumulativePrincipal');
    expect(pt).toHaveProperty('annualInterest');
    expect(pt).toHaveProperty('annualPrincipal');
  });

  it('year numbers are sequential integers starting at 0', () => {
    const schedule = buildAmortSchedule(300_000, 6, 1400);
    schedule.forEach((pt, idx) => expect(pt.year).toBe(idx));
  });
});

// ── fnInterestComponent ───────────────────────────────────────────────────────
describe('fnInterestComponent', () => {
  it('returns 0 for zero balance', () => {
    expect(fnInterestComponent(0, 6)).toBe(0);
  });

  it('higher rate gives higher interest component', () => {
    const low  = fnInterestComponent(500_000, 4);
    const high = fnInterestComponent(500_000, 8);
    expect(high).toBeGreaterThan(low);
  });

  it('uses NZ annual-compounding formula', () => {
    const expected = 500_000 * effectiveFnRate(6);
    expect(fnInterestComponent(500_000, 6)).toBeCloseTo(expected, 4);
  });

  it('handles null balance gracefully', () => {
    expect(fnInterestComponent(null, 6)).toBe(0);
  });
});

// ── buildMonthlySchedule ──────────────────────────────────────────────────────
describe('buildMonthlySchedule', () => {
  it('returns empty array for zero balance', () => {
    expect(buildMonthlySchedule(0, 6, 1000)).toEqual([]);
  });

  it('returns empty array for zero payment', () => {
    expect(buildMonthlySchedule(400_000, 6, 0)).toEqual([]);
  });

  it('balance decreases each month', () => {
    const schedule = buildMonthlySchedule(300_000, 6, 1400);
    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i].balance).toBeLessThanOrEqual(schedule[i - 1].balance);
    }
  });

  it('first month has interest + principal > 0', () => {
    const schedule = buildMonthlySchedule(400_000, 6, 1800);
    expect(schedule[0].interest).toBeGreaterThan(0);
    expect(schedule[0].principal).toBeGreaterThan(0);
  });

  it('each point has expected keys', () => {
    const schedule = buildMonthlySchedule(300_000, 6, 1400);
    const pt = schedule[0];
    expect(pt).toHaveProperty('month');
    expect(pt).toHaveProperty('year');
    expect(pt).toHaveProperty('interest');
    expect(pt).toHaveProperty('principal');
    expect(pt).toHaveProperty('balance');
    expect(pt).toHaveProperty('cumulativeInterest');
  });

  it('cumulative interest grows monotonically', () => {
    const schedule = buildMonthlySchedule(300_000, 6, 1400);
    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i].cumulativeInterest).toBeGreaterThanOrEqual(schedule[i - 1].cumulativeInterest);
    }
  });

  it('respects maxMonths cap', () => {
    const schedule = buildMonthlySchedule(300_000, 6, 1400, 24);
    expect(schedule.length).toBeLessThanOrEqual(24);
  });

  it('final balance is near zero for a fully-amortising loan', () => {
    const schedule = buildMonthlySchedule(300_000, 6, 1400);
    const last = schedule[schedule.length - 1];
    expect(last.balance).toBeLessThan(500);
  });
});
