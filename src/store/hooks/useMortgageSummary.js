import { useMemo } from 'react';
import { useMortgageFacilities } from './useMortgageFacilities';
import { useMortgageAmortisation } from './useMortgageAmortisation';
import { calcTotalInterest, calcRemainingTerm } from '../../utils/finance/mortgage';

/**
 * Derived hook — aggregate mortgage summary metrics.
 *
 * Consumes useMortgageFacilities() so facility normalisation (amountFn,
 * qualifying filter) is not repeated here.
 *
 * Crossover year is derived from useMortgageAmortisation().piData so that
 * amortisation schedules are built once and shared rather than duplicated.
 *
 * All financial calculations delegate to src/utils/mortgage.js.
 *
 * Returns:
 *   totalBalance   — sum of outstanding balances
 *   repaymentFn    — total fortnightly repayment across all facilities
 *   totalInterest  — total interest remaining (sum of calcTotalInterest per facility)
 *   intPct         — interest as % of (interest + outstanding): e.g. 42 means 42%
 *   payoffYear     — calendar year the last facility clears (null if none)
 *   crossoverYear  — first calendar year where aggregate annual principal > interest
 *                    across all facilities (null if never in schedule)
 *   hasLoans       — true when at least one qualifying facility exists
 */
export function useMortgageSummary() {
  const { facilities } = useMortgageFacilities();
  const { piData }     = useMortgageAmortisation();

  return useMemo(() => {
    if (facilities.length === 0) {
      return {
        totalBalance:  0,
        repaymentFn:   0,
        totalInterest: 0,
        intPct:        0,
        payoffYear:    null,
        crossoverYear: null,
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
