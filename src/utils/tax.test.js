import { describe, it, expect } from 'vitest';
import {
  calcIncomeTax,
  calcACC,
  calcKiwiSaver,
  calcStudentLoan,
  calcNetPay,
} from './finance/tax';

// ── calcIncomeTax ─────────────────────────────────────────────────────────────
describe('calcIncomeTax', () => {
  // NZ 2024-25 brackets:
  //   $0 – $14 000:   10.5%
  //   $14 001 – $48 000:  17.5%
  //   $48 001 – $70 000:  30%
  //   $70 001 – $180 000: 33%
  //   $180 001+:          39%

  it('zero income pays no tax', () => {
    expect(calcIncomeTax(0)).toBe(0);
  });

  it('negative income pays no tax', () => {
    expect(calcIncomeTax(-5000)).toBe(0);
  });

  it('income within first bracket only (10.5%)', () => {
    // $14 000 * 10.5% = $1 470
    expect(calcIncomeTax(14_000)).toBeCloseTo(1470, 2);
  });

  it('income spanning two brackets', () => {
    // $14 000 * 10.5% = $1 470
    // $14 000 * 17.5% = $2 450
    // total = $3 920
    expect(calcIncomeTax(28_000)).toBeCloseTo(3920, 2);
  });

  it('income at exactly $48 000 (top of second bracket)', () => {
    // $14 000 * 10.5% = $1 470
    // $34 000 * 17.5% = $5 950
    expect(calcIncomeTax(48_000)).toBeCloseTo(7420, 2);
  });

  it('income in third bracket (30%)', () => {
    // $48k tax = $7 420
    // $22 000 * 30% = $6 600
    expect(calcIncomeTax(70_000)).toBeCloseTo(14_020, 2);
  });

  it('income in fourth bracket (33%)', () => {
    // $70k tax = $14 020
    // $30 000 * 33% = $9 900
    expect(calcIncomeTax(100_000)).toBeCloseTo(23_920, 2);
  });

  it('income above $180 000 uses 39% for the excess', () => {
    // $180k tax:
    //   14 000 * 10.5% =  1 470
    //   34 000 * 17.5% =  5 950
    //   22 000 * 30%   =  6 600
    //  110 000 * 33%   = 36 300
    //  Total at 180k   = 50 320
    //   20 000 * 39%   =  7 800
    //  Total at 200k   = 58 120
    expect(calcIncomeTax(200_000)).toBeCloseTo(58_120, 2);
  });

  it('very large income applies 39% bracket for the bulk', () => {
    const tax = calcIncomeTax(1_000_000);
    expect(tax).toBeGreaterThan(300_000);
  });
});

// ── calcACC ───────────────────────────────────────────────────────────────────
describe('calcACC', () => {
  const RATE = 0.016;
  const CAP  = 142_283;

  it('zero income pays zero ACC', () => {
    expect(calcACC(0)).toBe(0);
  });

  it('levy is 1.6% of income below cap', () => {
    expect(calcACC(50_000)).toBeCloseTo(50_000 * RATE, 4);
  });

  it('levy is capped at cap * 1.6%', () => {
    expect(calcACC(CAP)).toBeCloseTo(CAP * RATE, 4);
    expect(calcACC(CAP + 50_000)).toBeCloseTo(CAP * RATE, 4);
  });

  it('income exactly at the cap gives the same levy as income above the cap', () => {
    expect(calcACC(CAP)).toBe(calcACC(CAP * 2));
  });

  it('maximum ACC levy is correct', () => {
    expect(calcACC(1_000_000)).toBeCloseTo(CAP * RATE, 2);
  });
});

// ── calcKiwiSaver ─────────────────────────────────────────────────────────────
describe('calcKiwiSaver', () => {
  it('defaults to 3% when no rate supplied', () => {
    expect(calcKiwiSaver(100_000)).toBeCloseTo(3000, 4);
  });

  it('rate 0 means not enrolled — returns 0', () => {
    expect(calcKiwiSaver(100_000, 0)).toBe(0);
  });

  it('4% rate on $80 000', () => {
    expect(calcKiwiSaver(80_000, 4)).toBeCloseTo(3200, 4);
  });

  it('10% rate on $60 000', () => {
    expect(calcKiwiSaver(60_000, 10)).toBeCloseTo(6000, 4);
  });

  it('zero income returns zero regardless of rate', () => {
    expect(calcKiwiSaver(0, 6)).toBe(0);
  });
});

