import { useMemo } from 'react';
import { useMortgageFacilities } from './useMortgageFacilities';
import { calcObligationMetrics } from '../../utils/finance/loanFacilities';

export type { ObligationMetrics } from '../../utils/finance/loanFacilities';

export type ObligationsSnapshot = import('../../utils/finance/loanFacilities').ObligationMetrics;

/**
 * Derived hook — summary of all outstanding mortgage/loan obligations.
 *
 * Delegates facility extraction to useMortgageFacilities (shared memo)
 * and aggregate maths to calcObligationMetrics (shared utility).
 */
export function useObligationsSnapshot(): ObligationsSnapshot {
  const { facilities } = useMortgageFacilities();

  return useMemo(() => calcObligationMetrics(facilities), [facilities]);
}
