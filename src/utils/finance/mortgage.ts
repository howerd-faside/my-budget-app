// NZ mortgage calculations — fortnightly compounding
// NZ mortgages compound annually but are paid fortnightly.
// Effective fortnightly rate = (1 + annualRate%)^(1/26) - 1

function effectiveFnRate(annualRatePct: number): number {
  return Math.pow(1 + annualRatePct / 100, 1 / 26) - 1;
}

/**
 * Project a facility balance forward from a recorded date to today.
 *
 * For rate > 0: simulates fortnightly payments using daily interest accrual
 * (annual_rate / 365 * days_in_period) — matches NZ bank conventions.
 * For rate = 0: simple subtraction (balance - payment * fortnights).
 *
 * Returns the projected remaining balance (floored at 0).
 */
export function projectBalance(
  balance: number,
  annualRatePct: number,
  fnPayment: number,
  balanceDate: string,
  asOfDate?: string,
): number {
  const b = +balance || 0;
  const p = +fnPayment || 0;
  if (b <= 0 || p <= 0 || !balanceDate) return b;

  // Normalise both dates to midnight for clean day arithmetic
  const from = new Date(balanceDate + 'T00:00:00');
  const to   = asOfDate
    ? new Date(asOfDate + 'T00:00:00')
    : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();

  const daysDiff = Math.round((to.getTime() - from.getTime()) / 86400000);
  if (daysDiff <= 0) return b;

  const fnElapsed = Math.floor(daysDiff / 14);
  if (fnElapsed <= 0) return b;

  const rate = +annualRatePct || 0;

  // Zero-rate: simple subtraction
  if (rate <= 0) {
    return Math.max(0, b - p * fnElapsed);
  }

  // Daily interest accrual (NZ bank convention): rate / 365 * 14 days per fortnight
  const dailyRate = rate / 100 / 365;
  let remaining = b;
  for (let i = 0; i < fnElapsed; i++) {
    const interest = remaining * dailyRate * 14;
    const principal = Math.min(p - interest, remaining);
    if (principal <= 0) break; // payment doesn't cover interest
    remaining -= principal;
    if (remaining <= 0.01) return 0;
  }
  return Math.max(0, Math.round(remaining * 100) / 100);
}

export interface RemainingTerm {
  fortnights: number;
  years: number;
  months: number;
}

/**
 * Simple remaining term for zero-rate (interest-free) facilities.
 * Just balance / fortnightly payment.
 */
export function calcSimpleRemainingTerm(balance: number, fnPayment: number): RemainingTerm | null {
  const b = +balance || 0;
  const p = +fnPayment || 0;
  if (b <= 0 || p <= 0) return null;

  const fortnights = Math.ceil(b / p);
  const months = Math.round(fortnights / 26 * 12);
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return { fortnights, years, months: remMonths };
}

/**
 * Remaining term given current balance, rate, and fortnightly payment.
 * Returns { fortnights, years, months } or null if payment cannot cover interest.
 */
export function calcRemainingTerm(balance: number, annualRatePct: number, fnPayment: number): RemainingTerm | null {
  const b = +balance || 0;
  const p = +fnPayment || 0;
  if (b <= 0 || p <= 0 || annualRatePct <= 0) return null;

  const r = effectiveFnRate(annualRatePct);
  const minPayment = b * r;
  if (p <= minPayment) return null; // payment doesn't cover interest

  // n = -ln(1 - r*b/p) / ln(1+r)
  const n = -Math.log(1 - (r * b) / p) / Math.log(1 + r);
  if (!isFinite(n) || n <= 0) return null;

  const fortnights = Math.ceil(n);
  const months = Math.round(fortnights / 26 * 12);
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return { fortnights, years, months: remMonths };
}

/**
 * Total interest that will be paid over remaining loan life.
 */
export function calcTotalInterest(balance: number, annualRatePct: number, fnPayment: number): number {
  const b = +balance || 0;
  const p = +fnPayment || 0;
  if (b <= 0 || p <= 0 || annualRatePct <= 0) return 0;

  const term = calcRemainingTerm(b, annualRatePct, p);
  if (!term) return 0;

  return Math.max(0, p * term.fortnights - b);
}

export interface EarlyRepaymentSavings {
  savedInterest: number;
  savedFortnights: number;
  savedMonths: number;
  newTotalInterest: number;
}

/**
 * Savings from paying an extra amount each fortnight.
 */
