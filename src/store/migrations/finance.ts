/**
 * Versioned migrations for the Finance domain.
 *
 * Version history:
 *   0 → 1  Normalize accounts, backfill legacy currentBalance, initialize missing slices.
 *   1 → 2  Coerce numeric fields in assetIncomes and goals to numbers.
 */
import { createDefaultAccounts, normalizeAccount } from '../../models/Account';
import { normalizeAssetIncome }                    from '../../models/Person';
import type { MigrationStep } from '../budgetStorage';

export const FINANCE_VERSION     = 3;
export const FINANCE_VERSION_KEY = '_financeVersion';

export const FINANCE_MIGRATIONS: MigrationStep[] = [
  {
    toVersion:   1,
    description: 'normalize accounts; backfill legacy currentBalance; initialize missing slices',
    migrate(slice: any) {
      if (Array.isArray(slice.accounts) && slice.accounts.length > 0) {
        slice.accounts = slice.accounts.map(normalizeAccount);
      } else {
        slice.accounts = createDefaultAccounts();
      }

      const allZero = slice.accounts.every((a: any) => (a.balance || 0) === 0);
      if (allZero && (slice.settings?.currentBalance ?? 0) > 0) {
        slice.accounts = slice.accounts.map((a: any, i: number) =>
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
    migrate(slice: any) {
      if (Array.isArray(slice.assetIncomes)) {
        slice.assetIncomes = slice.assetIncomes.map(normalizeAssetIncome);
      }

      if (Array.isArray(slice.goals)) {
        slice.goals = slice.goals.map((g: any) => {
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
  {
    toVersion:   3,
    description: 'add lastSettledFortnight for automatic fortnight settlement',
    migrate(slice: any) {
      if (!('lastSettledFortnight' in slice)) {
        slice.lastSettledFortnight = null;
      }
      return slice;
    },
  },
];
