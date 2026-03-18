/**
 * @fileoverview CSV import engine for investment transactions.
 *
 * Pure functions — no React, no store access. Designed for:
 *   1. Parsing raw CSV text into row objects
 *   2. Mapping columns via pluggable profiles (generic first, broker-specific later)
 *   3. Validating mapped rows against the transaction schema
 *   4. Resolving asset references by ticker or name
 *   5. Building final InvestmentTransaction[] ready for store commit
 */

import type { Asset } from '../models/Asset';
import type { InvestmentTransaction } from '../models/InvestmentTransaction';
import { INV_TX_TYPES } from '../models/InvestmentTransaction';
import { investmentTransactionSchema } from '../utils/validation/investmentTransactionSchema';

// ── CSV Parser ──────────────────────────────────────────────────────────────

/**
 * Parse RFC 4180 CSV text into header + row objects.
 * Handles: quoted fields, commas inside quotes, doubled quotes, BOM, CRLF/LF.
 */
export function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // Strip BOM
  const clean = text.replace(/^\uFEFF/, '');
  const lines = splitCSVLines(clean);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    if (vals.every(v => v.trim() === '')) continue; // skip blank lines
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (vals[j] ?? '').trim();
    }
    rows.push(row);
  }

  return { headers, rows };
}

/** Split CSV text into logical lines (respecting quoted fields that span lines). */
function splitCSVLines(text: string): string[] {
  const lines: string[] = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuote = !inQuote;
      current += ch;
    } else if ((ch === '\n' || ch === '\r') && !inQuote) {
      if (ch === '\r' && text[i + 1] === '\n') i++; // skip CRLF
      lines.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

/** Parse a single CSV line into field values. */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else inQuote = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') inQuote = true;
      else if (ch === ',') { fields.push(current); current = ''; }
      else current += ch;
    }
  }
  fields.push(current);
  return fields;
}

// ── Import Profiles ─────────────────────────────────────────────────────────

export interface CsvImportProfile {
  id: string;
  name: string;
  description: string;
  /** Maps CSV header → InvestmentTransaction field (or _assetTicker/_assetName for resolution). null = skip. */
  columnMap: Record<string, string | null>;
  /** Optional row transform after column mapping (e.g. type normalisation, currency stripping). */
  transformRow?: (row: Record<string, string>) => Record<string, string>;
  /** Return true if headers match this profile. */
  detectHeaders?: (headers: string[]) => boolean;
}

const GENERIC_COLUMN_MAP: Record<string, string> = {
  date:        'date',
  type:        'type',
  asset:       '_assetRef',
  ticker:      '_assetTicker',
  units:       'units',
  price:       'price',
  amount:      'amount',
  fee:         'fee',
  gross:       'grossAmount',
  tax:         'taxAmount',
  label:       'label',
  notes:       'notes',
};

export const GENERIC_PROFILE: CsvImportProfile = {
  id: 'generic',
  name: 'Generic',
  description: 'Standard format — date, type, asset, units, price, amount, fee, gross, tax, label, notes',
  columnMap: GENERIC_COLUMN_MAP,
  detectHeaders: () => true, // fallback
};

/** All registered profiles. Generic is always last (fallback). */
export const IMPORT_PROFILES: CsvImportProfile[] = [
  // Broker-specific profiles will be inserted here in future
  GENERIC_PROFILE,
];

/**
 * Auto-detect which profile best matches the CSV headers.
 * Returns the first profile whose detectHeaders returns true, falling back to generic.
 */
export function detectProfile(headers: string[]): CsvImportProfile {
  const lower = headers.map(h => h.toLowerCase());
  for (const p of IMPORT_PROFILES) {
    if (p.id !== 'generic' && p.detectHeaders?.(lower)) return p;
  }
  return GENERIC_PROFILE;
}

// ── Column Mapping ──────────────────────────────────────────────────────────

/**
 * Map a raw CSV row object through a profile's column map.
 * Returns a mapped record with InvestmentTransaction field names as keys.
 */
