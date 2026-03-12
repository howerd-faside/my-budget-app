import { useMemo } from 'react';
import { usePeople } from './usePeople';
import { toFortnightly } from '../../utils/finance/frequency';

/**
 * Derived hook — extracts and normalises all qualifying mortgage facilities.
 *
 * Qualifying criteria (mirrors existing Mortgage.jsx / useObligationsSnapshot):
 *   balance > 0  &&  rate > 0  &&  amount > 0
 *
 * Each facility in the returned array is augmented with:
 *   amountFn   — repayment normalised to fortnightly via toFortnightly()
 *   loanId     — id of the parent loan expense
 *   loanName   — name of the parent loan expense
 *   loanLender — lender field of the parent loan expense
 *
 * Returns:
 *   loanExpenses  — raw loan-type expenses (for UI grouping by loan)
 *   facilities    — flat normalised array of all qualifying facilities
 *   hasLoans      — true when at least one qualifying facility exists
 */
export function useMortgageFacilities() {
  const { expenses } = usePeople();

  return useMemo(() => {
    const loanExpenses = (expenses || []).filter(e => e.type === 'loan');

    const facilities = loanExpenses.flatMap(loan =>
      (loan.facilities || [])
        .filter(f => (+f.balance || 0) > 0 && (+f.rate || 0) > 0 && (+f.amount || 0) > 0)
        .map(f => ({
          ...f,
          loanId:     loan.id,
          loanName:   loan.name,
          loanLender: loan.lender,
          amountFn:   toFortnightly(f.amount, f.frequency || 'fortnightly'),
        }))
    );

    return {
      loanExpenses,
      facilities,
      hasLoans: facilities.length > 0,
    };
  }, [expenses]);
}
