import { useMemo } from 'react';
import { useAllLoanFacilities } from './useMortgageFacilities';
import { calcObligationMetrics } from '../../utils/finance/loanFacilities';

export type { ObligationMetrics } from '../../utils/finance/loanFacilities';

export type ObligationsSnapshot = import('../../utils/finance/loanFacilities').ObligationMetrics;

/**
 * Derived hook — summary of all outstanding mortgage/loan obligations.
 *
 * Uses ALL facilities (including zero-rate / interest-free) for the
 * complete debt picture on the home dashboard.
 */
export function useObligationsSnapshot(): ObligationsSnapshot {
  const { facilities } = useAllLoanFacilities();

  return useMemo(() => calcObligationMetrics(facilities), [facilities]);
}
