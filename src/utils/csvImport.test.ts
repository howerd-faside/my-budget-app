/**
 * Unit tests for the CSV import engine (csvImport.ts).
 *
 * Covers: parser, column mapping, date normalisation, number cleaning,
 * asset resolution, row validation, batch processing, duplicate detection,
 * transaction building, and template generation.
 */
import { describe, it, expect } from 'vitest';
import {
  parseCSV,
  detectProfile,
  mapRow,
  normaliseDate,
  cleanNumber,
  resolveAsset,
  validateRow,
  processImportBatch,
  markDuplicates,
  buildTransactions,
  GENERIC_PROFILE,
  IMPORT_PROFILES,
  TEMPLATE_HEADERS,
  TEMPLATE_ROWS,
} from './csvImport';
import type { Asset } from '../models/Asset';
import type { InvestmentTransaction } from '../models/InvestmentTransaction';
import type { CsvRowResult } from './csvImport';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'a1',
    portfolioId: 'p1',
    name: 'Vanguard Total World',
    ticker: 'VT',
    platform: 'Hatch',
    category: 'ETF',
    currency: 'NZD',
    notes: '',
    createdAt: '2026-01-01',
    ...overrides,
  } as Asset;
}

// ── parseCSV ─────────────────────────────────────────────────────────────────

describe('parseCSV', () => {
  it('parses simple CSV', () => {
    const { headers, rows } = parseCSV('date,type,amount\n2026-01-01,buy,100');
    expect(headers).toEqual(['date', 'type', 'amount']);
    expect(rows).toEqual([{ date: '2026-01-01', type: 'buy', amount: '100' }]);
  });

  it('handles quoted fields with commas', () => {
    const { rows } = parseCSV('name,value\n"Smith, John",100');
    expect(rows[0].name).toBe('Smith, John');
  });

  it('handles doubled quotes', () => {
    const { rows } = parseCSV('notes\n"He said ""hello""."');
    expect(rows[0].notes).toBe('He said "hello".');
  });

  it('handles CRLF line endings', () => {
    const { headers, rows } = parseCSV('a,b\r\n1,2\r\n3,4');
    expect(headers).toEqual(['a', 'b']);
    expect(rows).toHaveLength(2);
  });

  it('strips BOM', () => {
    const { headers } = parseCSV('\uFEFFdate,type');
    expect(headers[0]).toBe('date');
  });

  it('skips blank rows', () => {
    const { rows } = parseCSV('a,b\n1,2\n,\n3,4');
    expect(rows).toHaveLength(2);
  });

  it('returns empty for empty input', () => {
    const { headers, rows } = parseCSV('');
    expect(headers).toEqual([]);
    expect(rows).toEqual([]);
  });

  it('handles multiline quoted fields', () => {
    const { rows } = parseCSV('notes\n"line1\nline2"');
    expect(rows[0].notes).toBe('line1\nline2');
  });
});

// ── normaliseDate ────────────────────────────────────────────────────────────

describe('normaliseDate', () => {
  it('passes through ISO dates', () => {
    expect(normaliseDate('2026-03-15')).toBe('2026-03-15');
  });

  it('converts DD/MM/YYYY (NZ format)', () => {
    expect(normaliseDate('15/03/2026')).toBe('2026-03-15');
  });

  it('converts DD-MM-YYYY', () => {
    expect(normaliseDate('15-03-2026')).toBe('2026-03-15');
  });

  it('converts DD.MM.YYYY', () => {
    expect(normaliseDate('15.03.2026')).toBe('2026-03-15');
  });

  it('handles single-digit day/month', () => {
    expect(normaliseDate('5/3/2026')).toBe('2026-03-05');
  });

  it('returns null for empty string', () => {
    expect(normaliseDate('')).toBeNull();
  });

  it('returns null for garbage', () => {
    expect(normaliseDate('not-a-date')).toBeNull();
  });

  it('trims whitespace', () => {
    expect(normaliseDate('  2026-01-01  ')).toBe('2026-01-01');
  });
});

// ── cleanNumber ──────────────────────────────────────────────────────────────

describe('cleanNumber', () => {
  it('strips dollar sign', () => {
    expect(cleanNumber('$1,200.50')).toBe('1200.50');
  });

  it('strips euro sign', () => {
    expect(cleanNumber('€500')).toBe('500');
  });

  it('converts parenthetical negatives', () => {
    expect(cleanNumber('(100.00)')).toBe('-100.00');
  });

  it('strips whitespace', () => {
    expect(cleanNumber(' 1 000 ')).toBe('1000');
  });

  it('returns empty for empty input', () => {
    expect(cleanNumber('')).toBe('');
  });
});

// ── mapRow ────────────────────────────────────────────────────────────────────

