// @vitest-environment jsdom
/**
 * Backup round-trip integration tests.
 *
 * These tests run in jsdom so localStorage is available.
 *
 * Covers:
 *   - exportBackup: packages current localStorage state into a valid backup object
 *   - validateBackup: accepts the exported backup
 *   - applyBackup: writes the backup to localStorage
 *   - Round-trip: export → apply → restored state matches original
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exportBackup, validateBackup, applyBackup } from '../../utils/backup';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

/** Minimal well-formed budget_v1 localStorage payload */
function makeStoredState(overrides = {}) {
  return {
    accounts:            [{ id: 'main', name: 'Savings', balance: 5000 }],
    transfers:           [],
    fortnightlyData:     {},
    goals:               [],
    assetIncomes:        [],
    _financeVersion:     2,
    people:              [],
    expenses:            [],
    wishlist:            [],
    _peopleVersion:      1,
    properties:          [],
    propertyTasks:       [],
    propertyMaintenance: [],
    propertyProjects:    [],
    propertyAssets:      [],
    selectedPropertyId:  null,
    _propertyVersion:    1,
    investmentPortfolios:    [],
    selectedPortfolioId:     null,
    investments:             [],
    investmentContributions: [],
    investmentDividends:     [],
    _investmentVersion:  1,
    ...overrides,
  };
}

describe('Backup — exportBackup', () => {
  it('returns ok=true and a well-formed backup when data exists', () => {
    localStorage.setItem('budget_v1', JSON.stringify(makeStoredState()));
    const result = exportBackup();
    expect(result.ok).toBe(true);
    expect(result.backup.formatVersion).toBe(1);
    expect(result.backup.appVersion).toBe('budget_v1');
    expect(result.backup.exportedAt).toBeTruthy();
    expect(result.backup.domains).toHaveProperty('finance');
    expect(result.backup.domains).toHaveProperty('people');
    expect(result.backup.domains).toHaveProperty('property');
    expect(result.backup.domains).toHaveProperty('investment');
  });

  it('includes account balance in exported finance domain', () => {
    localStorage.setItem('budget_v1', JSON.stringify(makeStoredState({ accounts: [{ id: 'main', name: 'Savings', balance: 9876 }] })));
    const { backup } = exportBackup();
    expect(backup.domains.finance.data.accounts[0].balance).toBe(9876);
  });
});

describe('Backup — validateBackup', () => {
  it('accepts a backup produced by exportBackup', () => {
    localStorage.setItem('budget_v1', JSON.stringify(makeStoredState()));
    const { backup } = exportBackup();
    const result = validateBackup(backup);
    expect(result.ok).toBe(true);
  });

  it('rejects a non-object', () => {
    expect(validateBackup(null).ok).toBe(false);
    expect(validateBackup('string').ok).toBe(false);
    expect(validateBackup([]).ok).toBe(false);
  });

  it('rejects a backup with wrong formatVersion', () => {
    localStorage.setItem('budget_v1', JSON.stringify(makeStoredState()));
    const { backup } = exportBackup();
    const tampered = { ...backup, formatVersion: 99 };
    expect(validateBackup(tampered).ok).toBe(false);
  });
});

describe('Backup — applyBackup', () => {
  it('writes domain slices to localStorage', () => {
    const backup = {
      formatVersion: 1,
      appVersion: 'budget_v1',
      exportedAt: new Date().toISOString(),
      domains: {
        finance:    { version: 2, data: { accounts: [{ id: 'main', name: 'Savings', balance: 7777 }], transfers: [], fortnightlyData: {}, goals: [], assetIncomes: [] } },
        people:     { version: 1, data: { people: [], expenses: [], wishlist: [] } },
        property:   { version: 1, data: { properties: [], propertyTasks: [], propertyMaintenance: [], propertyProjects: [], propertyAssets: [], selectedPropertyId: null } },
        investment: { version: 1, data: { investmentPortfolios: [], selectedPortfolioId: null, investments: [], investmentContributions: [], investmentDividends: [] } },
      },
    };

    const result = applyBackup(backup);
    expect(result.ok).toBe(true);

    const stored = JSON.parse(localStorage.getItem('budget_v1'));
    expect(stored.accounts[0].balance).toBe(7777);
  });

  it('returns ok=false when applyBackup is called with invalid data', () => {
    const result = applyBackup(null);
    expect(result.ok).toBe(false);
  });
});

describe('Backup — round-trip', () => {
  it('export → validate → apply produces state identical to original', () => {
    const original = makeStoredState({
      accounts:  [{ id: 'main', name: 'Savings', balance: 12345 }],
      transfers: [{ id: 'tx1', date: '2026-01-01', fromId: 'main', toId: 'emergency', amount: 500, note: '' }],
      goals:     [{ id: 'g1', name: 'Holiday', amount: 5000, targetDate: '2026-12-01', saved: 0, notes: '' }],
    });
    localStorage.setItem('budget_v1', JSON.stringify(original));

    // Export
    const { ok: expOk, backup } = exportBackup();
    expect(expOk).toBe(true);

    // Validate
    const { ok: valOk } = validateBackup(backup);
    expect(valOk).toBe(true);

    // Clear and restore
    localStorage.removeItem('budget_v1');
    const { ok: applyOk } = applyBackup(backup);
    expect(applyOk).toBe(true);

    // Verify key fields are restored
    const restored = JSON.parse(localStorage.getItem('budget_v1'));
    expect(restored.accounts[0].balance).toBe(12345);
    expect(restored.transfers[0].id).toBe('tx1');
    expect(restored.goals[0].name).toBe('Holiday');
  });
});
