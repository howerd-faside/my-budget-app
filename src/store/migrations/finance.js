/**
 * Versioned migrations for the Finance domain.
 *
 * Version history:
 *   0 → 1  Normalize accounts, backfill legacy currentBalance, initialize missing slices.
 *           Existing data that pre-dates the versioning system is treated as v0.
 *   1 → 2  Coerce numeric fields in assetIncomes (amount) and goals (amount/saved)
 *           to numbers. Any string-typed values stored before this migration are converted.
 *
 * Adding a future v3 migration:
 *   1. Bump FINANCE_VERSION to 3.
 *   2. Append to FINANCE_MIGRATIONS:
 *        { toVersion: 3, description: '…', migrate(slice) { …; return slice; } }
 *   toVersion values must be consecutive integers (1, 2, 3, …) — a gap throws at startup.
 */
import { createDefaultAccounts, normalizeAccount } from '../../models/Account';
import { normalizeAssetIncome }                    from '../../models/Person';

export const FINANCE_VERSION     = 2;
export const FINANCE_VERSION_KEY = '_financeVersion';

export const FINANCE_MIGRATIONS = [
  {
    toVersion:   1,
    description: 'normalize accounts; backfill legacy currentBalance; initialize missing slices',
    /**
     * @param {object} slice  Raw finance slice from localStorage (may be partial).
     * @returns {object}      Normalized finance slice.
     */
    migrate(slice) {
      // Normalize each account, or create defaults if none exist
      if (Array.isArray(slice.accounts) && slice.accounts.length > 0) {
        slice.accounts = slice.accounts.map(normalizeAccount);
      } else {
        slice.accounts = createDefaultAccounts();
      }

      // One-time: backfill from legacy settings.currentBalance into the first account
      // if all accounts are still at zero (pre-multi-account data).
      const allZero = slice.accounts.every(a => (a.balance || 0) === 0);
      if (allZero && (slice.settings?.currentBalance ?? 0) > 0) {
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
    },
  },
  {
    toVersion:   2,
    description: 'coerce numeric fields in assetIncomes and goals to numbers',
    /**
     * @param {object} slice  Finance slice at v1 (may contain string-typed numbers).
     * @returns {object}      Finance slice with all numeric fields as actual numbers.
     */
    migrate(slice) {
      // Coerce assetIncome amounts using the updated normalizer.
      if (Array.isArray(slice.assetIncomes)) {
        slice.assetIncomes = slice.assetIncomes.map(normalizeAssetIncome);
      }

      // Goals have no dedicated model; coerce known numeric fields defensively.
      if (Array.isArray(slice.goals)) {
        slice.goals = slice.goals.map(g => {
          const patched = { ...g };
          if (g.amount !== undefined) {
            const n = parseFloat(g.amount);
            patched.amount = isFinite(n) ? n : 0;
          }
          if (g.saved !== undefined) {
            const n = parseFloat(g.saved);
            patched.saved = isFinite(n) ? n : 0;
          }
          return patched;
        });
      }

      return slice;
    },
  },
];
