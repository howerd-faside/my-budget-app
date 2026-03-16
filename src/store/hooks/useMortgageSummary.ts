import { useMemo } from 'react';
import { useMortgageFacilities } from './useMortgageFacilities';
import { useMortgageAmortisation } from './useMortgageAmortisation';
import { calcObligationMetrics } from '../../utils/finance/loanFacilities';

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
 *
 * Core obligation metrics (totalBalance, repaymentFn, totalInterest, payoffYear)
 * are delegated to calcObligationMetrics.  This hook adds intPct and crossoverYear.
 */
export function useMortgageSummary(): MortgageSummary {
  const { facilities } = useMortgageFacilities();
  const { piData }     = useMortgageAmortisation();

  return useMemo(() => {
    const base = calcObligationMetrics(facilities);

    if (!base.hasLoans) {
      return { ...base, intPct: 0, crossoverYear: null as number | null };
    }

    const intPct = base.totalBalance > 0 && base.totalInterest > 0
      ? Math.round(base.totalInterest / (base.totalInterest + base.totalBalance) * 100)
      : 0;

    // Crossover year — derived from shared piData, no schedule rebuild
    const crossoverEntry = piData.find(d => d.principal > d.interest);
    const crossoverYear  = crossoverEntry
      ? new Date().getFullYear() + crossoverEntry.year
      : null;

    return { ...base, intPct, crossoverYear };
  }, [facilities, piData]);
}
