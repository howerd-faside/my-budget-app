/**
 * Investment domain store.
 *
 * Owns: investmentPortfolios, selectedPortfolioId, investments,
 *       investmentContributions, investmentDividends
 */
import { create } from 'zustand';
import { persist }  from 'zustand/middleware';
import { createBudgetStorage } from './budgetStorage';
import {
  INVESTMENT_VERSION,
  INVESTMENT_VERSION_KEY,
  INVESTMENT_MIGRATIONS,
} from './migrations/investment';

export const INVESTMENT_KEYS = [
  'investmentPortfolios', 'selectedPortfolioId',
  'investments', 'investmentContributions', 'investmentDividends',
];

const defaults = {
  investmentPortfolios:    [],
  selectedPortfolioId:     null,
  investments:             [],
  investmentContributions: [],
  investmentDividends:     [],
};

export const useInvestmentStore = create(
  persist(
    (set) => ({
      ...defaults,

      setSlice:    (key, val) => set({ [key]: val }),
      mergeSlices: (slices)   => set(slices),
    }),
    {
      name:       'budget_v1',
      version:    INVESTMENT_VERSION,
      storage:    createBudgetStorage(
        INVESTMENT_KEYS,
        INVESTMENT_VERSION_KEY,
        INVESTMENT_VERSION,
        INVESTMENT_MIGRATIONS
      ),
      partialize: (s) => Object.fromEntries(INVESTMENT_KEYS.map(k => [k, s[k]])),
    }
  )
);
