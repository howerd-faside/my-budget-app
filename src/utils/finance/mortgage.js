// NZ mortgage calculations — fortnightly compounding
// NZ mortgages compound annually but are paid fortnightly.
// Effective fortnightly rate = (1 + annualRate%)^(1/26) - 1

function effectiveFnRate(annualRatePct) {
  return Math.pow(1 + annualRatePct / 100, 1 / 26) - 1;
}

/**
 * Remaining term given current balance, rate, and fortnightly payment.
 * Returns { fortnights, years, months } or null if payment cannot cover interest.
 */
export function calcRemainingTerm(balance, annualRatePct, fnPayment) {
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
export function calcTotalInterest(balance, annualRatePct, fnPayment) {
  const b = +balance || 0;
  const p = +fnPayment || 0;
  if (b <= 0 || p <= 0 || annualRatePct <= 0) return 0;

  const term = calcRemainingTerm(b, annualRatePct, p);
  if (!term) return 0;

  return Math.max(0, p * term.fortnights - b);
}

/**
 * Savings from paying an extra amount each fortnight.
 * Returns { savedInterest, savedFortnights, savedMonths, newTotalInterest }
 */
export function calcEarlyRepaymentSavings(balance, annualRatePct, currentFnPayment, extraFnPayment) {
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

/**
 * Build an amortisation schedule, sampled every 26 fortnights (annually) for charts.
 * Returns array of { year, balance, cumulativeInterest, cumulativePrincipal }
 */
export function buildAmortSchedule(balance, annualRatePct, fnPayment, maxPeriods = 26 * 35) {
  const b = +balance || 0;
  const p = +fnPayment || 0;
  if (b <= 0 || p <= 0 || annualRatePct <= 0) return [];

  const r = effectiveFnRate(annualRatePct);
  let remaining = b;
  let cumInterest = 0;
  let cumPrincipal = 0;
  let yearInterest = 0;
  let yearPrincipal = 0;
  const points = [{ year: 0, balance: remaining, cumulativeInterest: 0, cumulativePrincipal: 0, annualInterest: 0, annualPrincipal: 0 }];

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
export function fnInterestComponent(balance, annualRatePct) {
  return (+balance || 0) * effectiveFnRate(annualRatePct);
}

/**
 * Build a monthly amortisation schedule for charts.
 * NZ mortgages: effective monthly rate = (1 + annualRate)^(1/12) - 1
 * Returns array of { month, year, label, interest, principal, balance, cumulativeInterest }
 * Capped at maxMonths (default 360 = 30 years).
 */
export function buildMonthlySchedule(balance, annualRatePct, fnPayment, maxMonths = 360) {
  const b = +balance || 0;
  const p = +fnPayment || 0;
  if (b <= 0 || p <= 0 || annualRatePct <= 0) return [];

  const monthlyRate = Math.pow(1 + annualRatePct / 100, 1 / 12) - 1;
  const monthlyPayment = p * 26 / 12;

  let remaining = b;
  let cumInterest = 0;
  const points = [];
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
