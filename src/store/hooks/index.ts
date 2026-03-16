/**
 * Domain hooks — thin wrappers over the Zustand domain stores with stable,
 * named APIs.
 *
 * Usage:
 *   import { useFinance }    from '../store/hooks';
 *   import { usePeople }     from '../store/hooks';
 *   import { useProperty }   from '../store/hooks';
 *   import { useInvestment } from '../store/hooks';
 *   import { useUI }         from '../store/hooks';
 */
export { useFinance }    from './useFinance';
export { usePeople }     from './usePeople';
export { useProperty }   from './useProperty';
export { useInvestment } from './useInvestment';
export { useUI }              from './useUI';
export { useHouseholdSnapshot } from './useHouseholdSnapshot';
export { useMoneyFlow }         from './useMoneyFlow';
export { useCashflowTrend }         from './useCashflowTrend';
export { useObligationsSnapshot }   from './useObligationsSnapshot';
export { useSavingsPosition }       from './useSavingsPosition';
export { useMortgageFacilities }    from './useMortgageFacilities';
export { useMortgageSummary }       from './useMortgageSummary';
export { useMortgageAmortisation }  from './useMortgageAmortisation';
export { usePortfolioAnalytics }   from './usePortfolioAnalytics';
export { useFortnightSettlement } from './useFortnightSettlement';
export { useWishlistSummary }    from './useWishlistSummary';
export { useGoalsSummary }       from './useGoalsSummary';
export { usePropertyAlerts }       from './usePropertyAlerts';
export { useNetWorth }             from './useNetWorth';
export { useUpcomingObligations }  from './useUpcomingObligations';
