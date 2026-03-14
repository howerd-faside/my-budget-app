/**
 * Finance domain store.
 *
 * Owns: accounts, transfers, fortnightlyData, goals, assetIncomes, settings
 */
import { create } from 'zustand';
import { persist }  from 'zustand/middleware';
import { createDefaultAccounts } from '../models/Account';
import { createBudgetStorage }   from './budgetStorage';
import {
  FINANCE_VERSION,
  FINANCE_VERSION_KEY,
  FINANCE_MIGRATIONS,
} from './migrations/finance';
import { today } from '../utils/finance/dates';

import type { Account }         from '../models/Account';
import type { Transfer }        from '../models/Transaction';
import type { Goal }            from '../models/Goal';
import type { AssetIncome }     from '../models/Person';
import type { FortnightlyData, FortnightData } from '../models/FortnightlyData';

// ── State + Action interfaces ────────────────────────────────────────────────

export interface FinanceStoreState {
  accounts:        Account[];
  transfers:       Transfer[];
  fortnightlyData: FortnightlyData;
  goals:           Goal[];
  assetIncomes:    AssetIncome[];
  settings:        { currentBalance: number };
}

export interface FinanceStoreActions {
  setSlice:        <K extends keyof FinanceStoreState>(key: K, val: FinanceStoreState[K]) => void;
  mergeSlices:     (slices: Partial<FinanceStoreState>) => void;
  updateFortnight: (year: number, idx: number, data: Partial<FortnightData>) => void;
  updateAccount:   (id: string, balance: number | string) => void;
  addTransfer:     (params: { fromId: string; toId: string; amount: number | string; note?: string }) => void;
  removeTransfer:  (txId: string) => void;
}

export type FinanceStore = FinanceStoreState & FinanceStoreActions;

// ── Keys & defaults ──────────────────────────────────────────────────────────

export const FINANCE_KEYS: (keyof FinanceStoreState)[] = [
  'accounts', 'transfers', 'fortnightlyData', 'goals', 'assetIncomes', 'settings',
];

const defaults: FinanceStoreState = {
  accounts:        createDefaultAccounts(),
  transfers:       [],
  fortnightlyData: {},
  goals:           [],
  assetIncomes:    [],
  settings:        { currentBalance: 0 },
};

// ── Store ────────────────────────────────────────────────────────────────────

export const useFinanceStore = create<FinanceStore>()(
  persist(
    (set) => ({
      ...defaults,

      setSlice:    (key, val) => set({ [key]: val } as Partial<FinanceStoreState>),
      mergeSlices: (slices)   => set(slices),

      updateFortnight(year, idx, data) {
        set(s => {
          const yd = s.fortnightlyData[year] || { fortnights: {} };
          return {
            fortnightlyData: {
              ...s.fortnightlyData,
              [year]: {
                ...yd,
                fortnights: {
                  ...yd.fortnights,
                  [idx]: { ...(yd.fortnights[idx] || { adhocTransactions: [] }), ...data },
                },
              },
            },
          };
        });
      },

      updateAccount(id, balance) {
        set(s => ({
          accounts: s.accounts.map(a => a.id === id ? { ...a, balance: +balance } : a),
        }));
      },

      addTransfer({ fromId, toId, amount, note = '' }) {
        const amt = +amount;
        if (!amt || amt <= 0) return;
        set(s => {
          const tx: Transfer = {
            id:     crypto.randomUUID(),
            date:   today(),
            fromId,
            toId,
            amount: amt,
            note,
          };
          return {
            transfers: [...s.transfers, tx],
            accounts: s.accounts.map(a =>
              a.id === fromId ? { ...a, balance: (a.balance || 0) - amt } :
              a.id === toId   ? { ...a, balance: (a.balance || 0) + amt } : a
            ),
          };
        });
      },

      removeTransfer(txId) {
        set(s => {
          const tx = s.transfers.find(t => t.id === txId);
          if (!tx) return s;
          return {
            transfers: s.transfers.filter(t => t.id !== txId),
            accounts: s.accounts.map(a =>
              a.id === tx.fromId ? { ...a, balance: (a.balance || 0) + tx.amount } :
              a.id === tx.toId   ? { ...a, balance: (a.balance || 0) - tx.amount } : a
            ),
          };
        });
      },
    }),
    {
      name:       'budget_v1',
      version:    FINANCE_VERSION,
      storage:    createBudgetStorage(
        FINANCE_KEYS,
        FINANCE_VERSION_KEY,
        FINANCE_VERSION,
        FINANCE_MIGRATIONS
      ),
      partialize: (s) => Object.fromEntries(FINANCE_KEYS.map(k => [k, s[k]])),
    }
  )
);
