/**
 * People domain store.
 *
 * Owns: people, expenses, wishlist
 */
import { create } from 'zustand';
import { persist }  from 'zustand/middleware';
import { normalizePerson }      from '../models/Person';
import { normalizeExpense }     from '../models/Expense';
import { normalizeWishlistItem } from '../models/WishlistItem';
import { createBudgetStorage }  from './budgetStorage';

export const PEOPLE_KEYS = ['people', 'expenses', 'wishlist'];

const defaults = {
  people:   [],
  expenses: [],
  wishlist: [],
};

function migratePeople(slice) {
  if (slice.people) {
    slice.people = slice.people.map(normalizePerson);
  } else {
    slice.people = [];
  }

  if (slice.expenses) {
    slice.expenses = slice.expenses.map(e => {
      // Backfill startDate for pre-migration records
      const withDate = e.startDate ? e : { ...e, startDate: '2025-11-10' };
      return normalizeExpense(withDate);
    });
  } else {
    slice.expenses = [];
  }

  if (slice.wishlist) {
    slice.wishlist = slice.wishlist.map(normalizeWishlistItem);
  } else {
    slice.wishlist = [];
  }

  return slice;
}

export const usePeopleStore = create(
  persist(
    (set) => ({
      ...defaults,

      setSlice:    (key, val) => set({ [key]: val }),
      mergeSlices: (slices)   => set(slices),
    }),
    {
      name:       'budget_v1',
      storage:    createBudgetStorage(PEOPLE_KEYS, migratePeople),
      partialize: (s) => Object.fromEntries(PEOPLE_KEYS.map(k => [k, s[k]])),
    }
  )
);
