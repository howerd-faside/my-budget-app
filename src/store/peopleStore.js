/**
 * People domain store.
 *
 * Owns: people, expenses, wishlist
 */
import { create } from 'zustand';
import { persist }  from 'zustand/middleware';
import { createBudgetStorage } from './budgetStorage';
import {
  PEOPLE_VERSION,
  PEOPLE_VERSION_KEY,
  PEOPLE_MIGRATIONS,
} from './migrations/people';

export const PEOPLE_KEYS = ['people', 'expenses', 'wishlist'];

const defaults = {
  people:   [],
  expenses: [],
  wishlist: [],
};

export const usePeopleStore = create(
  persist(
    (set) => ({
      ...defaults,

      setSlice:    (key, val) => set({ [key]: val }),
      mergeSlices: (slices)   => set(slices),
    }),
    {
      name:       'budget_v1',
      version:    PEOPLE_VERSION,
      storage:    createBudgetStorage(
        PEOPLE_KEYS,
        PEOPLE_VERSION_KEY,
        PEOPLE_VERSION,
        PEOPLE_MIGRATIONS
      ),
      partialize: (s) => Object.fromEntries(PEOPLE_KEYS.map(k => [k, s[k]])),
    }
  )
);
