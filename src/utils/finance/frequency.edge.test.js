import { describe, it, expect } from 'vitest';
import { toFortnightly, annualInterestToFortnightly } from './frequency';

// ── toFortnightly — negative values ──────────────────────────────────────────

describe('toFortnightly — negative amounts', () => {
  it('negative weekly amount doubles correctly', () => {
    expect(toFortnightly(-500, 'weekly')).toBe(-1000);
  });

  it('negative monthly amount converts correctly', () => {
    expect(toFortnightly(-1000, 'monthly')).toBeCloseTo(-1000 * 12 / 26, 6);
  });

  it('negative annual amount converts correctly', () => {
    expect(toFortnightly(-52000, 'annual')).toBeCloseTo(-2000, 6);
  });

  it('negative quarterly amount converts correctly', () => {
    expect(toFortnightly(-2600, 'quarterly')).toBeCloseTo(-2600 * 4 / 26, 6);
  });

  it('negative fortnightly amount passes through', () => {
    expect(toFortnightly(-750, 'fortnightly')).toBe(-750);
  });
});

// ── toFortnightly — decimal precision ────────────────────────────────────────

describe('toFortnightly — decimal precision', () => {
  it('preserves cents for weekly conversion', () => {
    expect(toFortnightly(99.99, 'weekly')).toBeCloseTo(199.98, 4);
  });

  it('monthly conversion with cents', () => {
    expect(toFortnightly(199.95, 'monthly')).toBeCloseTo(199.95 * 12 / 26, 4);
  });

  it('very small amount ($0.01) weekly', () => {
    expect(toFortnightly(0.01, 'weekly')).toBeCloseTo(0.02, 6);
  });

  it('very large amount converts correctly', () => {
    expect(toFortnightly(1_000_000, 'annual')).toBeCloseTo(1_000_000 / 26, 4);
  });
});

// ── toFortnightly — round-trip consistency ───────────────────────────────────

describe('toFortnightly — round-trip consistency', () => {
  it('converting to fortnightly then back to annual preserves value', () => {
    const annual = 78_000;
    const fn = toFortnightly(annual, 'annual');
    const backToAnnual = fn * 26;
    expect(backToAnnual).toBeCloseTo(annual, 4);
  });

  it('converting to fortnightly then back to monthly preserves value', () => {
    const monthly = 3000;
    const fn = toFortnightly(monthly, 'monthly');
    const backToMonthly = fn * 26 / 12;
    expect(backToMonthly).toBeCloseTo(monthly, 4);
  });

  it('converting to fortnightly then back to weekly preserves value', () => {
    const weekly = 1500;
    const fn = toFortnightly(weekly, 'weekly');
    const backToWeekly = fn / 2;
    expect(backToWeekly).toBeCloseTo(weekly, 4);
  });
});

// ── annualInterestToFortnightly — edge cases ─────────────────────────────────

describe('annualInterestToFortnightly — edge cases', () => {
  it('negative balance returns negative interest', () => {
    // Negative balance isn't realistic but should be handled mathematically
    expect(annualInterestToFortnightly(-100_000, 5)).toBeCloseTo(-100_000 * 0.05 / 26, 4);
  });

  it('negative rate returns negative interest', () => {
    expect(annualInterestToFortnightly(100_000, -2)).toBeCloseTo(100_000 * -0.02 / 26, 4);
  });

  it('very high rate (100%)', () => {
    expect(annualInterestToFortnightly(100_000, 100)).toBeCloseTo(100_000 / 26, 4);
  });

  it('string inputs are coerced', () => {
    expect(annualInterestToFortnightly('500000', '6')).toBeCloseTo(500_000 * 0.06 / 26, 4);
  });

  it('NaN inputs return 0', () => {
    expect(annualInterestToFortnightly('abc', 5)).toBe(0);
    expect(annualInterestToFortnightly(100_000, 'xyz')).toBe(0);
  });
});
