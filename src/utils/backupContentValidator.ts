/**
 * @fileoverview Content-level validation for backup data.
 *
 * Complements the structural validation in backup.js by inspecting the actual
 * data within each domain slice. Uses model normalizers as the "can this data
 * be loaded?" check — if normalization runs without throwing, the record is
 * structurally sound (it's what migrations do on hydration).
 *
 * Design decisions:
 *   - Array-type mismatches are hard warnings (e.g. accounts: "string")
 *   - Non-object records in arrays are counted as bad records
 *   - Normalizer failures are counted (though normalizers rarely throw)
 *   - All issues are warnings, not blocking errors — the user can still proceed
 *   - Legacy investment keys are checked for array type only (no deep validation)
 */

import {
  normalizeAccount,
  normalizeExpense,
  normalizeGoal,
  normalizePerson,
  normalizeAssetIncome,
  normalizeProperty,
  normalizePropertyTask,
  normalizePropertyMaintenance,
  normalizePropertyProject,
  normalizePropertyAsset,
  normalizeWishlistItem,
  normalizePortfolio,
  normalizeAsset,
  normalizeInvestmentTransaction,
  normalizePriceEntry,
} from '../models';
import { normalizeWatchlistItem, normalizeWatchlistPrice } from '../models/WatchlistItem';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ContentWarning {
  domain: string;
  slice: string;
  message: string;
}

export interface ContentValidationResult {
  warnings: ContentWarning[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

/** Validate a single array slice: check type, check each element is an object, try normalizer. */
function checkArraySlice(
  data: Record<string, unknown>,
  key: string,
  domain: string,
  normalizeFn?: (raw: any) => unknown,
): ContentWarning[] {
  if (!(key in data)) return []; // absent = fine, migration fills defaults

  const val = data[key];
  if (!Array.isArray(val)) {
    return [{
      domain,
      slice: key,
      message: `Expected array, got ${val === null ? 'null' : typeof val}`,
    }];
  }

  let nonObjectCount = 0;
  let normalizeFailCount = 0;

  for (const item of val) {
    if (!isPlainObject(item)) {
      nonObjectCount++;
      continue;
    }
    if (normalizeFn) {
      try {
        normalizeFn(item);
      } catch {
        normalizeFailCount++;
      }
    }
  }

  const warnings: ContentWarning[] = [];
  if (nonObjectCount > 0) {
    warnings.push({
      domain,
      slice: key,
      message: `${nonObjectCount} of ${val.length} record(s) are not valid objects`,
    });
  }
  if (normalizeFailCount > 0) {
    warnings.push({
      domain,
      slice: key,
      message: `${normalizeFailCount} of ${val.length} record(s) failed normalization`,
    });
  }
  return warnings;
}

/** Validate a scalar or object slice (not an array). */
function checkScalarSlice(
  data: Record<string, unknown>,
  key: string,
  domain: string,
  expectedType: 'object' | 'string-or-null',
): ContentWarning[] {
  if (!(key in data)) return [];

  const val = data[key];

  if (expectedType === 'object') {
    if (!isPlainObject(val)) {
      return [{
        domain,
        slice: key,
        message: `Expected object, got ${val === null ? 'null' : Array.isArray(val) ? 'array' : typeof val}`,
      }];
    }
  }

  if (expectedType === 'string-or-null') {
    if (val !== null && typeof val !== 'string') {
      return [{
        domain,
        slice: key,
        message: `Expected string or null, got ${typeof val}`,
      }];
    }
  }

  return [];
}

// ── Domain validators ──────────────────────────────────────────────────────────

function validateFinance(data: Record<string, unknown>): ContentWarning[] {
  return [
    ...checkArraySlice(data, 'accounts',     'finance', normalizeAccount),
    ...checkArraySlice(data, 'transfers',    'finance'), // no normalizer exists
    ...checkArraySlice(data, 'goals',        'finance', normalizeGoal),
    ...checkArraySlice(data, 'assetIncomes', 'finance', normalizeAssetIncome),
    ...checkScalarSlice(data, 'fortnightlyData', 'finance', 'object'),
    ...checkScalarSlice(data, 'settings',        'finance', 'object'),
  ];
}

function validatePeople(data: Record<string, unknown>): ContentWarning[] {
  return [
    ...checkArraySlice(data, 'people',   'people', normalizePerson),
    ...checkArraySlice(data, 'expenses', 'people', normalizeExpense),
    ...checkArraySlice(data, 'wishlist', 'people', normalizeWishlistItem),
  ];
}

function validateProperty(data: Record<string, unknown>): ContentWarning[] {
  return [
    ...checkArraySlice(data, 'properties',          'property', normalizeProperty),
    ...checkArraySlice(data, 'propertyTasks',       'property', normalizePropertyTask),
    ...checkArraySlice(data, 'propertyMaintenance', 'property', normalizePropertyMaintenance),
    ...checkArraySlice(data, 'propertyProjects',    'property', normalizePropertyProject),
    ...checkArraySlice(data, 'propertyAssets',      'property', normalizePropertyAsset),
    ...checkScalarSlice(data, 'selectedPropertyId', 'property', 'string-or-null'),
  ];
}

function validateInvestment(data: Record<string, unknown>): ContentWarning[] {
  return [
    ...checkArraySlice(data, 'investmentPortfolios',   'investment', normalizePortfolio),
    ...checkArraySlice(data, 'investmentAssets',        'investment', normalizeAsset),
    ...checkArraySlice(data, 'investmentTransactions',  'investment', normalizeInvestmentTransaction),
    ...checkArraySlice(data, 'priceCache',              'investment', normalizePriceEntry),
    ...checkArraySlice(data, 'watchlist',               'investment', normalizeWatchlistItem),
    ...checkArraySlice(data, 'watchlistPrices',         'investment', normalizeWatchlistPrice),
    // Legacy keys — array type check only, no deep validation
    ...checkArraySlice(data, 'investments',             'investment'),
    ...checkArraySlice(data, 'investmentContributions', 'investment'),
    ...checkArraySlice(data, 'investmentDividends',     'investment'),
    ...checkScalarSlice(data, 'selectedPortfolioId',    'investment', 'string-or-null'),
  ];
}

// ── Public API ─────────────────────────────────────────────────────────────────

const DOMAIN_VALIDATORS: Record<string, (data: Record<string, unknown>) => ContentWarning[]> = {
  finance:    validateFinance,
  people:     validatePeople,
  property:   validateProperty,
  investment: validateInvestment,
};

/**
 * Validate the content of a structurally-valid backup.
 *
 * Call this AFTER validateBackup() returns ok:true. Inspects the actual data
 * within each domain slice for type mismatches and normalization issues.
 *
 * Returns warnings (non-blocking) — the user can still proceed with restore.
 */
export function validateBackupContent(
  backup: { domains: Record<string, { data: Record<string, unknown> }> },
): ContentValidationResult {
  const warnings: ContentWarning[] = [];

  for (const [domainName, validator] of Object.entries(DOMAIN_VALIDATORS)) {
    const domainEntry = backup.domains[domainName];
    if (!domainEntry?.data) continue;
    warnings.push(...validator(domainEntry.data as Record<string, unknown>));
  }

  return { warnings };
}