describe('mapRow', () => {
  it('maps generic profile columns case-insensitively', () => {
    const raw = { Date: '2026-01-01', Type: 'buy', Amount: '100', Ticker: 'VT' };
    const mapped = mapRow(raw, GENERIC_PROFILE);
    expect(mapped.date).toBe('2026-01-01');
    expect(mapped.type).toBe('buy');
    expect(mapped.amount).toBe('100');
    expect(mapped._assetTicker).toBe('VT');
  });

  it('skips unmapped columns', () => {
    const raw = { Date: '2026-01-01', RandomCol: 'ignored' };
    const mapped = mapRow(raw, GENERIC_PROFILE);
    expect(mapped.date).toBe('2026-01-01');
    expect(mapped.RandomCol).toBeUndefined();
  });
});

// ── resolveAsset ─────────────────────────────────────────────────────────────

describe('resolveAsset', () => {
  const assets = [
    makeAsset({ id: 'a1', name: 'Vanguard Total World', ticker: 'VT' }),
    makeAsset({ id: 'a2', name: 'Fisher Funds Growth', ticker: 'FFG' }),
  ];

  it('resolves by ticker (exact match)', () => {
    const result = resolveAsset({ _assetTicker: 'VT' }, assets);
    expect(result.asset?.id).toBe('a1');
    expect(result.method).toBe('ticker');
  });

  it('resolves by ticker case-insensitively', () => {
    const result = resolveAsset({ _assetTicker: 'vt' }, assets);
    expect(result.asset?.id).toBe('a1');
  });

  it('resolves by exact name', () => {
    const result = resolveAsset({ _assetRef: 'Fisher Funds Growth' }, assets);
    expect(result.asset?.id).toBe('a2');
    expect(result.method).toBe('name');
  });

  it('resolves by partial name', () => {
    const result = resolveAsset({ _assetRef: 'Vanguard' }, assets);
    expect(result.asset?.id).toBe('a1');
    expect(result.method).toBe('name');
  });

  it('returns null for no match', () => {
    const result = resolveAsset({ _assetTicker: 'XYZ' }, assets);
    expect(result.asset).toBeNull();
    expect(result.method).toBe('none');
  });

  it('returns none method for empty input', () => {
    const result = resolveAsset({}, assets);
    expect(result.method).toBe('none');
    expect(result.query).toBe('');
  });
});

// ── validateRow ──────────────────────────────────────────────────────────────

describe('validateRow', () => {
  const assets = [makeAsset()];

  it('validates a complete buy row as valid', () => {
    const mapped = {
      date: '2026-01-15', type: 'buy', _assetTicker: 'VT',
      units: '10', price: '100', amount: '1000',
    };
    const result = validateRow({}, mapped, 0, assets);
    expect(result.status).toBe('valid');
    expect(result.resolved.date).toBe('2026-01-15');
    expect(result.resolved.assetId).toBe('a1');
  });

  it('returns error for missing date', () => {
    const mapped = { type: 'buy', _assetTicker: 'VT', units: '10', price: '100', amount: '1000' };
    const result = validateRow({}, mapped, 0, assets);
    expect(result.status).toBe('error');
    expect(result.errors.date).toBeDefined();
  });

  it('returns error for invalid type', () => {
    const mapped = { date: '2026-01-15', type: 'purchase', amount: '100' };
    const result = validateRow({}, mapped, 0, assets);
    expect(result.status).toBe('error');
    expect(result.errors.type).toBeDefined();
  });

  it('returns error when asset not found for buy', () => {
    const mapped = {
      date: '2026-01-15', type: 'buy', _assetTicker: 'NOPE',
      units: '10', price: '100', amount: '1000',
    };
    const result = validateRow({}, mapped, 0, assets);
    expect(result.status).toBe('error');
    expect(result.errors.asset).toContain('not found');
  });

  it('allows deposit without asset', () => {
    const mapped = { date: '2026-01-15', type: 'deposit', amount: '5000' };
    const result = validateRow({}, mapped, 0, assets);
    // Should not have asset error
    expect(result.errors.asset).toBeUndefined();
  });

  it('warns on future dates', () => {
    const futureDate = '2099-12-31';
    const mapped = { date: futureDate, type: 'deposit', amount: '100' };
    const result = validateRow({}, mapped, 0, assets);
    expect(result.warnings).toContain('Date is in the future');
  });

  it('cleans monetary values', () => {
    const mapped = {
      date: '2026-01-15', type: 'fee', amount: '$25.00', fee: '$2.50',
    };
    const result = validateRow({}, mapped, 0, assets);
    expect(result.resolved.amount).toBe('25.00');
    expect(result.resolved.fee).toBe('2.50');
  });
});

// ── processImportBatch ───────────────────────────────────────────────────────

