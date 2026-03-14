import { useMemo } from 'react';
import { usePeople } from './usePeople';
import { toFortnightly } from '../../utils/finance/frequency';

import type { Expense, Facility } from '../../models/Expense';

export interface NormalisedFacility extends Facility {
  loanId:     string;
  loanName:   string;
  loanLender: string;
  amountFn:   number;
}

export interface MortgageFacilitiesReturn {
  loanExpenses: Expense[];
  facilities:   NormalisedFacility[];
  hasLoans:     boolean;
}

/**
 * Derived hook — extracts and normalises all qualifying mortgage facilities.
 *
 * Qualifying criteria: balance > 0 && rate > 0 && amount > 0
 */
export function useMortgageFacilities(): MortgageFacilitiesReturn {
  const { expenses } = usePeople();

  return useMemo(() => {
    const loanExpenses = (expenses || []).filter(e => e.type === 'loan');

    const facilities: NormalisedFacility[] = loanExpenses.flatMap(loan =>
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
