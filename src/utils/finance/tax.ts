// NZ Income Tax Brackets 2024-25

export function calcIncomeTax(annual: number): number {
  if (annual <= 0) return 0;
  let tax = 0;
  const brackets: [number, number][] = [
    [14000,  0.105],
    [34000,  0.175],  // 48k - 14k
    [22000,  0.30],   // 70k - 48k
    [110000, 0.33],   // 180k - 70k
    [Infinity, 0.39],
  ];
  let remaining = annual;
  for (const [size, rate] of brackets) {
    if (remaining <= 0) break;
    const taxable = Math.min(remaining, size);
    tax += taxable * rate;
    remaining -= taxable;
  }
  return tax;
}

// ACC Earners' Levy 2024-25
export function calcACC(annual: number): number {
  if (annual <= 0) return 0;
  const cap = 142283;
  return Math.min(annual, cap) * 0.016;
}

// KiwiSaver employee contribution
export function calcKiwiSaver(annual: number, rate = 3): number {
  return annual * (rate / 100);
}

// Student Loan repayment 2024-25 (12% on income above $22,828, SL tax codes only)
export function calcStudentLoan(annual: number, taxCode = ''): number {
  if (!taxCode.includes('SL')) return 0;
  const threshold = 22828;
  return annual > threshold ? (annual - threshold) * 0.12 : 0;
}

export interface NetPayResult {
  grossAnnual:       number;
  taxAnnual:         number;
  accAnnual:         number;
  kiwiSaverAnnual:   number;
  studentLoanAnnual: number;
  netAnnual:         number;
  netFortnightly:    number;
  effectiveRate:     number;
}

// Returns net annual and fortnightly after tax, ACC, KiwiSaver, Student Loan
export function calcNetPay(person: { grossAnnual?: number; kiwiSaverRate?: number; taxCode?: string }): NetPayResult {
  const gross = +(person.grossAnnual ?? 0);
  const tax   = calcIncomeTax(gross);
  const acc   = calcACC(gross);
  const ks    = calcKiwiSaver(gross, person.kiwiSaverRate ?? 3);
  const sl    = calcStudentLoan(gross, person.taxCode);
  const netAnnual = gross - tax - acc - ks - sl;
  return {
    grossAnnual:       gross,
    taxAnnual:         tax,
    accAnnual:         acc,
    kiwiSaverAnnual:   ks,
    studentLoanAnnual: sl,
    netAnnual,
    netFortnightly:    netAnnual / 26,
    effectiveRate:     gross > 0 ? (tax / gross) * 100 : 0,
  };
}

export const TAX_CODES = ['M', 'M SL', 'ME', 'ME SL', 'S', 'SH', 'ST', 'SA', 'CAE', 'EDW', 'NSW', 'WT'] as const;
export const KIWISAVER_RATES = [0, 3, 4, 6, 8, 10] as const;
export const PAY_FREQUENCIES = ['weekly', 'fortnightly', 'monthly', 'annual'] as const;

export const fmt = (n: number, decimals = 0): string =>
  (n || 0).toLocaleString('en-NZ', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export const fmtMoney = (n: number): string => `$${fmt(n, 2)}`;
export const fmtMoneyRound = (n: number): string => `$${fmt(n, 2)}`;
