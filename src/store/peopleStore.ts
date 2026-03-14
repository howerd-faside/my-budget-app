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

import type { Person }       from '../models/Person';
import type { Expense }      from '../models/Expense';
import type { WishlistItem } from '../models/WishlistItem';

// ── State + Action interfaces ────────────────────────────────────────────────

export interface PeopleStoreState {
  people:   Person[];
  expenses: Expense[];
  wishlist: WishlistItem[];
}

export interface PeopleStoreActions {
  setSlice:    <K extends keyof PeopleStoreState>(key: K, val: PeopleStoreState[K]) => void;
  mergeSlices: (slices: Partial<PeopleStoreState>) => void;
}

export type PeopleStore = PeopleStoreState & PeopleStoreActions;

// ── Keys & defaults ──────────────────────────────────────────────────────────

export const PEOPLE_KEYS: (keyof PeopleStoreState)[] = ['people', 'expenses', 'wishlist'];

const defaults: PeopleStoreState = {
  people:   [],
  expenses: [],
  wishlist: [],
};

// ── Store ────────────────────────────────────────────────────────────────────

export const usePeopleStore = create<PeopleStore>()(
  persist(
    (set) => ({
      ...defaults,

      setSlice:    (key, val) => set({ [key]: val } as Partial<PeopleStoreState>),
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
