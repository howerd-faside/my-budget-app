/**
 * Tests for backupContentValidator.ts
 *
 * Covers:
 *   - Clean backup data produces no warnings
 *   - Non-array where array expected produces warning
 *   - Non-object records in arrays produce warnings
 *   - Missing keys produce no warnings (absent = fine)
 *   - Scalar slices with wrong type produce warnings
 *   - All four domains are validated
 *   - Normalizer errors are caught as warnings
 */

import { describe, it, expect } from 'vitest';
import { validateBackupContent } from '../backupContentValidator';

function makeBackup(domainOverrides: Record<string, Record<string, unknown>> = {}) {
  const defaults: Record<string, Record<string, unknown>> = {
    finance:    {},
    people:     {},
    property:   {},
    investment: {},
  };
  const domains: Record<string, { data: Record<string, unknown> }> = {};
  for (const [name, data] of Object.entries(defaults)) {
    domains[name] = { data: { ...data, ...domainOverrides[name] } };
  }
  return { domains };
}

// ── No warnings for valid data ──────────────────────────────────────────────

describe('validateBackupContent — clean data', () => {
  it('returns no warnings for empty domain data', () => {
    const result = validateBackupContent(makeBackup());
    expect(result.warnings).toEqual([]);
  });

  it('returns no warnings for valid array slices', () => {
    const result = validateBackupContent(makeBackup({
      finance: {
        accounts: [{ id: 'a1', name: 'Savings', balance: 5000 }],
        goals: [{ id: 'g1', name: 'Holiday', amount: 3000 }],
        transfers: [{ id: 't1', date: '2026-01-01', fromId: 'a', toId: 'b', amount: 100 }],
        assetIncomes: [],
      },
      people: {
        people: [{ id: 'p1', name: 'Alice', grossAnnual: 80000, taxCode: 'M', kiwiSaverRate: 3, payFrequency: 'fortnightly' }],
        expenses: [{ id: 'e1', name: 'Rent', amount: 1200, frequency: 'monthly' }],
        wishlist: [],
      },
      property: {
        properties: [{ id: 'pr1', name: 'Home', type: 'Primary Home' }],
        propertyTasks: [],
        propertyMaintenance: [],
        propertyProjects: [],
        propertyAssets: [],
        selectedPropertyId: null,
      },
      investment: {
        investmentPortfolios: [{ id: 'pf1', name: 'KiwiSaver' }],
        investmentAssets: [],
        investmentTransactions: [],
        priceCache: [],
        investments: [],
        investmentContributions: [],
        investmentDividends: [],
        selectedPortfolioId: 'pf1',
      },
    }));
    expect(result.warnings).toEqual([]);
  });
});

// ── Array type mismatches ───────────────────────────────────────────────────

describe('validateBackupContent — array type mismatches', () => {
  it('warns when an array slice is a string', () => {
    const result = validateBackupContent(makeBackup({
      finance: { accounts: 'not-an-array' },
    }));
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].domain).toBe('finance');
    expect(result.warnings[0].slice).toBe('accounts');
    expect(result.warnings[0].message).toMatch(/expected array/i);
  });

  it('warns when an array slice is a number', () => {
    const result = validateBackupContent(makeBackup({
      people: { people: 42 },
    }));
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].slice).toBe('people');
  });

  it('warns when an array slice is null', () => {
    const result = validateBackupContent(makeBackup({
      property: { properties: null },
    }));
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toMatch(/null/);
  });

  it('warns when an array slice is an object instead of array', () => {
    const result = validateBackupContent(makeBackup({
      investment: { investmentPortfolios: { id: 'p1', name: 'test' } },
    }));
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toMatch(/expected array/i);
  });
});

// ── Non-object records in arrays ────────────────────────────────────────────

describe('validateBackupContent — non-object records', () => {
  it('warns on string elements in array', () => {
    const result = validateBackupContent(makeBackup({
      finance: { goals: ['not', 'objects'] },
    }));
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toContain('2 of 2');
    expect(result.warnings[0].message).toMatch(/not valid objects/);
  });

  it('warns on null elements in array', () => {
    const result = validateBackupContent(makeBackup({
      people: { expenses: [null, { id: 'e1', name: 'Rent', amount: 100, frequency: 'monthly' }] },
    }));
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toContain('1 of 2');
  });

  it('warns on mixed valid/invalid elements', () => {
    const result = validateBackupContent(makeBackup({
      finance: { accounts: [{ id: 'a1', balance: 100 }, 'bad', 42] },
    }));
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toContain('2 of 3');
  });
});

// ── Missing keys produce no warnings ────────────────────────────────────────

describe('validateBackupContent — absent keys', () => {
  it('produces no warnings for completely empty domain data', () => {
    const result = validateBackupContent(makeBackup());
    expect(result.warnings).toEqual([]);
  });

  it('produces no warnings when only some keys are present', () => {
    const result = validateBackupContent(makeBackup({
      finance: { accounts: [] },
      // people, property, investment: all empty
    }));
    expect(result.warnings).toEqual([]);
  });
});

// ── Scalar slice type checks ────────────────────────────────────────────────

describe('validateBackupContent — scalar slices', () => {
  it('warns when fortnightlyData is not an object', () => {
    const result = validateBackupContent(makeBackup({
      finance: { fortnightlyData: 'bad' },
    }));
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].slice).toBe('fortnightlyData');
  });

  it('warns when settings is an array', () => {
    const result = validateBackupContent(makeBackup({
      finance: { settings: [1, 2, 3] },
    }));
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].slice).toBe('settings');
  });

  it('warns when selectedPropertyId is a number', () => {
    const result = validateBackupContent(makeBackup({
      property: { selectedPropertyId: 42 },
    }));
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].slice).toBe('selectedPropertyId');
  });

  it('accepts null for selectedPropertyId', () => {
    const result = validateBackupContent(makeBackup({
      property: { selectedPropertyId: null },
    }));
    expect(result.warnings).toEqual([]);
  });

  it('accepts string for selectedPortfolioId', () => {
    const result = validateBackupContent(makeBackup({
      investment: { selectedPortfolioId: 'pf1' },
    }));
    expect(result.warnings).toEqual([]);
  });
});

// ── Multiple warnings across domains ────────────────────────────────────────

describe('validateBackupContent — multi-domain warnings', () => {
  it('collects warnings from multiple domains', () => {
    const result = validateBackupContent(makeBackup({
      finance:    { accounts: 'bad' },
      people:     { people: 123 },
      property:   { properties: null },
      investment: { investmentPortfolios: true },
    }));
    expect(result.warnings).toHaveLength(4);
    const domains = result.warnings.map(w => w.domain);
    expect(domains).toContain('finance');
    expect(domains).toContain('people');
    expect(domains).toContain('property');
    expect(domains).toContain('investment');
  });
});

// ── Legacy investment keys ──────────────────────────────────────────────────

describe('validateBackupContent — legacy investment keys', () => {
  it('accepts empty legacy arrays without warnings', () => {
    const result = validateBackupContent(makeBackup({
      investment: {
        investments: [],
        investmentContributions: [],
        investmentDividends: [],
      },
    }));
    expect(result.warnings).toEqual([]);
  });

  it('warns when legacy key is not an array', () => {
    const result = validateBackupContent(makeBackup({
      investment: { investments: 'old-data' },
    }));
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].slice).toBe('investments');
  });
});
