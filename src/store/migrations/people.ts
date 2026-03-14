/**
 * Versioned migrations for the People domain.
 *
 * Version history:
 *   0 → 1  Normalize people, expenses, and wishlist; backfill missing startDate.
 *   1 → 2  Coerce all numeric fields to numbers.
 *   2 → 3  Normalize endDate on incomeEvents/employmentHistory from '' to null.
 */
import { normalizePerson }       from '../../models/Person';
import { normalizeExpense }      from '../../models/Expense';
import { normalizeWishlistItem } from '../../models/WishlistItem';
import type { MigrationStep } from '../budgetStorage';

export const PEOPLE_VERSION     = 3;
export const PEOPLE_VERSION_KEY = '_peopleVersion';

export const PEOPLE_MIGRATIONS: MigrationStep[] = [
  {
    toVersion:   1,
    description: 'normalize people/expenses/wishlist; backfill missing expense startDate',
    migrate(slice: any) {
      if (Array.isArray(slice.people)) {
        slice.people = slice.people.map(normalizePerson);
      } else {
        slice.people = [];
      }

      if (Array.isArray(slice.expenses)) {
        slice.expenses = slice.expenses.map((e: any) => {
          const withDate = e.startDate ? e : { ...e, startDate: '2025-11-10' };
          return normalizeExpense(withDate);
        });
      } else {
        slice.expenses = [];
      }

      if (Array.isArray(slice.wishlist)) {
        slice.wishlist = slice.wishlist.map(normalizeWishlistItem);
      } else {
        slice.wishlist = [];
      }

      return slice;
    },
  },
  {
    toVersion:   2,
    description: 'coerce all numeric fields to numbers; normalize estimatedCost/ddDay to number|null',
    migrate(slice: any) {
      if (Array.isArray(slice.people)) {
        slice.people = slice.people.map(normalizePerson);
      }
      if (Array.isArray(slice.expenses)) {
        slice.expenses = slice.expenses.map(normalizeExpense);
      }
      if (Array.isArray(slice.wishlist)) {
        slice.wishlist = slice.wishlist.map(normalizeWishlistItem);
      }
      return slice;
    },
  },
  {
    toVersion:   3,
    description: 'normalize endDate on incomeEvents/employmentHistory from empty string to null',
    migrate(slice: any) {
      if (Array.isArray(slice.people)) {
        slice.people = slice.people.map(normalizePerson);
      }
      return slice;
    },
  },
];
