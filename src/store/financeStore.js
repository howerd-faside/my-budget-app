/**
 * Finance domain store.
 *
 * Owns: accounts, transfers, fortnightlyData, goals, assetIncomes, settings
 */
import { create } from 'zustand';
import { persist }  from 'zustand/middleware';
import { createDefaultAccounts, normalizeAccount } from '../models/Account';
import { createBudgetStorage } from './budgetStorage';

export const FINANCE_KEYS = [
  'accounts', 'transfers', 'fortnightlyData', 'goals', 'assetIncomes', 'settings',
];

function uid()   { return Math.random().toString(36).slice(2, 9); }
function today() { return new Date().toISOString().slice(0, 10); }

const defaults = {
  accounts:        createDefaultAccounts(),
  transfers:       [],
  fortnightlyData: {},
  goals:           [],
  assetIncomes:    [],
  settings:        { currentBalance: 0 },   // legacy — kept for migrate only
};

function migrateFinance(slice) {
  // Normalise accounts
  if (slice.accounts && Array.isArray(slice.accounts) && slice.accounts.length > 0) {
    slice.accounts = slice.accounts.map(normalizeAccount);
  } else {
    slice.accounts = createDefaultAccounts();
  }

  // Backfill from legacy currentBalance if all accounts are zero
  const allZero = slice.accounts.every(a => (a.balance || 0) === 0);
  if (allZero && slice.settings?.currentBalance > 0) {
    slice.accounts = slice.accounts.map((a, i) =>
      i === 0 ? { ...a, balance: slice.settings.currentBalance } : a
    );
  }

  if (!slice.transfers)       slice.transfers       = [];
  if (!slice.fortnightlyData) slice.fortnightlyData = {};
  if (!slice.goals)           slice.goals           = [];
  if (!slice.assetIncomes)    slice.assetIncomes    = [];
  if (!slice.settings)        slice.settings        = { currentBalance: 0 };

  return slice;
}

export const useFinanceStore = create(
  persist(
    (set) => ({
      ...defaults,

      // Generic slice setter used by the bridge
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
          const tx = { id: uid(), date: today(), fromId, toId, amount: amt, note };
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
      storage:    createBudgetStorage(FINANCE_KEYS, migrateFinance),
      partialize: (s) => Object.fromEntries(FINANCE_KEYS.map(k => [k, s[k]])),
    }
  )
);