export function calcEarlyRepaymentSavings(balance: number, annualRatePct: number, currentFnPayment: number, extraFnPayment: number): EarlyRepaymentSavings {
  const extra = +extraFnPayment || 0;
  if (extra <= 0) return { savedInterest: 0, savedFortnights: 0, savedMonths: 0, newTotalInterest: calcTotalInterest(balance, annualRatePct, currentFnPayment) };

  const original = calcRemainingTerm(balance, annualRatePct, currentFnPayment);
  const accelerated = calcRemainingTerm(balance, annualRatePct, +currentFnPayment + extra);

  if (!original || !accelerated) return { savedInterest: 0, savedFortnights: 0, savedMonths: 0, newTotalInterest: 0 };

  const origInterest = Math.max(0, +currentFnPayment * original.fortnights - +balance);
  const newPayment = +currentFnPayment + extra;
  const newInterest = Math.max(0, newPayment * accelerated.fortnights - +balance);
  const savedInterest = origInterest - newInterest;
  const savedFortnights = original.fortnights - accelerated.fortnights;
  const savedMonths = Math.round(savedFortnights / 26 * 12);

  return {
    savedInterest: Math.max(0, savedInterest),
    savedFortnights,
    savedMonths,
    newTotalInterest: newInterest,
  };
}

export interface AmortPoint {
  year: number;
  balance: number;
  cumulativeInterest: number;
  cumulativePrincipal: number;
  annualInterest: number;
  annualPrincipal: number;
}

/**
 * Build an amortisation schedule, sampled every 26 fortnights (annually) for charts.
 */
export function buildAmortSchedule(balance: number, annualRatePct: number, fnPayment: number, maxPeriods = 26 * 35): AmortPoint[] {
  const b = +balance || 0;
  const p = +fnPayment || 0;
  if (b <= 0 || p <= 0 || annualRatePct <= 0) return [];

  const r = effectiveFnRate(annualRatePct);
  let remaining = b;
  let cumInterest = 0;
  let cumPrincipal = 0;
  let yearInterest = 0;
  let yearPrincipal = 0;
  const points: AmortPoint[] = [{ year: 0, balance: remaining, cumulativeInterest: 0, cumulativePrincipal: 0, annualInterest: 0, annualPrincipal: 0 }];

  for (let fn = 1; fn <= maxPeriods; fn++) {
    const interest = remaining * r;
    const principal = Math.min(p - interest, remaining);
    if (principal <= 0) break;
    remaining -= principal;
    cumInterest += interest;
    cumPrincipal += principal;
    yearInterest += interest;
    yearPrincipal += principal;

    if (fn % 26 === 0) {
      points.push({
        year: fn / 26,
        balance: Math.max(0, remaining),
        cumulativeInterest: Math.round(cumInterest),
        cumulativePrincipal: Math.round(cumPrincipal),
        annualInterest: Math.round(yearInterest),
        annualPrincipal: Math.round(yearPrincipal),
      });
      yearInterest = 0;
      yearPrincipal = 0;
    }
    if (remaining <= 0.01) break;
  }

  return points;
}

/**
 * Fortnightly interest component for a given balance and annual rate.
 */
export function fnInterestComponent(balance: number, annualRatePct: number): number {
  return (+balance || 0) * effectiveFnRate(annualRatePct);
}

export interface MonthlyPoint {
  month: number;
  year: number;
  label: string;
  interest: number;
  principal: number;
  balance: number;
  cumulativeInterest: number;
}

/**
 * Build a monthly amortisation schedule for charts.
 * NZ mortgages: effective monthly rate = (1 + annualRate)^(1/12) - 1
 */
export function buildMonthlySchedule(balance: number, annualRatePct: number, fnPayment: number, maxMonths = 360): MonthlyPoint[] {
  const b = +balance || 0;
  const p = +fnPayment || 0;
  if (b <= 0 || p <= 0 || annualRatePct <= 0) return [];

  const monthlyRate = Math.pow(1 + annualRatePct / 100, 1 / 12) - 1;
  const monthlyPayment = p * 26 / 12;

  let remaining = b;
  let cumInterest = 0;
  const points: MonthlyPoint[] = [];
  const startYear = new Date().getFullYear();

  for (let m = 1; m <= maxMonths && remaining > 0.5; m++) {
    const interest = remaining * monthlyRate;
    const principal = Math.min(monthlyPayment - interest, remaining);
    if (principal <= 0) break;
    remaining -= principal;
    cumInterest += interest;

    const yr = Math.floor((m - 1) / 12);
    points.push({
      month: m,
      year: yr,
      label: m % 12 === 1 ? `${startYear + yr}` : '',
      interest: Math.round(interest),
      principal: Math.round(principal),
      balance: Math.max(0, Math.round(remaining)),
      cumulativeInterest: Math.round(cumInterest),
    });
  }
  return points;
}
