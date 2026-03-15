/**
 * Tests for src/store/migrations/finance.js
 *
 * Covers:
 *   - v0 → v1: normalizes accounts
 *   - v0 → v1: backfills legacy currentBalance into first account
 *   - v0 → v1: does NOT overwrite non-zero account balances
 *   - v0 → v1: creates default accounts when slice.accounts is missing
 *   - v0 → v1: initializes all missing slices to empty defaults
 *   - v0 → v1: preserves existing non-empty slices
 *   - v2 → v3: adds lastSettledFortnight field
 */
import { describe, it, expect } from 'vitest';
import { FINANCE_MIGRATIONS } from '../migrations/finance';

const migrateV1 = FINANCE_MIGRATIONS.find(m => m.toVersion === 1).migrate;

describe('finance migration v0 → v1', () => {
  it('normalizes accounts: coerces balance strings to numbers', () => {
    const slice = {
      accounts: [{ id: 'main', name: 'Savings', balance: '1500' }],
    };
    const result = migrateV1(slice);
    expect(result.accounts[0].balance).toBe(1500);
    expect(typeof result.accounts[0].balance).toBe('number');
  });

  it('backfills legacy currentBalance into first account when all balances are zero', () => {
    const slice = {
      accounts: [
        { id: 'main',      name: 'Savings',   balance: 0 },
        { id: 'emergency', name: 'Emergency', balance: 0 },
      ],
      settings: { currentBalance: 5000 },
    };
    const result = migrateV1(slice);
    expect(result.accounts[0].balance).toBe(5000);
    expect(result.accounts[1].balance).toBe(0);
  });

  it('does NOT backfill when accounts already have non-zero balances', () => {
    const slice = {
      accounts: [
        { id: 'main', name: 'Savings', balance: 3000 },
      ],
      settings: { currentBalance: 9999 },
    };
    const result = migrateV1(slice);
    expect(result.accounts[0].balance).toBe(3000); // untouched
  });

  it('creates default accounts when accounts is missing', () => {
    const result = migrateV1({});
    expect(Array.isArray(result.accounts)).toBe(true);
    expect(result.accounts.length).toBeGreaterThan(0);
    expect(result.accounts[0].id).toBe('main');
  });

  it('creates default accounts when accounts is an empty array', () => {
    const result = migrateV1({ accounts: [] });
    expect(result.accounts[0].id).toBe('main');
  });

  it('initializes transfers to [] when missing', () => {
    const result = migrateV1({ accounts: [] });
    expect(result.transfers).toEqual([]);
  });

  it('initializes fortnightlyData to {} when missing', () => {
    const result = migrateV1({ accounts: [] });
    expect(result.fortnightlyData).toEqual({});
  });

  it('initializes goals to [] when missing', () => {
    const result = migrateV1({ accounts: [] });
    expect(result.goals).toEqual([]);
  });

  it('initializes assetIncomes to [] when missing', () => {
    const result = migrateV1({ accounts: [] });
    expect(result.assetIncomes).toEqual([]);
  });

  it('preserves existing non-empty transfers', () => {
    const transfers = [{ id: 'x', amount: 100 }];
    const result = migrateV1({ accounts: [], transfers });
    expect(result.transfers).toEqual(transfers);
  });

  it('preserves existing non-empty goals', () => {
    const goals = [{ id: 'g1', name: 'Holiday fund', amount: 5000 }];
    const result = migrateV1({ accounts: [], goals });
    expect(result.goals).toEqual(goals);
  });

  it('initializes settings when missing', () => {
    const result = migrateV1({ accounts: [] });
    expect(result.settings).toEqual({ currentBalance: 0 });
  });

  it('preserves existing settings', () => {
    const result = migrateV1({ accounts: [], settings: { currentBalance: 100 } });
    expect(result.settings.currentBalance).toBe(100);
  });
});

// ── v2 → v3 ───────────────────────────────────────────────────────────────────

const migrateV3 = FINANCE_MIGRATIONS.find(m => m.toVersion === 3).migrate;

describe('finance migration v2 → v3', () => {
  it('adds lastSettledFortnight as null when missing', () => {
    const slice = { accounts: [{ id: 'main', balance: 1000 }] };
    const result = migrateV3(slice);
    expect(result.lastSettledFortnight).toBeNull();
  });

  it('preserves an existing lastSettledFortnight value', () => {
    const existing = { year: 2026, idx: 4 };
    const slice = { lastSettledFortnight: existing };
    const result = migrateV3(slice);
    expect(result.lastSettledFortnight).toEqual(existing);
  });

  it('does not alter other slice keys', () => {
    const slice = {
      accounts: [{ id: 'main', balance: 500 }],
      goals: [{ id: 'g1' }],
    };
    const result = migrateV3(slice);
    expect(result.accounts[0].balance).toBe(500);
    expect(result.goals).toEqual([{ id: 'g1' }]);
  });
});
