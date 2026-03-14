/**
 * useInvestment — domain hook for the investment slice.
 *
 * Exposed state:   investmentPortfolios, selectedPortfolioId, investments,
 *                  investmentContributions, investmentDividends
 * Exposed actions: setInvestment(key, val), mergeInvestment(slices)
 */
import { useInvestmentStore } from '../investmentStore';

import type { InvestmentStoreState } from '../investmentStore';

export interface UseInvestmentReturn {
  // State
  investmentPortfolios:    InvestmentStoreState['investmentPortfolios'];
  selectedPortfolioId:     InvestmentStoreState['selectedPortfolioId'];
  investments:             InvestmentStoreState['investments'];
  investmentContributions: InvestmentStoreState['investmentContributions'];
  investmentDividends:     InvestmentStoreState['investmentDividends'];
  // Actions
  setInvestment:           <K extends keyof InvestmentStoreState>(key: K, val: InvestmentStoreState[K]) => void;
  mergeInvestment:         (slices: Partial<InvestmentStoreState>) => void;
}

export function useInvestment(): UseInvestmentReturn {
  const s = useInvestmentStore();
  return {
    // State
    investmentPortfolios:    s.investmentPortfolios,
    selectedPortfolioId:     s.selectedPortfolioId,
    investments:             s.investments,
    investmentContributions: s.investmentContributions,
    investmentDividends:     s.investmentDividends,
    // Actions
    setInvestment:           s.setSlice,
    mergeInvestment:         s.mergeSlices,
  };
}
