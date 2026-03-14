// NZ Income Tax Brackets 2024-25
export function calcIncomeTax(annual) {
  if (annual <= 0) return 0;
  let tax = 0;
  const brackets = [
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
export function calcACC(annual) {
  if (annual <= 0) return 0;
  const cap = 142283;
  return Math.min(annual, cap) * 0.016;
}

// KiwiSaver employee contribution
export function calcKiwiSaver(annual, rate = 3) {
  return annual * (rate / 100);
}

// Student Loan repayment 2024-25 (12% on income above $22,828, SL tax codes only)
export function calcStudentLoan(annual, taxCode = '') {
  if (!taxCode.includes('SL')) return 0;
  const threshold = 22828;
  return annual > threshold ? (annual - threshold) * 0.12 : 0;
}

// Returns net annual and fortnightly after tax, ACC, KiwiSaver, Student Loan
export function calcNetPay(person) {
  // grossAnnual is stored as a number after normalization; ?? preserves intentional 0.
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

export const TAX_CODES = ['M', 'M SL', 'ME', 'ME SL', 'S', 'SH', 'ST', 'SA', 'CAE', 'EDW', 'NSW', 'WT'];
export const KIWISAVER_RATES = [0, 3, 4, 6, 8, 10];
export const PAY_FREQUENCIES = ['weekly', 'fortnightly', 'monthly', 'annual'];

export const fmt = (n, decimals = 0) =>
  (n || 0).toLocaleString('en-NZ', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export const fmtMoney = (n) => `$${fmt(n, 2)}`;
export const fmtMoneyRound = (n) => `$${fmt(n, 2)}`;
