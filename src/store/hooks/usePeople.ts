/**
 * usePeople — domain hook for the people slice.
 *
 * Exposed state:   people, expenses, wishlist
 * Exposed actions: setPeople(key, val), mergePeople(slices)
 */
import { usePeopleStore } from '../peopleStore';

import type { PeopleStoreState } from '../peopleStore';

export interface UsePeopleReturn {
  // State
  people:      PeopleStoreState['people'];
  expenses:    PeopleStoreState['expenses'];
  wishlist:    PeopleStoreState['wishlist'];
  // Actions
  setPeople:   <K extends keyof PeopleStoreState>(key: K, val: PeopleStoreState[K]) => void;
  mergePeople: (slices: Partial<PeopleStoreState>) => void;
}

export function usePeople(): UsePeopleReturn {
  const s = usePeopleStore();
  return {
    // State
    people:      s.people,
    expenses:    s.expenses,
    wishlist:    s.wishlist,
    // Actions
    setPeople:   s.setSlice,
    mergePeople: s.mergeSlices,
  };
}
