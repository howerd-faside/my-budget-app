/**
 * Investment domain store.
 *
 * Owns: investmentPortfolios, selectedPortfolioId, investments,
 *       investmentContributions, investmentDividends,
 *       investmentAssets, investmentTransactions, priceCache
 *
 * Old keys (investments, investmentContributions, investmentDividends) are
 * retained alongside new keys during the transition period. UI pages still
 * read/write old keys; new keys are populated by the v4 migration and will
 * become the primary data source once UI is migrated.
 */
import { create } from 'zustand';
import { persist }  from 'zustand/middleware';
import { createBudgetStorage } from './budgetStorage';
import {
  INVESTMENT_VERSION,
  INVESTMENT_VERSION_KEY,
  INVESTMENT_MIGRATIONS,
} from './migrations/investment';

import type { Portfolio }              from '../models/Portfolio';
import type { Holding }                from '../models/Holding';
import type { InvestmentContribution } from '../models/InvestmentContribution';
import type { Dividend }               from '../models/Dividend';
import type { Asset }                  from '../models/Asset';
import type { InvestmentTransaction }  from '../models/InvestmentTransaction';
import type { PriceEntry }             from '../models/PriceEntry';
import type { WatchlistItem, WatchlistPrice } from '../models/WatchlistItem';

// ── State + Action interfaces ────────────────────────────────────────────────

export interface InvestmentStoreState {
  // Existing keys (retained for backward compatibility)
  investmentPortfolios:    Portfolio[];
  selectedPortfolioId:     string | null;
  investments:             Holding[];
  investmentContributions: InvestmentContribution[];
  investmentDividends:     Dividend[];

  // New keys (v4+)
  investmentAssets:        Asset[];
  investmentTransactions:  InvestmentTransaction[];
  priceCache:              PriceEntry[];

  // Discovery (v6+)
  watchlist:               WatchlistItem[];
  watchlistPrices:         WatchlistPrice[];
}

export interface InvestmentStoreActions {
  setSlice:    <K extends keyof InvestmentStoreState>(key: K, val: InvestmentStoreState[K]) => void;
  mergeSlices: (slices: Partial<InvestmentStoreState>) => void;
}

export type InvestmentStore = InvestmentStoreState & InvestmentStoreActions;

// ── Keys & defaults ──────────────────────────────────────────────────────────

export const INVESTMENT_KEYS: (keyof InvestmentStoreState)[] = [
  'investmentPortfolios', 'selectedPortfolioId',
  'investments', 'investmentContributions', 'investmentDividends',
  'investmentAssets', 'investmentTransactions', 'priceCache',
  'watchlist', 'watchlistPrices',
];

const defaults: InvestmentStoreState = {
  investmentPortfolios:    [],
  selectedPortfolioId:     null,
  investments:             [],
  investmentContributions: [],
  investmentDividends:     [],
  investmentAssets:        [],
  investmentTransactions:  [],
  priceCache:              [],
  watchlist:               [],
  watchlistPrices:         [],
};

// ── Store ────────────────────────────────────────────────────────────────────

export const useInvestmentStore = create<InvestmentStore>()(
  persist(
    (set) => ({
      ...defaults,

      setSlice:    (key, val) => set({ [key]: val } as Partial<InvestmentStoreState>),
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
