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

export const FINANCE_KEYS = [
  'accounts', 'transfers', 'fortnightlyData', 'goals', 'assetIncomes', 'settings',
];

const defaults = {
  accounts:        createDefaultAccounts(),
  transfers:       [],
  fortnightlyData: {},
  goals:           [],
  assetIncomes:    [],
  settings:        { currentBalance: 0 },   // legacy — kept for migrate only
};

export const useFinanceStore = create(
  persist(
    (set) => ({
      ...defaults,

      setSlice:    (key, val) => set({ [key]: val }),
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
          const tx = {
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
