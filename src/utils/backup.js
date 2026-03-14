/**
 * Backup utilities — export, validate, and restore all persisted app data.
 *
 * ## Backup format (formatVersion: 1)
 * {
 *   formatVersion: 1,           // bump if backup structure changes
 *   appVersion:    'budget_v1', // identifies the storage schema family
 *   exportedAt:    ISO8601,     // human-readable, helps the user identify the file
 *   domains: {
 *     finance:    { version: number, data: { accounts, transfers, … } },
 *     people:     { version: number, data: { people, expenses, wishlist } },
 *     property:   { version: number, data: { properties, … } },
 *     investment: { version: number, data: { investmentPortfolios, … } },
 *   }
 * }
 *
 * ## Restore strategy
 * applyBackup() writes the raw domain data (with original version numbers) directly
 * to localStorage, then the caller reloads the page. On the next boot Zustand runs
 * the normal hydration + migration path, so older backups are automatically
 * migrated to the current schema.
 *
 * ## Atomicity
 * applyBackup() assembles the full budget_v1 object in memory and calls
 * localStorage.setItem exactly once. If that call throws (quota exceeded, etc.)
 * the old data is untouched.
 */

// Import only from migration files — these are pure constants/functions with no
// side effects. We intentionally do NOT import from the *Store.js files because
// those modules create Zustand store singletons at module-evaluation time, which
// would attempt to read localStorage before any test mocks are in place.
import { FINANCE_VERSION,    FINANCE_VERSION_KEY }    from '../store/migrations/finance';
import { PEOPLE_VERSION,     PEOPLE_VERSION_KEY }     from '../store/migrations/people';
import { PROPERTY_VERSION,   PROPERTY_VERSION_KEY }   from '../store/migrations/property';
import { INVESTMENT_VERSION, INVESTMENT_VERSION_KEY } from '../store/migrations/investment';
import { today } from './finance/dates';

// Slice keys mirror the FINANCE_KEYS / PEOPLE_KEYS / … arrays in each store file.
// They are kept in sync manually because importing them from the store files
// would trigger Zustand store creation as a side effect.
const FINANCE_KEYS    = ['accounts', 'transfers', 'fortnightlyData', 'goals', 'assetIncomes', 'settings'];
const PEOPLE_KEYS     = ['people', 'expenses', 'wishlist'];
const PROPERTY_KEYS   = ['properties', 'propertyTasks', 'propertyMaintenance', 'propertyProjects', 'propertyAssets', 'selectedPropertyId'];
const INVESTMENT_KEYS = ['investmentPortfolios', 'selectedPortfolioId', 'investments', 'investmentContributions', 'investmentDividends'];

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY    = 'budget_v1';
const FORMAT_VERSION = 1;
const APP_VERSION    = 'budget_v1';

/**
 * Per-domain metadata: which localStorage keys the domain owns, which key
 * stores its schema version, and what the current schema version is.
 */
export const DOMAIN_META = {
  finance: {
    sliceKeys:      FINANCE_KEYS,
    versionKey:     FINANCE_VERSION_KEY,
    currentVersion: FINANCE_VERSION,
  },
  people: {
    sliceKeys:      PEOPLE_KEYS,
    versionKey:     PEOPLE_VERSION_KEY,
    currentVersion: PEOPLE_VERSION,
  },
  property: {
    sliceKeys:      PROPERTY_KEYS,
    versionKey:     PROPERTY_VERSION_KEY,
    currentVersion: PROPERTY_VERSION,
  },
  investment: {
    sliceKeys:      INVESTMENT_KEYS,
    versionKey:     INVESTMENT_VERSION_KEY,
    currentVersion: INVESTMENT_VERSION,
  },
};

// ── Export ────────────────────────────────────────────────────────────────────

/**
 * Read all persisted app data from localStorage and package it as a backup object.
 *
 * @returns {{ ok: true, backup: object } | { ok: false, error: string }}
 */
export function exportBackup() {
  try {
    let stored = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) stored = JSON.parse(raw);
    } catch {
      // Corrupt JSON — treat as empty storage so export still succeeds with
      // empty domains rather than surfacing an unhelpful parse error.
    }

    const domains = {};
    for (const [name, meta] of Object.entries(DOMAIN_META)) {
      const data = {};
      for (const k of meta.sliceKeys) {
        if (k in stored) data[k] = stored[k];
      }
      const version =
        typeof stored[meta.versionKey] === 'number' ? stored[meta.versionKey] : 0;
      domains[name] = { version, data };
    }

    const backup = {
      formatVersion: FORMAT_VERSION,
      appVersion:    APP_VERSION,
      exportedAt:    new Date().toISOString(),
      domains,
    };

    return { ok: true, backup };
  } catch (e) {
    return { ok: false, error: `Export failed: ${e.message}` };
  }
}

/**
 * Trigger a browser file download for a backup object.
 *
 * @param {object} backup  A backup payload (from exportBackup).
 */