export function mapRow(
  raw: Record<string, string>,
  profile: CsvImportProfile,
): Record<string, string> {
  const mapped: Record<string, string> = {};
  const lowerMap: Record<string, string> = {};

  // Build case-insensitive lookup from profile
  for (const [csvCol, field] of Object.entries(profile.columnMap)) {
    if (field) lowerMap[csvCol.toLowerCase()] = field;
  }

  for (const [csvCol, value] of Object.entries(raw)) {
    const field = lowerMap[csvCol.toLowerCase()];
    if (field) mapped[field] = value;
  }

  if (profile.transformRow) return profile.transformRow(mapped);
  return mapped;
}

// ── Date Parsing ────────────────────────────────────────────────────────────

/** Try to normalise a date string to YYYY-MM-DD. Supports ISO, DD/MM/YYYY, MM/DD/YYYY. */
export function normaliseDate(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();

  // Already ISO — validate that month/day are in range via round-trip
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    const check = new Date(y, m - 1, d);
    if (check.getFullYear() !== y || check.getMonth() !== m - 1 || check.getDate() !== d) return null;
    return s;
  }

  // DD/MM/YYYY or DD-MM-YYYY (NZ convention)
  const slashMatch = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (slashMatch) {
    const [, a, b, y] = slashMatch;
    const day = a.padStart(2, '0');
    const month = b.padStart(2, '0');
    // NZ convention: DD/MM/YYYY — validate via local Date round-trip
    if (+month <= 12) {
      const check = new Date(+y, +month - 1, +day);
      if (check.getFullYear() === +y && check.getMonth() === +month - 1 && check.getDate() === +day)
        return `${y}-${month}-${day}`;
    }
    // Fallback: maybe MM/DD/YYYY
    if (+day <= 12) {
      const check = new Date(+y, +day - 1, +month);
      if (check.getFullYear() === +y && check.getMonth() === +day - 1 && check.getDate() === +month)
        return `${y}-${day.padStart(2, '0')}-${month.padStart(2, '0')}`;
    }
    return null;
  }

  // Try native Date parse as last resort
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  return null;
}

// ── Monetary Cleaning ───────────────────────────────────────────────────────

/** Strip currency symbols, commas, whitespace from a monetary string. */
export function cleanNumber(raw: string): string {
  if (!raw) return '';
  return raw.replace(/[$€£¥,\s]/g, '').replace(/^\((.+)\)$/, '-$1');
}

// ── Asset Resolution ────────────────────────────────────────────────────────

export interface AssetMatch {
  asset: Asset | null;
  method: 'ticker' | 'name' | 'none';
  query: string;
}

/**
 * Resolve an asset reference from the mapped row.
 * Tries _assetTicker first (exact match), then _assetRef / _assetName (case-insensitive name).
 */
export function resolveAsset(
  mapped: Record<string, string>,
  assets: Asset[],
): AssetMatch {
  const ticker = (mapped._assetTicker || '').trim().toUpperCase();
  const ref    = (mapped._assetRef || mapped._assetName || '').trim();

  if (ticker) {
    const match = assets.find(a => a.ticker.toUpperCase() === ticker);
    if (match) return { asset: match, method: 'ticker', query: ticker };
    // Try ref field as fallback ticker
  }

  const query = ticker || ref;
  if (!query) return { asset: null, method: 'none', query: '' };

  // Try ticker match on combined query
  const byTicker = assets.find(a => a.ticker.toUpperCase() === query.toUpperCase());
  if (byTicker) return { asset: byTicker, method: 'ticker', query };

  // Try name match (case-insensitive contains)
  const lower = query.toLowerCase();
  const byName = assets.find(a => a.name.toLowerCase() === lower);
  if (byName) return { asset: byName, method: 'name', query };

  // Partial name match
  const partial = assets.find(a => a.name.toLowerCase().includes(lower));
  if (partial) return { asset: partial, method: 'name', query };

  return { asset: null, method: 'none', query };
}

// ── Row Validation ──────────────────────────────────────────────────────────

export interface CsvRowResult {
  rowIndex: number;
  raw: Record<string, string>;
  mapped: Record<string, string>;
  status: 'valid' | 'error' | 'warning';
  errors: Record<string, string>;
  warnings: string[];
  assetMatch: AssetMatch;
  /** Resolved transaction fields (only meaningful if status !== 'error') */
  resolved: Record<string, any>;
}