describe('processImportBatch', () => {
  const assets = [makeAsset()];
  const csv = `date,type,ticker,units,price,amount
2026-01-15,buy,VT,10,100,1000
2026-02-01,sell,VT,5,120,600
,badtype,,,, `;

  it('processes a batch and returns counts', () => {
    const result = processImportBatch(csv, GENERIC_PROFILE, assets);
    expect(result.totalCount).toBe(3);
    // Row 1 & 2 should be valid, row 3 has errors (no date + bad type)
    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.validCount).toBeGreaterThan(0);
  });

  it('returns empty for empty CSV', () => {
    const result = processImportBatch('', GENERIC_PROFILE, assets);
    expect(result.totalCount).toBe(0);
  });
});

// ── markDuplicates ───────────────────────────────────────────────────────────

describe('markDuplicates', () => {
  it('marks matching rows as warnings', () => {
    const existing: InvestmentTransaction[] = [{
      id: 'tx1', portfolioId: 'p1', assetId: 'a1',
      date: '2026-01-15', type: 'buy', units: 10, price: 100,
      amount: 1000, fee: 0, grossAmount: null, taxAmount: null,
      label: '', linkedTxId: null, notes: '', createdAt: '2026-01-15',
    }];

    const rows: CsvRowResult[] = [{
      rowIndex: 0, raw: {}, mapped: {},
      status: 'valid', errors: {}, warnings: [],
      assetMatch: { asset: null, method: 'none', query: '' },
      resolved: { date: '2026-01-15', type: 'buy', assetId: 'a1', amount: '1000' },
    }];

    const result = markDuplicates(rows, existing);
    expect(result[0].status).toBe('warning');
    expect(result[0].warnings).toContain('Possible duplicate of existing transaction');
  });

  it('does not mark error rows', () => {
    const rows: CsvRowResult[] = [{
      rowIndex: 0, raw: {}, mapped: {},
      status: 'error', errors: { date: 'Missing' }, warnings: [],
      assetMatch: { asset: null, method: 'none', query: '' },
      resolved: {},
    }];

    const result = markDuplicates(rows, []);
    expect(result[0].status).toBe('error');
  });
});

// ── buildTransactions ────────────────────────────────────────────────────────

describe('buildTransactions', () => {
  it('builds transactions from valid rows, skipping errors', () => {
    const rows: CsvRowResult[] = [
      {
        rowIndex: 0, raw: {}, mapped: {},
        status: 'valid', errors: {}, warnings: [],
        assetMatch: { asset: null, method: 'none', query: '' },
        resolved: { date: '2026-01-15', type: 'buy', assetId: 'a1', units: '10', price: '100', amount: '1000', fee: '2' },
      },
      {
        rowIndex: 1, raw: {}, mapped: {},
        status: 'error', errors: { date: 'bad' }, warnings: [],
        assetMatch: { asset: null, method: 'none', query: '' },
        resolved: {},
      },
      {
        rowIndex: 2, raw: {}, mapped: {},
        status: 'warning', errors: {}, warnings: ['Possible duplicate'],
        assetMatch: { asset: null, method: 'none', query: '' },
        resolved: { date: '2026-02-01', type: 'deposit', amount: '5000' },
      },
    ];

    const result = buildTransactions(rows, 'p1');
    expect(result.transactions).toHaveLength(2); // valid + warning, not error
    expect(result.rejected).toHaveLength(0);
    expect(result.transactions[0].portfolioId).toBe('p1');
    expect(result.transactions[0].date).toBe('2026-01-15');
    expect(result.transactions[0].amount).toBe(1000);
    expect(result.transactions[0].fee).toBe(2);
    expect(result.transactions[0].id).toBeTruthy();
    expect(result.transactions[1].type).toBe('deposit');
    expect(result.transactions[1].amount).toBe(5000);
  });

  it('rejects transactions that fail post-build validation', () => {
    const rows: CsvRowResult[] = [
      {
        rowIndex: 0, raw: {}, mapped: {},
        status: 'valid', errors: {}, warnings: [],
        assetMatch: { asset: null, method: 'none', query: '' },
        // Missing date — should be rejected post-build
        resolved: { type: 'buy', amount: '100' },
      },
    ];
    const result = buildTransactions(rows, 'p1');
    expect(result.transactions).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toMatch(/date/i);
  });
});

// ── detectProfile ────────────────────────────────────────────────────────────

describe('detectProfile', () => {
  it('falls back to generic when no broker profiles match', () => {
    const profile = detectProfile(['date', 'type', 'amount']);
    expect(profile.id).toBe('generic');
  });
});

// ── Template constants ───────────────────────────────────────────────────────

describe('template', () => {
  it('has consistent header and row lengths', () => {
    for (const row of TEMPLATE_ROWS) {
      expect(row.length).toBe(TEMPLATE_HEADERS.length);
    }
  });

  it('template headers include essential columns', () => {
    expect(TEMPLATE_HEADERS).toContain('date');
    expect(TEMPLATE_HEADERS).toContain('type');
    expect(TEMPLATE_HEADERS).toContain('amount');
  });
});
