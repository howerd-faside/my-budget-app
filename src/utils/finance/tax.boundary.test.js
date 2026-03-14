import { describe, it, expect } from 'vitest';
import {
  calcIncomeTax,
  calcACC,
  calcKiwiSaver,
  calcStudentLoan,
  calcNetPay,
  fmt,
  fmtMoney,
  fmtMoneyRound,
} from './tax';

// ── calcIncomeTax — bracket boundary precision ──────────────────────────────

describe('calcIncomeTax — bracket boundaries', () => {
  // NZ 2024-25 brackets: 10.5% (0-14k), 17.5% (14k-48k), 30% (48k-70k), 33% (70k-180k), 39% (180k+)

  it('$1 into second bracket: $14,001', () => {
    // 14000 * 0.105 + 1 * 0.175 = 1470 + 0.175 = 1470.175
    expect(calcIncomeTax(14_001)).toBeCloseTo(1470.175, 4);
  });

  it('$1 into third bracket: $48,001', () => {
    // 14000*0.105 + 34000*0.175 + 1*0.30 = 1470 + 5950 + 0.30 = 7420.30
    expect(calcIncomeTax(48_001)).toBeCloseTo(7420.30, 4);
  });

  it('$1 into fourth bracket: $70,001', () => {
    // 7420 + 22000*0.30 + 1*0.33 = 7420 + 6600 + 0.33 = 14020.33
    expect(calcIncomeTax(70_001)).toBeCloseTo(14020.33, 4);
  });

  it('$1 into fifth bracket: $180,001', () => {
    // 14020 + 110000*0.33 + 1*0.39 = 14020 + 36300 + 0.39 = 50320.39
    expect(calcIncomeTax(180_001)).toBeCloseTo(50320.39, 4);
  });

  it('exact $180,000 boundary', () => {
    // 1470 + 5950 + 6600 + 36300 = 50320
    expect(calcIncomeTax(180_000)).toBeCloseTo(50320, 2);
  });

  it('fractional income ($14,000.50) uses correct bracket split', () => {
    // 14000 * 0.105 + 0.50 * 0.175 = 1470 + 0.0875 = 1470.0875
    expect(calcIncomeTax(14_000.50)).toBeCloseTo(1470.0875, 4);
  });

  it('very small income ($1) pays 10.5%', () => {
    expect(calcIncomeTax(1)).toBeCloseTo(0.105, 4);
  });

  it('$0.01 income', () => {
    expect(calcIncomeTax(0.01)).toBeCloseTo(0.00105, 6);
  });
});

// ── calcACC — negative income (bug detection) ──────────────────────────────

describe('calcACC — negative income', () => {
  it('negative income returns 0 (ACC levy cannot be negative)', () => {
    expect(calcACC(-5000)).toBe(0);
  });

  it('negative income is consistent with calcIncomeTax (both return 0)', () => {
    expect(calcIncomeTax(-5000)).toBe(0);
    expect(calcACC(-5000)).toBe(0);
  });
});

// ── calcStudentLoan — boundary precision ─────────────────────────────────────

describe('calcStudentLoan — boundary precision', () => {
  it('income at exactly $22,828 (threshold) returns 0', () => {
    expect(calcStudentLoan(22_828, 'M SL')).toBe(0);
  });

  it('income at $22,829 ($1 above threshold) returns $0.12', () => {
    expect(calcStudentLoan(22_829, 'M SL')).toBeCloseTo(0.12, 4);
  });

  it('income $0.01 above threshold', () => {
    expect(calcStudentLoan(22_828.01, 'M SL')).toBeCloseTo(0.0012, 6);
  });
});

// ── calcNetPay — comprehensive scenarios ─────────────────────────────────────

