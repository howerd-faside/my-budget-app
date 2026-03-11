import { describe, it, expect } from 'vitest';
import { toFortnightly, annualInterestToFortnightly } from './frequency';

describe('toFortnightly', () => {
  // ── Fortnightly (identity) ─────────────────────────────────────────────────
  describe('fortnightly frequency', () => {
    it('returns the amount unchanged', () => {
      expect(toFortnightly(1000, 'fortnightly')).toBe(1000);
    });
    it('returns 0 for zero input', () => {
      expect(toFortnightly(0, 'fortnightly')).toBe(0);
    });
  });

  // ── Weekly ─────────────────────────────────────────────────────────────────
  describe('weekly frequency', () => {
    it('doubles the amount (2 weeks per fortnight)', () => {
      expect(toFortnightly(500, 'weekly')).toBe(1000);
    });
    it('handles zero correctly', () => {
      expect(toFortnightly(0, 'weekly')).toBe(0);
    });
    it('handles large values', () => {
      expect(toFortnightly(10_000, 'weekly')).toBe(20_000);
    });
  });

  // ── Monthly ────────────────────────────────────────────────────────────────
  describe('monthly frequency', () => {
    it('converts 12 months to 26 fortnights correctly', () => {
      // $1 000/month * 12 / 26 = $461.538...
      expect(toFortnightly(1000, 'monthly')).toBeCloseTo(1000 * 12 / 26, 6);
    });
    it('returns 0 for zero amount', () => {
      expect(toFortnightly(0, 'monthly')).toBe(0);
    });
  });

  // ── Quarterly ──────────────────────────────────────────────────────────────
  describe('quarterly frequency', () => {
    it('converts 4 quarters to 26 fortnights correctly', () => {
      expect(toFortnightly(2600, 'quarterly')).toBeCloseTo(2600 * 4 / 26, 6);
    });
    it('zero input returns zero', () => {
      expect(toFortnightly(0, 'quarterly')).toBe(0);
    });
  });

  // ── Annual ─────────────────────────────────────────────────────────────────
  describe('annual frequency', () => {
    it('divides by 26', () => {
      expect(toFortnightly(52000, 'annual')).toBeCloseTo(2000, 6);
    });
    it('handles fractional result', () => {
      expect(toFortnightly(1000, 'annual')).toBeCloseTo(1000 / 26, 6);
    });
    it('zero input returns zero', () => {
      expect(toFortnightly(0, 'annual')).toBe(0);
    });
    it('large salary converts correctly', () => {
      expect(toFortnightly(130_000, 'annual')).toBeCloseTo(5000, 6);
    });
  });

  // ── Unknown / fallback ─────────────────────────────────────────────────────
  describe('unknown frequency (passthrough)', () => {
    it('returns the raw amount for an unrecognised string', () => {
      expect(toFortnightly(999, 'daily')).toBe(999);
    });
    it('returns the raw amount for empty string', () => {
      expect(toFortnightly(500, '')).toBe(500);
    });
    it('returns 0 for undefined frequency when amount is 0', () => {
      expect(toFortnightly(0, undefined)).toBe(0);
    });
  });

  // ── Edge: non-numeric amount ────────────────────────────────────────────────
  describe('non-numeric amount coercion', () => {
    it('treats null amount as 0', () => {
      expect(toFortnightly(null, 'weekly')).toBe(0);
    });
    it('treats undefined amount as 0', () => {
      expect(toFortnightly(undefined, 'weekly')).toBe(0);
    });
    it('treats empty string amount as 0', () => {
      expect(toFortnightly('', 'monthly')).toBe(0);
    });
    it('coerces numeric string', () => {
      expect(toFortnightly('500', 'weekly')).toBe(1000);
    });
  });

  // ── Consistency: all frequencies should agree on annual totals ─────────────
  describe('frequency equivalence over a year', () => {
    const ANNUAL = 52000;
    it('weekly and annual produce the same annual total', () => {
      const weekly = toFortnightly(ANNUAL / 52, 'weekly') * 26;
      const annual = toFortnightly(ANNUAL, 'annual') * 26;
      expect(weekly).toBeCloseTo(annual, 2);
    });
    it('monthly and annual produce the same annual total', () => {
      const monthly = toFortnightly(ANNUAL / 12, 'monthly') * 26;
      const annual  = toFortnightly(ANNUAL, 'annual') * 26;
      expect(monthly).toBeCloseTo(annual, 2);
    });
    it('quarterly and annual produce the same annual total', () => {
      const quarterly = toFortnightly(ANNUAL / 4, 'quarterly') * 26;
      const annual    = toFortnightly(ANNUAL, 'annual') * 26;
      expect(quarterly).toBeCloseTo(annual, 2);
    });
  });
});

// ── annualInterestToFortnightly ─────────────────────────────────────────────
describe('annualInterestToFortnightly', () => {
  it('computes simple fortnightly interest (÷ 26)', () => {
    // $500 000 at 6% = $30 000/yr / 26 = $1153.846…
    expect(annualInterestToFortnightly(500_000, 6)).toBeCloseTo(30_000 / 26, 4);
  });
  it('returns 0 for zero balance', () => {
    expect(annualInterestToFortnightly(0, 6)).toBe(0);
  });
  it('returns 0 for zero rate', () => {
    expect(annualInterestToFortnightly(500_000, 0)).toBe(0);
  });
  it('returns 0 for null inputs', () => {
    expect(annualInterestToFortnightly(null, null)).toBe(0);
  });
  it('handles large balance', () => {
    expect(annualInterestToFortnightly(1_000_000, 7)).toBeCloseTo(70_000 / 26, 4);
  });
});
