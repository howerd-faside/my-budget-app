/**
 * usePeople — domain hook for the people slice.
 *
 * Exposed state:   people, expenses, wishlist
 * Exposed actions: setPeople(key, val), mergePeople(slices)
 */
import { usePeopleStore } from '../peopleStore';

export function usePeople() {
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