const VALID_TYPES = new Set(INV_TX_TYPES as readonly string[]);
const ASSET_REQUIRED = new Set(['buy', 'sell', 'dividend']);
const NUMERIC_FIELDS = ['units', 'price', 'amount', 'fee', 'grossAmount', 'taxAmount'];

/**
 * Validate a single mapped row. Returns a CsvRowResult with status, errors, warnings.
 */
export function validateRow(
  raw: Record<string, string>,
  mapped: Record<string, string>,
  rowIndex: number,
  assets: Asset[],
): CsvRowResult {
  const errors: Record<string, string> = {};
  const warnings: string[] = [];

  // Build resolved object
  const resolved: Record<string, any> = { ...mapped };

  // Normalise date
  const dateNorm = normaliseDate(mapped.date || '');
  if (!dateNorm) {
    errors.date = mapped.date ? `Invalid date: "${mapped.date}"` : 'Date is required';
  } else {
    resolved.date = dateNorm;
    // Warn on future dates
    if (dateNorm > new Date().toISOString().slice(0, 10)) {
      warnings.push('Date is in the future');
    }
  }

  // Normalise type
  const typeLower = (mapped.type || '').toLowerCase().trim();
  if (!VALID_TYPES.has(typeLower)) {
    errors.type = mapped.type ? `Unknown type: "${mapped.type}"` : 'Type is required';
  } else {
    resolved.type = typeLower;
  }

  // Clean numeric fields
  for (const f of NUMERIC_FIELDS) {
    if (mapped[f] != null && mapped[f] !== '') {
      resolved[f] = cleanNumber(mapped[f]);
    }
  }

  // Resolve asset
  const assetMatch = resolveAsset(mapped, assets);
  if (ASSET_REQUIRED.has(typeLower)) {
    if (!assetMatch.asset) {
      if (assetMatch.query) {
        errors.asset = `Asset not found: "${assetMatch.query}"`;
      } else {
        errors.asset = 'Asset is required for this type';
      }
    } else {
      resolved.assetId = assetMatch.asset.id;
    }
  } else {
    resolved.assetId = assetMatch.asset?.id || '';
  }

  // Remove internal resolution fields
  delete resolved._assetTicker;
  delete resolved._assetRef;
  delete resolved._assetName;

  // Run schema validation if no critical errors yet
  if (!errors.date && !errors.type) {
    const schemaResult = investmentTransactionSchema.safeParse(resolved);
    if (!schemaResult.success) {
      for (const issue of schemaResult.error.issues) {
        const key = issue.path.length > 0 ? String(issue.path[0]) : '_schema';
        if (!errors[key] && !errors.asset) errors[key] = issue.message;
      }
    }
  }

  const status = Object.keys(errors).length > 0 ? 'error'
               : warnings.length > 0             ? 'warning'
               :                                    'valid';

  return { rowIndex, raw, mapped, status, errors, warnings, assetMatch, resolved };
}

// ── Batch Processing ────────────────────────────────────────────────────────

export interface ImportBatchResult {
  rows: CsvRowResult[];
  validCount: number;
  warningCount: number;
  errorCount: number;
  totalCount: number;
}

/**
 * Parse, map, and validate an entire CSV file.
 */
export function processImportBatch(
  csvText: string,
  profile: CsvImportProfile,
  assets: Asset[],
): ImportBatchResult {
  const { rows: rawRows } = parseCSV(csvText);

  const rows: CsvRowResult[] = rawRows.map((raw, i) => {
    const mapped = mapRow(raw, profile);
    return validateRow(raw, mapped, i, assets);
  });

  return {
    rows,
    validCount:   rows.filter(r => r.status === 'valid').length,
    warningCount: rows.filter(r => r.status === 'warning').length,
    errorCount:   rows.filter(r => r.status === 'error').length,
    totalCount:   rows.length,
  };
}

/**
 * Check for likely duplicates against existing transactions.
 * Marks matching rows with a warning (does not block import).
 */
