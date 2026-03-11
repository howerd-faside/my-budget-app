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
 * If a migration throws, the pre-migration slice is returned as-is so no
 * valid data is overwritten by defaults.
 * The domain version is stamped into storage on every write.
 *
 * ## Migration chain validation
 * Migration steps must form a contiguous sequence: toVersion values must be
 * 1, 2, 3, … with no gaps. A gap (e.g. [1, 3]) is caught at adapter-creation
 * time so misconfigured migration arrays fail loudly during development rather
 * than silently producing corrupt state at runtime.
 *
 * ## Future-version guard
 * If savedVersion > currentVersion (data was written by a newer version of the
 * app), the slice is returned as-is with a console.warn. Migrations are never
 * run in reverse; the caller receives the raw state and the newer version
 * number so Zustand can still hydrate without crashing.
 *
 * ## Slice isolation
 * setItem only writes keys that belong to the calling store (via sliceKeys).
 * This prevents one store from accidentally clobbering another domain's data.
 *
 * ## removeItem
 * Removes only this domain's slice keys plus its version key from budget_v1.
 * Other domains' data is left intact. If budget_v1 becomes completely empty
 * after removal, the localStorage key itself is deleted.
 *
 * @param {string[]} sliceKeys
 *   The top-level state keys this store owns.
 * @param {string} domainVersionKey
 *   Key used to persist this domain's schema version (e.g. '_financeVersion').
 * @param {number} currentVersion
 *   The current schema version for this domain.
 * @param {Array<{toVersion: number, description?: string, migrate: (slice: object) => object}>} migrations
 *   Ordered migration steps. toVersion must be contiguous starting from 1.
 */
export function createBudgetStorage(sliceKeys, domainVersionKey, currentVersion, migrations) {
  const STORAGE_KEY = 'budget_v1';

  // Validate migration chain at adapter-creation time.
  // Steps must be numbered 1, 2, 3, … — no gaps, no starting at 0 or 2.
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

  /**
   * Parse the full budget_v1 object from localStorage.
   * Returns null when storage is empty or unparseable (signals Zustand to use defaults).
   */
  function readStorageForGet() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.error('[budget] Corrupt budget_v1 payload — cannot parse JSON:', e);
      return null;
    }
  }

  /** Parse for setItem/removeItem merge: returns {} rather than null so spread works safely. */
  function readStorageForSet() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  return {
    getItem(_name) {
      try {
        const full = readStorageForGet();
        if (full === null) return null;

        // Extract only the keys owned by this store
        const slice = {};
        for (const k of sliceKeys) {
          if (k in full) slice[k] = full[k];
        }

        const savedVersion =
          typeof full[domainVersionKey] === 'number' ? full[domainVersionKey] : 0;

        // Guard: data was written by a newer version of the app.
        // Migrations are forward-only; returning as-is preserves data and lets the
        // app hydrate. A console.warn surfaces the mismatch for diagnostics.
        if (savedVersion > currentVersion) {
          console.warn(
            `[budget] ${domainVersionKey}: saved version (${savedVersion}) is newer than ` +
            `supported (${currentVersion}). State loaded as-is — upgrade the app to avoid data issues.`
          );
          return { state: slice, version: savedVersion };
        }

        // Run each migration step that is newer than savedVersion
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
          // Return the raw pre-migration slice so no valid data is replaced by defaults
          return { state: slice, version: savedVersion };
        }

        // Return a parsed object (Zustand v5 PersistStorage interface).
        // The version here must equal the 'version' option on the persist() call
        // so Zustand applies the state directly without attempting its own migration.
        return { state: migrated, version: currentVersion };
      } catch (e) {
        console.error('[budget] getItem failed:', e);
        return null;
      }
    },

    setItem(_name, value) {
      try {
        // Zustand v5 passes a parsed object {state, version}; accept both that
        // and a JSON string (used by direct adapter tests and older call-sites).
        const { state: incoming } = typeof value === 'string' ? JSON.parse(value) : value;

        // Only persist keys that belong to this store
        const safeIncoming = {};
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

    removeItem(_name) {
      // Remove only this domain's keys from the shared budget_v1 object.
      // Other domains' data is preserved. If budget_v1 becomes empty, the key
      // itself is removed from localStorage so a fresh read returns null (Zustand defaults).
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
