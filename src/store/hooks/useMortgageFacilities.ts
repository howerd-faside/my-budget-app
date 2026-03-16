import { useMemo } from 'react';
import { usePeople } from './usePeople';
import { getLoanFacilities } from '../../utils/finance/loanFacilities';

export type { NormalisedFacility, LoanFacilitiesResult } from '../../utils/finance/loanFacilities';

export interface MortgageFacilitiesReturn {
  loanExpenses: import('../../models/Expense').Expense[];
  facilities:   import('../../utils/finance/loanFacilities').NormalisedFacility[];
  hasLoans:     boolean;
}

/**
 * Derived hook — extracts and normalises all qualifying mortgage facilities.
 *
 * Qualifying criteria: balance > 0 && rate > 0 && amount > 0
 */
export function useMortgageFacilities(): MortgageFacilitiesReturn {
  const { expenses } = usePeople();

  return useMemo(() => getLoanFacilities(expenses), [expenses]);
}