// ── calcStudentLoan ───────────────────────────────────────────────────────────
describe('calcStudentLoan', () => {
  const THRESHOLD = 22_828;
  const RATE = 0.12;

  it('returns 0 for non-SL tax codes', () => {
    expect(calcStudentLoan(100_000, 'M')).toBe(0);
    expect(calcStudentLoan(100_000, 'ME')).toBe(0);
    expect(calcStudentLoan(100_000, '')).toBe(0);
  });

  it('returns 0 when income is below the threshold (SL code)', () => {
    expect(calcStudentLoan(20_000, 'M SL')).toBe(0);
    expect(calcStudentLoan(THRESHOLD, 'M SL')).toBe(0);
  });

  it('calculates 12% on the amount above the threshold', () => {
    const income = 50_000;
    const expected = (income - THRESHOLD) * RATE;
    expect(calcStudentLoan(income, 'M SL')).toBeCloseTo(expected, 4);
  });

  it('works for ME SL tax code', () => {
    expect(calcStudentLoan(80_000, 'ME SL')).toBeCloseTo((80_000 - THRESHOLD) * RATE, 4);
  });

  it('zero income returns zero', () => {
    expect(calcStudentLoan(0, 'M SL')).toBe(0);
  });
});

// ── calcNetPay ────────────────────────────────────────────────────────────────
describe('calcNetPay', () => {
  it('zero gross income produces all-zero output', () => {
    const result = calcNetPay({ grossAnnual: 0 });
    expect(result.netAnnual).toBe(0);
    expect(result.netFortnightly).toBe(0);
    expect(result.effectiveRate).toBe(0);
  });

  it('net is always less than gross for positive income', () => {
    const result = calcNetPay({ grossAnnual: 80_000, kiwiSaverRate: 3, taxCode: 'M' });
    expect(result.netAnnual).toBeLessThan(80_000);
  });

  it('netFortnightly = netAnnual / 26', () => {
    const result = calcNetPay({ grossAnnual: 75_000, kiwiSaverRate: 3, taxCode: 'M' });
    expect(result.netFortnightly).toBeCloseTo(result.netAnnual / 26, 6);
  });

  it('effectiveRate = tax / gross * 100', () => {
    const result = calcNetPay({ grossAnnual: 100_000, kiwiSaverRate: 0 });
    expect(result.effectiveRate).toBeCloseTo((result.taxAnnual / 100_000) * 100, 4);
  });

  it('deductions sum to gross − net', () => {
    const result = calcNetPay({ grossAnnual: 90_000, kiwiSaverRate: 4, taxCode: 'M SL' });
    const totalDeductions = result.taxAnnual + result.accAnnual + result.kiwiSaverAnnual + result.studentLoanAnnual;
    expect(totalDeductions).toBeCloseTo(result.grossAnnual - result.netAnnual, 2);
  });

  it('student loan is zero for non-SL tax code', () => {
    const result = calcNetPay({ grossAnnual: 80_000, taxCode: 'M' });
    expect(result.studentLoanAnnual).toBe(0);
  });

  it('student loan is applied for SL tax code', () => {
    const result = calcNetPay({ grossAnnual: 80_000, taxCode: 'M SL' });
    expect(result.studentLoanAnnual).toBeGreaterThan(0);
  });

  it('KiwiSaver rate 0 means no KiwiSaver deduction', () => {
    const result = calcNetPay({ grossAnnual: 80_000, kiwiSaverRate: 0 });
    expect(result.kiwiSaverAnnual).toBe(0);
  });

  it('high income (>$180k) has effective rate approaching 39%', () => {
    const result = calcNetPay({ grossAnnual: 500_000, kiwiSaverRate: 0, taxCode: 'M' });
    expect(result.effectiveRate).toBeGreaterThan(35);
  });

  it('missing grossAnnual defaults to 0', () => {
    const result = calcNetPay({});
    expect(result.grossAnnual).toBe(0);
    expect(result.netAnnual).toBe(0);
  });
});