describe('calcNetPay — edge cases', () => {
  it('all deductions are individually correct and sum correctly', () => {
    const p = { grossAnnual: 120_000, kiwiSaverRate: 4, taxCode: 'M SL' };
    const r = calcNetPay(p);

    expect(r.taxAnnual).toBeCloseTo(calcIncomeTax(120_000), 2);
    expect(r.accAnnual).toBeCloseTo(calcACC(120_000), 2);
    expect(r.kiwiSaverAnnual).toBeCloseTo(calcKiwiSaver(120_000, 4), 2);
    expect(r.studentLoanAnnual).toBeCloseTo(calcStudentLoan(120_000, 'M SL'), 2);

    const totalDeductions = r.taxAnnual + r.accAnnual + r.kiwiSaverAnnual + r.studentLoanAnnual;
    expect(r.netAnnual).toBeCloseTo(120_000 - totalDeductions, 2);
  });

  it('string grossAnnual is coerced to number', () => {
    const r = calcNetPay({ grossAnnual: '80000', kiwiSaverRate: 3, taxCode: 'M' });
    expect(r.grossAnnual).toBe(80000);
    expect(r.netAnnual).toBeGreaterThan(0);
  });

  it('null grossAnnual defaults to 0 via ?? operator', () => {
    const r = calcNetPay({ grossAnnual: null });
    expect(r.grossAnnual).toBe(0);
    expect(r.netAnnual).toBe(0);
  });

  it('undefined kiwiSaverRate defaults to 3%', () => {
    const r = calcNetPay({ grossAnnual: 80000, taxCode: 'M' });
    expect(r.kiwiSaverAnnual).toBeCloseTo(80000 * 0.03, 2);
  });

  it('kiwiSaverRate 0 preserved via ?? (not ||)', () => {
    const r = calcNetPay({ grossAnnual: 80000, kiwiSaverRate: 0, taxCode: 'M' });
    expect(r.kiwiSaverAnnual).toBe(0);
  });

  it('effectiveRate is marginal tax rate / gross', () => {
    const r = calcNetPay({ grossAnnual: 50_000, kiwiSaverRate: 0, taxCode: 'M' });
    // effectiveRate = taxAnnual / 50000 * 100
    expect(r.effectiveRate).toBeCloseTo(r.taxAnnual / 50_000 * 100, 4);
  });

  it('median NZ income ($62,000) produces expected net range', () => {
    const r = calcNetPay({ grossAnnual: 62_000, kiwiSaverRate: 3, taxCode: 'M' });
    // Rough check: net should be between 65% and 85% of gross
    expect(r.netAnnual).toBeGreaterThan(62_000 * 0.65);
    expect(r.netAnnual).toBeLessThan(62_000 * 0.85);
  });

  it('all KiwiSaver rates produce expected deductions', () => {
    const rates = [0, 3, 4, 6, 8, 10];
    for (const rate of rates) {
      const r = calcNetPay({ grossAnnual: 100_000, kiwiSaverRate: rate, taxCode: 'M' });
      expect(r.kiwiSaverAnnual).toBeCloseTo(100_000 * rate / 100, 2);
    }
  });
});

// ── fmt / fmtMoney / fmtMoneyRound ───────────────────────────────────────────

describe('fmt', () => {
  it('formats with 0 decimals by default', () => {
    expect(fmt(1234)).toBe('1,234');
  });

  it('formats with specified decimals', () => {
    const result = fmt(1234.567, 2);
    expect(result).toContain('1,234');
    expect(result).toMatch(/1,234\.57/);
  });

  it('treats null/undefined as 0', () => {
    expect(fmt(null)).toBe('0');
    expect(fmt(undefined)).toBe('0');
  });

  it('formats zero', () => {
    expect(fmt(0, 2)).toMatch(/0\.00/);
  });

  it('formats negative numbers', () => {
    const result = fmt(-1234, 0);
    expect(result).toContain('1,234');
  });

  it('formats large numbers with commas', () => {
    const result = fmt(1_000_000, 0);
    expect(result).toContain('1,000,000');
  });
});

describe('fmtMoney', () => {
  it('prefixes with $ and 2 decimal places', () => {
    expect(fmtMoney(1234.5)).toBe('$1,234.50');
  });

  it('handles zero', () => {
    expect(fmtMoney(0)).toBe('$0.00');
  });

  it('handles null', () => {
    expect(fmtMoney(null)).toBe('$0.00');
  });
});

describe('fmtMoneyRound', () => {
  it('prefixes with $ and 2 decimal places', () => {
    expect(fmtMoneyRound(1234.5)).toBe('$1,234.50');
  });

  it('handles zero', () => {
    expect(fmtMoneyRound(0)).toBe('$0.00');
  });
});