export function downloadBackup(backup) {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = today();
  a.href     = url;
  a.download = `faside-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate a parsed backup payload before applying it.
 *
 * Checks:
 *  - Is a plain object with the expected top-level fields
 *  - formatVersion matches what this app understands
 *  - appVersion identifies the correct storage family
 *  - domains is a non-empty object
 *  - Every domain in the backup is a known domain
 *  - Every known domain is present (no partial restores)
 *  - Each domain entry has a valid non-negative integer version
 *  - Each domain's version is not newer than the app supports
 *  - Each domain's data is a plain object containing only allowed keys
 *
 * @param {unknown} parsed  The result of JSON.parse() on a backup file.
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateBackup(parsed) {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Backup file is not a valid JSON object.' };
  }

  if (parsed.formatVersion !== FORMAT_VERSION) {
    return {
      ok: false,
      error: `Unsupported backup format version: ${parsed.formatVersion}. Expected ${FORMAT_VERSION}.`,
    };
  }

  if (parsed.appVersion !== APP_VERSION) {
    return {
      ok: false,
      error: `Incompatible app identifier: "${parsed.appVersion}". Expected "${APP_VERSION}".`,
    };
  }

  if (!parsed.exportedAt || typeof parsed.exportedAt !== 'string') {
    return { ok: false, error: 'Backup is missing exportedAt timestamp.' };
  }

  if (
    typeof parsed.domains !== 'object' ||
    parsed.domains === null ||
    Array.isArray(parsed.domains)
  ) {
    return { ok: false, error: 'Backup is missing a valid domains object.' };
  }

  const domainNames = Object.keys(parsed.domains);
  if (domainNames.length === 0) {
    return { ok: false, error: 'Backup contains no domain data.' };
  }

  // Reject any unknown domains so a tampered/wrong file is caught early
  for (const name of domainNames) {
    if (!(name in DOMAIN_META)) {
      return { ok: false, error: `Backup contains unknown domain: "${name}".` };
    }
  }

  // Every known domain must be present — we don't support partial restores
  for (const name of Object.keys(DOMAIN_META)) {
    if (!(name in parsed.domains)) {
      return {
        ok: false,
        error: `Backup is missing domain "${name}". This may be an incomplete backup.`,
      };
    }
  }

  // Per-domain structural checks
  for (const name of domainNames) {
    const entry = parsed.domains[name];
    const meta  = DOMAIN_META[name];

    if (typeof entry !== 'object' || entry === null) {
      return { ok: false, error: `Domain "${name}" entry is not a valid object.` };
    }

    if (
      typeof entry.version !== 'number' ||
      !Number.isInteger(entry.version) ||
      entry.version < 0
    ) {
      return {
        ok: false,
        error: `Domain "${name}" has an invalid version value: ${JSON.stringify(entry.version)}.`,
      };
    }

    // Reject backups from a newer app version this build can't migrate
    if (entry.version > meta.currentVersion) {
      return {
        ok: false,
        error:
          `Domain "${name}" was saved by a newer version of the app ` +
          `(backup v${entry.version}, this app supports up to v${meta.currentVersion}). ` +
          `Update the app to restore this backup.`,
      };
    }

    if (
      typeof entry.data !== 'object' ||
      entry.data === null ||
      Array.isArray(entry.data)
    ) {
      return {
        ok: false,
        error: `Domain "${name}" data must be a plain object.`,
      };
    }

    // Reject spurious keys — only the domain's own slice keys are allowed
    const allowed = new Set(meta.sliceKeys);
    for (const k of Object.keys(entry.data)) {
      if (!allowed.has(k)) {
        return {
          ok: false,
          error: `Domain "${name}" contains unexpected key: "${k}".`,
        };
      }
    }
  }

  return { ok: true };
}

// ── Restore ───────────────────────────────────────────────────────────────────

/**
 * Write a validated backup's domain data to localStorage.
 *
 * The backup's original version numbers are preserved so Zustand's migration
 * system upgrades the data to the current schema on the next boot (the same
 * path as a normal app start with old data).
 *
 * Call validateBackup() before this function — this function trusts that the
 * payload is structurally valid.
 *
 * After a successful return the caller should reload the page so Zustand
 * re-hydrates from the new localStorage state.
 *
 * @param {object} backup  A validated backup payload.
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function applyBackup(backup) {
  try {
    // Build the complete budget_v1 object in memory before touching storage.
    // This means either the whole write succeeds or the old data is untouched.
    const restored = {};

    for (const [name, meta] of Object.entries(DOMAIN_META)) {
      const entry = backup.domains[name];
      if (!entry) continue;

      // Slice data
      Object.assign(restored, entry.data);

      // Version key — tells the migration system where to start
      restored[meta.versionKey] = entry.version;
    }

    // Single atomic write
    localStorage.setItem(STORAGE_KEY, JSON.stringify(restored));

    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Restore failed: ${e.message}` };
  }
}
