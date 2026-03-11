/**
 * Shared Zustand storage adapter for all domain stores.
 *
 * All stores read/write to the single 'budget_v1' localStorage key but each
 * only touches its own slice of keys. This means:
 *  - Existing data is preserved without any migration step.
 *  - Stores stay in sync through the shared key.
 *  - Data written by one store is always visible to others on next read.
 *
 * @param {string[]} sliceKeys  The top-level state keys this store owns.
 * @param {(slice: object) => object} [migrateFn]  Optional normalisation applied on load.
 */
export function createBudgetStorage(sliceKeys, migrateFn) {
  const STORAGE_KEY = 'budget_v1';

  return {
    getItem(_name) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const full = JSON.parse(raw);

        // Extract only the keys that belong to this store
        const slice = {};
        sliceKeys.forEach(k => { if (k in full) slice[k] = full[k]; });

        const migrated = migrateFn ? migrateFn(slice) : slice;
        // Zustand persist expects { state: {...}, version: number }
        return JSON.stringify({ state: migrated, version: 0 });
      } catch {
        return null;
      }
    },

    setItem(_name, value) {
      try {
        const { state: incoming } = JSON.parse(value);
        const raw     = localStorage.getItem(STORAGE_KEY);
        const current = raw ? JSON.parse(raw) : {};
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...incoming }));
      } catch {
        // Silently ignore storage errors
      }
    },

    removeItem(_name) {
      // No-op: we never want to nuke the whole budget_v1 key from a single store.
    },
  };
}
