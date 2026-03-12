import { useMemo } from 'react';
import { usePeople } from './usePeople';
import { calcRemainingTerm, calcTotalInterest } from '../../utils/mortgage';
import { toFortnightly } from '../../utils/finance/frequency';

/**
 * Derived hook — summary of all outstanding mortgage/loan obligations.
 *
 * Facility selection and financial derivation mirror Dashboard.jsx exactly:
 *   - Only facilities with balance > 0, rate > 0, amount > 0 are included
 *   - calcTotalInterest / calcRemainingTerm from mortgage.js handle all maths
 *   - repaymentFn uses toFortnightly so non-fortnightly facility amounts normalise
 *
 * Returns:
 *   totalBalance   — sum of outstanding balances across all facilities
 *   repaymentFn    — total fortnightly repayment across all facilities
 *   totalInterest  — total interest remaining (sum of calcTotalInterest per facility)
 *   payoffYear     — calendar year when the last facility is cleared (null if none)
 *   hasLoans       — true when at least one qualifying facility exists
 */
export function useObligationsSnapshot() {
  const { expenses } = usePeople();

  return useMemo(() => {
    const loanExpenses  = (expenses || []).filter(e => e.type === 'loan');
    const allFacilities = loanExpenses.flatMap(loan =>
      (loan.facilities || []).filter(
        f => (+f.balance || 0) > 0 && (+f.rate || 0) > 0 && (+f.amount || 0) > 0
      )
    );

    if (allFacilities.length === 0) {
      return { totalBalance: 0, repaymentFn: 0, totalInterest: 0, payoffYear: null, hasLoans: false };
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
