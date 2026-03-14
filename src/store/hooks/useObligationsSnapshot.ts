import { useMemo } from 'react';
import { usePeople } from './usePeople';
import { calcRemainingTerm, calcTotalInterest } from '../../utils/finance/mortgage';
import { toFortnightly } from '../../utils/finance/frequency';


export interface ObligationsSnapshot {
  totalBalance:  number;
  repaymentFn:   number;
  totalInterest: number;
  payoffYear:    number | null;
  hasLoans:      boolean;
}

/**
 * Derived hook — summary of all outstanding mortgage/loan obligations.
 */
export function useObligationsSnapshot(): ObligationsSnapshot {
  const { expenses } = usePeople();

  return useMemo(() => {
    const loanExpenses  = (expenses || []).filter(e => e.type === 'loan');
    const allFacilities = loanExpenses.flatMap(loan =>
      (loan.facilities || []).filter(
        f => (+f.balance || 0) > 0 && (+f.rate || 0) > 0 && (+f.amount || 0) > 0
      )
    );

    if (allFacilities.length === 0) {
      return { totalBalance: 0, repaymentFn: 0, totalInterest: 0, payoffYear: null as number | null, hasLoans: false };
    }

    const totalBalance  = allFacilities.reduce((s, f) => s + (+f.balance || 0), 0);
    const repaymentFn   = allFacilities.reduce(
      (s, f) => s + toFortnightly(f.amount, f.frequency || 'fortnightly'), 0
    );
    const totalInterest = allFacilities.reduce(
      (s, f) => s + calcTotalInterest(+f.balance, +f.rate, toFortnightly(f.amount, f.frequency || 'fortnightly')),
      0
    );

    // Payoff year = current year + ceiling of the longest remaining term
    let maxYearsRemaining = 0;
    for (const f of allFacilities) {
      const term = calcRemainingTerm(+f.balance, +f.rate, toFortnightly(f.amount, f.frequency || 'fortnightly'));
      if (term) {
        const total = term.years + term.months / 12;
        if (total > maxYearsRemaining) maxYearsRemaining = total;
      }
    }
    const payoffYear = maxYearsRemaining > 0
      ? new Date().getFullYear() + Math.ceil(maxYearsRemaining)
      : null;

    return { totalBalance, repaymentFn, totalInterest, payoffYear, hasLoans: true };
  }, [expenses]);
}
