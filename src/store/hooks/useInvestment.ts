/**
 * useInvestment — domain hook for the investment slice.
 *
 * Exposed state:   investmentPortfolios, selectedPortfolioId,
 *                  investmentAssets, investmentTransactions, priceCache,
 *                  watchlist, watchlistPrices
 * Exposed actions: setInvestment(key, val), mergeInvestment(slices)
 */
import { useInvestmentStore } from '../investmentStore';

import type { InvestmentStoreState } from '../investmentStore';

export interface UseInvestmentReturn {
  // State
  investmentPortfolios:    InvestmentStoreState['investmentPortfolios'];
  selectedPortfolioId:     InvestmentStoreState['selectedPortfolioId'];
  investmentAssets:        InvestmentStoreState['investmentAssets'];
  investmentTransactions:  InvestmentStoreState['investmentTransactions'];
  priceCache:              InvestmentStoreState['priceCache'];
  // Discovery (v6+)
  watchlist:               InvestmentStoreState['watchlist'];
  watchlistPrices:         InvestmentStoreState['watchlistPrices'];
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
    investmentAssets:        s.investmentAssets,
    investmentTransactions:  s.investmentTransactions,
    priceCache:              s.priceCache,
    // Discovery (v6+)
    watchlist:               s.watchlist,
    watchlistPrices:         s.watchlistPrices,
    // Actions
    setInvestment:           s.setSlice,
    mergeInvestment:         s.mergeSlices,
  };
}
