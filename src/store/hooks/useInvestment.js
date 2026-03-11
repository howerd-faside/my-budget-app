/**
 * useInvestment — domain hook for the investment slice.
 *
 * Exposed state:   investmentPortfolios, selectedPortfolioId, investments,
 *                  investmentContributions, investmentDividends
 * Exposed actions: setInvestment(key, val), mergeInvestment(slices)
 */
import { useInvestmentStore } from '../investmentStore';

export function useInvestment() {
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
