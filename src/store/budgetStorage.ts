/**
 * Shared Zustand storage adapter for all domain stores.
 *
 * All stores share the single 'budget_v1' localStorage key but each only
 * touches its own slice of keys.
 *
 * ## Versioning strategy
 * Each domain stores its schema version in a dedicated key within budget_v1:
 *   _financeVersion, _peopleVersion, _propertyVersion, _investmentVersion
 *
 * Absent version field = 0 (pre-versioning legacy data).
 * Migrations run incrementally: savedVersion → currentVersion on every read.
 */

export interface MigrationStep {
  toVersion: number;
  description?: string;
  migrate: (slice: any) => any;
}

export function createBudgetStorage(sliceKeys: string[], domainVersionKey: string, currentVersion: number, migrations: MigrationStep[]) {
  const STORAGE_KEY = 'budget_v1';

  // Validate migration chain at adapter-creation time.
  for (let i = 0; i < migrations.length; i++) {
    const expected = i + 1;
    if (migrations[i].toVersion !== expected) {
      throw new Error(
        `[budget] ${domainVersionKey}: migration chain gap — ` +
        `expected toVersion ${expected}, got ${migrations[i].toVersion}. ` +
        `Each step must be numbered consecutively from 1.`
      );
    }
  }

  function readStorageForGet(): any | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.error('[budget] Corrupt budget_v1 payload — cannot parse JSON:', e);
      return null;
    }
  }

  function readStorageForSet(): any {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  return {
    getItem(_name: string) {
      try {
        const full = readStorageForGet();
        if (full === null) return null;

        const slice: any = {};
        for (const k of sliceKeys) {
          if (k in full) slice[k] = full[k];
        }

        const savedVersion =
          typeof full[domainVersionKey] === 'number' ? full[domainVersionKey] : 0;

        if (savedVersion > currentVersion) {
          console.warn(
            `[budget] ${domainVersionKey}: saved version (${savedVersion}) is newer than ` +
            `supported (${currentVersion}). State loaded as-is — upgrade the app to avoid data issues.`
          );
          return { state: slice, version: savedVersion };
        }

        let migrated = slice;
        let v = savedVersion;
        try {
          for (const step of migrations) {
            if (v < step.toVersion) {
              migrated = step.migrate(migrated);
              const label = step.description ? ` (${step.description})` : '';
              console.info(
                `[budget] ${domainVersionKey}: v${v} → v${step.toVersion}${label}`
              );
              v = step.toVersion;
            }
          }
        } catch (e) {
          console.error(
            `[budget] Migration failed for ${domainVersionKey} at v${v}:`,
            e,
            '— returning pre-migration data'
          );
          return { state: slice, version: savedVersion };
        }

        return { state: migrated, version: currentVersion };
      } catch (e) {
        console.error('[budget] getItem failed:', e);
        return null;
      }
    },

    setItem(_name: string, value: any) {
      try {
        const { state: incoming } = typeof value === 'string' ? JSON.parse(value) : value;

        const safeIncoming: any = {};
        for (const k of sliceKeys) {
          if (k in incoming) safeIncoming[k] = incoming[k];
        }

        const current = readStorageForSet();
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            ...current,
            ...safeIncoming,
            [domainVersionKey]: currentVersion,
          })
        );
      } catch (e) {
        console.error('[budget] setItem failed:', e);
      }
    },

    removeItem(_name: string) {
      try {
        const current = readStorageForSet();
        for (const k of sliceKeys) {
          delete current[k];
        }
        delete current[domainVersionKey];
        if (Object.keys(current).length === 0) {
          localStorage.removeItem(STORAGE_KEY);
        } else {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
        }
      } catch (e) {
        console.error('[budget] removeItem failed:', e);
      }
    },
  };
}
