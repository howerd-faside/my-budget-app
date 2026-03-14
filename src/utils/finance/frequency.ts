/**
 * Convert an amount at any frequency to its fortnightly equivalent.
 * Supported frequencies: 'weekly', 'fortnightly', 'monthly', 'quarterly', 'annual'
 * Defaults to returning the raw amount if frequency is unrecognised.
 */
export function toFortnightly(amount: number | string, frequency: string): number {
  const a = +amount || 0;
  if (frequency === 'fortnightly') return a;
  if (frequency === 'weekly')      return a * 2;
  if (frequency === 'monthly')     return (a * 12) / 26;
  if (frequency === 'quarterly')   return (a * 4) / 26;
  if (frequency === 'annual')      return a / 26;
  return a;
}

/**
 * Simple fortnightly interest charge on a loan facility.
 * Uses annual rate / 26 (not compound) — suitable for display/estimation.
 * For amortisation-grade compound interest use fnInterestComponent from mortgage.js.
 */
export function annualInterestToFortnightly(balance: number | string, annualRatePct: number | string): number {
  return (+balance || 0) * (+annualRatePct || 0) / 100 / 26;
}