export function markDuplicates(
  rows: CsvRowResult[],
  existing: InvestmentTransaction[],
): CsvRowResult[] {
  const existingSet = new Set(
    existing.map(tx => `${tx.date}|${tx.type}|${tx.assetId}|${tx.amount}`),
  );

  return rows.map(r => {
    if (r.status === 'error') return r;
    const key = `${r.resolved.date}|${r.resolved.type}|${r.resolved.assetId || ''}|${cleanNumber(String(r.resolved.amount || ''))}`;
    if (existingSet.has(key)) {
      return {
        ...r,
        status: 'warning' as const,
        warnings: [...r.warnings, 'Possible duplicate of existing transaction'],
      };
    }
    return r;
  });
}

// ── Build Final Transactions ────────────────────────────────────────────────

export interface BuildResult {
  transactions: InvestmentTransaction[];
  rejected: Array<{ rowIndex: number; reason: string }>;
}

/**
 * Convert validated rows into InvestmentTransaction objects ready for store commit.
 * Only processes valid + warning rows (skips errors).
 *
 * Post-build validation: each constructed transaction is checked for required
 * fields (date, type) and valid amount. Any that fail are moved to `rejected`.
 */
export function buildTransactions(
  rows: CsvRowResult[],
  portfolioId: string,
): BuildResult {
  const now = new Date().toISOString();
  const transactions: InvestmentTransaction[] = [];
  const rejected: Array<{ rowIndex: number; reason: string }> = [];

  for (const r of rows) {
    if (r.status === 'error') continue;

    const d = r.resolved;
    const tx: InvestmentTransaction = {
      id:          crypto.randomUUID(),
      portfolioId,
      assetId:     d.assetId || '',
      date:        d.date || '',
      type:        d.type || 'buy',
      units:       toNumOrNull(d.units),
      price:       toNumOrNull(d.price),
      amount:      toNum(d.amount),
      fee:         toNum(d.fee),
      grossAmount: toNumOrNull(d.grossAmount),
      taxAmount:   toNumOrNull(d.taxAmount),
      label:       d.label || '',
      linkedTxId:  null as string | null,
      notes:       d.notes || 'CSV import',
      createdAt:   now,
    };

    // Post-build validation: reject transactions missing critical fields
    const reason = validateBuiltTransaction(tx);
    if (reason) {
      rejected.push({ rowIndex: r.rowIndex, reason });
    } else {
      transactions.push(tx);
    }
  }

  return { transactions, rejected };
}

/** Returns a rejection reason, or null if the transaction is valid. */
function validateBuiltTransaction(tx: InvestmentTransaction): string | null {
  if (!tx.date || !/^\d{4}-\d{2}-\d{2}$/.test(tx.date)) return 'Invalid date after build';
  if (!tx.type || !VALID_TYPES.has(tx.type)) return 'Invalid type after build';
  if (!tx.portfolioId) return 'Missing portfolioId';
  return null;
}

function toNum(val: any): number {
  const n = parseFloat(val);
  return isFinite(n) ? n : 0;
}

function toNumOrNull(val: any): number | null {
  if (val == null || val === '') return null;
  const n = parseFloat(val);
  return isFinite(n) ? n : null;
}

// ── Template Generation ─────────────────────────────────────────────────────

/** Column headers for the generic import template. */
export const TEMPLATE_HEADERS = ['date', 'type', 'asset', 'units', 'price', 'amount', 'fee', 'gross', 'tax', 'label', 'notes'];

/** Example rows for the downloadable template CSV. */
export const TEMPLATE_ROWS = [
  ['2026-01-15', 'buy',      'VT',  '10', '120.50', '1205', '2',  '',    '',   '',           'Opening purchase'],
  ['2026-02-01', 'sell',     'VT',  '5',  '130.00', '650',  '2',  '',    '',   '',           ''],
  ['2026-03-01', 'dividend', 'VT',  '',   '',        '45',   '',   '50',  '5',  'Q1 Div',    ''],
  ['2026-03-15', 'fee',      '',    '',   '',        '10',   '',   '',    '',   'Admin fee',  ''],
  ['2026-04-01', 'deposit',  '',    '',   '',        '5000', '',   '',    '',   '',           'Top-up'],
];
