/**
 * Versioned migrations for the People domain.
 *
 * Version history:
 *   0 → 1  Normalize people, expenses, and wishlist; backfill missing startDate on
 *           pre-migration expense records; migrate legacy expense type values.
 *           Existing data that pre-dates the versioning system is treated as v0.
 *   1 → 2  Coerce all numeric fields (grossAnnual, amounts, rates, estimatedCost, ddDay,
 *           facility balance/rate/amount) to numbers or null. Re-runs the updated
 *           normalizers against data stored at v1 with string-typed numerics.
 *
 * Adding a future v3 migration:
 *   1. Bump PEOPLE_VERSION to 3.
 *   2. Append to PEOPLE_MIGRATIONS:
 *        { toVersion: 3, description: '…', migrate(slice) { …; return slice; } }
 *   toVersion values must be consecutive integers (1, 2, 3, …) — a gap throws at startup.
 */
import { normalizePerson }       from '../../models/Person';
import { normalizeExpense }      from '../../models/Expense';
import { normalizeWishlistItem } from '../../models/WishlistItem';

export const PEOPLE_VERSION     = 2;
export const PEOPLE_VERSION_KEY = '_peopleVersion';

export const PEOPLE_MIGRATIONS = [
  {
    toVersion:   1,
    description: 'normalize people/expenses/wishlist; backfill missing expense startDate',
    /**
     * @param {object} slice  Raw people slice from localStorage (may be partial).
     * @returns {object}      Normalized people slice.
     */
    migrate(slice) {
      if (Array.isArray(slice.people)) {
        slice.people = slice.people.map(normalizePerson);
      } else {
        slice.people = [];
      }

      if (Array.isArray(slice.expenses)) {
        slice.expenses = slice.expenses.map(e => {
          // Backfill startDate for expenses created before the field was introduced.
          // '2025-11-10' is the original app launch date; pre-migration expenses are
          // conservatively assumed to have been active from that date.
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
    /**
     * @param {object} slice  People slice at v1 (may contain string-typed numbers).
     * @returns {object}      People slice with all numeric fields as actual numbers or null.
     */
    migrate(slice) {
      // Re-run updated normalizers — they now coerce numeric fields to numbers.
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
];
