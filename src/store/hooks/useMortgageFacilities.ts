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

/**
 * Derived hook — ALL loan facilities including zero-rate (interest-free) ones.
 *
 * Use this for the full debt picture (CurrentPosition, Facilities display).
 * Amortisation/early-repayment should still use useMortgageFacilities (rate > 0 only).
 */
export function useAllLoanFacilities(): MortgageFacilitiesReturn {
  const { expenses } = usePeople();

  return useMemo(() => getLoanFacilities(expenses, { requireRate: false, requireAmount: false }), [expenses]);
}
