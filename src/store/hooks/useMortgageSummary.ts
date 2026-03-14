import { useMemo } from 'react';
import { useMortgageFacilities } from './useMortgageFacilities';
import { useMortgageAmortisation } from './useMortgageAmortisation';
import { calcTotalInterest, calcRemainingTerm } from '../../utils/finance/mortgage';

export interface MortgageSummary {
  totalBalance:  number;
  repaymentFn:   number;
  totalInterest: number;
  intPct:        number;
  payoffYear:    number | null;
  crossoverYear: number | null;
  hasLoans:      boolean;
}

/**
 * Derived hook — aggregate mortgage summary metrics.
 */
export function useMortgageSummary(): MortgageSummary {
  const { facilities } = useMortgageFacilities();
  const { piData }     = useMortgageAmortisation();

  return useMemo(() => {
    if (facilities.length === 0) {
      return {
        totalBalance:  0,
        repaymentFn:   0,
        totalInterest: 0,
        intPct:        0,
        payoffYear:    null as number | null,
        crossoverYear: null as number | null,
        hasLoans:      false,
      };
    }

    // ── Scalar aggregates ───────────────────────────────────────────────────
    const totalBalance = facilities.reduce((s, f) => s + (+f.balance || 0), 0);
    const repaymentFn  = facilities.reduce((s, f) => s + f.amountFn, 0);

    const totalInterest = facilities.reduce(
      (s, f) => s + calcTotalInterest(+f.balance, +f.rate, f.amountFn),
      0
    );

    const intPct = totalBalance > 0 && totalInterest > 0
      ? Math.round(totalInterest / (totalInterest + totalBalance) * 100)
      : 0;

    // ── Payoff year — longest remaining term across all facilities ──────────
    let maxYearsRemaining = 0;
    for (const f of facilities) {
      const term = calcRemainingTerm(+f.balance, +f.rate, f.amountFn);
      if (term) {
        const totalYears = term.years + term.months / 12;
        if (totalYears > maxYearsRemaining) maxYearsRemaining = totalYears;
      }
    }
    const payoffYear = maxYearsRemaining > 0
      ? new Date().getFullYear() + Math.ceil(maxYearsRemaining)
      : null;

    // ── Crossover year — derived from shared piData, no schedule rebuild ───
    const crossoverEntry = piData.find(d => d.principal > d.interest);
    const crossoverYear  = crossoverEntry
      ? new Date().getFullYear() + crossoverEntry.year
      : null;

    return {
      totalBalance,
      repaymentFn,
      totalInterest,
      intPct,
      payoffYear,
      crossoverYear,
      hasLoans: true,
    };
  }, [facilities, piData]);
}
