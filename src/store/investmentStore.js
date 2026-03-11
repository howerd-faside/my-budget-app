/**
 * Investment domain store.
 *
 * Owns: investmentPortfolios, selectedPortfolioId, investments,
 *       investmentContributions, investmentDividends
 */
import { create } from 'zustand';
import { persist }  from 'zustand/middleware';
import { createBudgetStorage } from './budgetStorage';

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

function migrateInvestment(slice) {
  if (!slice.investmentPortfolios)    slice.investmentPortfolios    = [];
  if (!('selectedPortfolioId' in slice)) slice.selectedPortfolioId  = null;
  if (!slice.investments)             slice.investments             = [];
  if (!slice.investmentContributions) slice.investmentContributions = [];
  if (!slice.investmentDividends)     slice.investmentDividends     = [];
  return slice;
}

export const useInvestmentStore = create(
  persist(
    (set) => ({
      ...defaults,

      setSlice:    (key, val) => set({ [key]: val }),
      mergeSlices: (slices)   => set(slices),
    }),
    {
      name:       'budget_v1',
      storage:    createBudgetStorage(INVESTMENT_KEYS, migrateInvestment),
      partialize: (s) => Object.fromEntries(INVESTMENT_KEYS.map(k => [k, s[k]])),
    }
  )
);
