/**
 * Tests for src/store/budgetStorage.js
 *
 * Covers:
 *   - Read from empty storage → null
 *   - Read from corrupt JSON → null (with logged error)
 *   - getItem returns a parsed object (not a JSON string) — Zustand v5 interface
 *   - Read extracts only owned slice keys
 *   - Migration runs when savedVersion < currentVersion
 *   - Migration failure returns pre-migration data (does not default)
 *   - setItem (JSON string) merges into existing data, stamps version, filters keys
 *   - setItem (plain object) — Zustand v5 calling convention, same behaviour
 *   - removeItem clears only this domain's keys from budget_v1
 *   - Future-version guard: savedVersion > currentVersion → warn + return as-is
 *   - Migration chain validation: gaps throw at creation time
 *   - v1 → v2 migration flow
 *   - Partial domain payloads (missing keys are not injected as undefined)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createBudgetStorage } from '../budgetStorage';

// ── localStorage mock ────────────────────────────────────────────────────────

const store = new Map();
const localStorageMock = {
  getItem:    (k)    => store.get(k) ?? null,
  setItem:    (k, v) => store.set(k, v),
  removeItem: (k)    => store.delete(k),
  clear:      ()     => store.clear(),
};
global.localStorage = localStorageMock;

const KEY = 'budget_v1';

function readStorage() {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : {};
}

function writeStorage(obj) {
  localStorage.setItem(KEY, JSON.stringify(obj));
}

beforeEach(() => store.clear());

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeStorage(sliceKeys = ['a', 'b'], versionKey = '_testVersion', version = 1, migrations = []) {
  return createBudgetStorage(sliceKeys, versionKey, version, migrations);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getItem', () => {
  it('returns null when storage is empty', () => {
    const s = makeStorage();
    expect(s.getItem('_')).toBeNull();
  });

  it('returns null when JSON is corrupt', () => {
    localStorage.setItem(KEY, '{not valid json');
    const s = makeStorage();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = s.getItem('_');
    expect(result).toBeNull();
    spy.mockRestore();
  });

  it('returns a parsed object, not a JSON string (Zustand v5 interface)', () => {
    writeStorage({ a: 1, _testVersion: 1 });
    const s = makeStorage(['a'], '_testVersion', 1, []);
    const result = s.getItem('_');
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect(typeof result.state).toBe('object');
  });

  it('extracts only owned slice keys from storage', () => {
    writeStorage({ a: 1, b: 2, c: 99, _testVersion: 1 });
    const s = makeStorage(['a', 'b'], '_testVersion', 1, []);
    const result = s.getItem('_');
    expect(result.state).toEqual({ a: 1, b: 2 });
    expect(result.state).not.toHaveProperty('c');
  });

  it('returns state with correct version when no migration needed', () => {
    writeStorage({ a: 10, _testVersion: 1 });
    const s = makeStorage(['a'], '_testVersion', 1, []);
    const result = s.getItem('_');
    expect(result.version).toBe(1);
    expect(result.state.a).toBe(10);
  });

  it('runs migration when savedVersion < currentVersion', () => {
    writeStorage({ a: 'original' }); // no version key → savedVersion = 0
    const migration = {
      toVersion: 1,
      migrate: (slice) => ({ ...slice, a: 'migrated' }),
    };
    const s = makeStorage(['a'], '_testVersion', 1, [migration]);
    const result = s.getItem('_');
    expect(result.state.a).toBe('migrated');
    expect(result.version).toBe(1);
  });

  it('does not run migration when savedVersion === currentVersion', () => {
    writeStorage({ a: 'original', _testVersion: 1 });
    const migrateFn = vi.fn((s) => s);
    const s = makeStorage(['a'], '_testVersion', 1, [{ toVersion: 1, migrate: migrateFn }]);
    s.getItem('_');
    expect(migrateFn).not.toHaveBeenCalled();
  });

  it('runs multiple migrations in sequence (v0 → v1 → v2)', () => {
    writeStorage({ value: 0 }); // v0
    const migrations = [
      { toVersion: 1, migrate: (s) => ({ ...s, value: s.value + 10 }) },
      { toVersion: 2, migrate: (s) => ({ ...s, value: s.value * 3 }) },
    ];
    const s = makeStorage(['value'], '_testVersion', 2, migrations);
    const result = s.getItem('_');
    expect(result.state.value).toBe(30); // (0 + 10) * 3
    expect(result.version).toBe(2);
  });

  it('skips already-applied steps in a v1 → v2 upgrade', () => {
    writeStorage({ value: 10, _testVersion: 1 }); // already at v1
    const step1 = vi.fn((s) => ({ ...s, value: s.value + 10 }));
    const step2 = vi.fn((s) => ({ ...s, value: s.value * 3 }));
    const s = makeStorage(['value'], '_testVersion', 2, [
      { toVersion: 1, migrate: step1 },
      { toVersion: 2, migrate: step2 },
    ]);
    s.getItem('_');
    expect(step1).not.toHaveBeenCalled();
    expect(step2).toHaveBeenCalledOnce();
    // v1 value (10) × 3 = 30
    const result = s.getItem('_');
    expect(result.state.value).toBe(30);
    expect(result.version).toBe(2);
  });

  it('returns pre-migration data (not defaults) when migration throws', () => {
    writeStorage({ a: 'valuable-data' }); // v0, no version key
    const badMigration = {
      toVersion: 1,
      migrate: () => { throw new Error('oops'); },
    };
    const s = makeStorage(['a'], '_testVersion', 1, [badMigration]);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = s.getItem('_');
    // Must return the original data, not null or defaults
    expect(result.state.a).toBe('valuable-data');
    spy.mockRestore();
  });
});

// ── setItem: JSON string input (direct / backwards-compat) ───────────────────

describe('setItem (JSON string input)', () => {
  it('writes state to budget_v1', () => {
    const s = makeStorage(['x'], '_testVersion', 1, []);
    s.setItem('_', JSON.stringify({ state: { x: 42 }, version: 1 }));
    const saved = readStorage();
    expect(saved.x).toBe(42);
  });

  it('stamps the domain version key on write', () => {
    const s = makeStorage(['x'], '_myVersion', 3, []);
    s.setItem('_', JSON.stringify({ state: { x: 1 }, version: 3 }));
    const saved = readStorage();
    expect(saved._myVersion).toBe(3);
  });

  it('merges into existing storage without overwriting other slices', () => {
    writeStorage({ people: ['alice'], x: 99 });
    const s = makeStorage(['x'], '_testVersion', 1, []);
    s.setItem('_', JSON.stringify({ state: { x: 7 }, version: 1 }));
    const saved = readStorage();
    expect(saved.x).toBe(7);
    expect(saved.people).toEqual(['alice']); // preserved
  });

  it('only writes owned slice keys (not extra keys from incoming state)', () => {
    const s = makeStorage(['a'], '_testVersion', 1, []);
    s.setItem('_', JSON.stringify({ state: { a: 1, b: 'foreign' }, version: 1 }));
    const saved = readStorage();
    expect(saved.a).toBe(1);
    expect(saved).not.toHaveProperty('b');
  });

  it('gracefully handles corrupt incoming value without throwing', () => {
    const s = makeStorage(['a'], '_testVersion', 1, []);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => s.setItem('_', 'not-json')).not.toThrow();
    spy.mockRestore();
  });
});

// ── setItem: plain object input (Zustand v5 calling convention) ───────────────

describe('setItem (plain object input — Zustand v5)', () => {
  it('writes state to budget_v1', () => {
    const s = makeStorage(['x'], '_testVersion', 1, []);
    s.setItem('_', { state: { x: 99 }, version: 1 });
    const saved = readStorage();
    expect(saved.x).toBe(99);
  });

  it('stamps the domain version key on write', () => {
    const s = makeStorage(['x'], '_myVersion', 2, []);
    s.setItem('_', { state: { x: 5 }, version: 2 });
    const saved = readStorage();
    expect(saved._myVersion).toBe(2);
  });

  it('merges object-input write with existing slices from other domains', () => {
    writeStorage({ people: ['bob'], x: 0 });
    const s = makeStorage(['x'], '_testVersion', 1, []);
    s.setItem('_', { state: { x: 55 }, version: 1 });
    const saved = readStorage();
    expect(saved.x).toBe(55);
    expect(saved.people).toEqual(['bob']); // untouched
  });

  it('only writes owned keys even when extra keys are present in state', () => {
    const s = makeStorage(['a'], '_testVersion', 1, []);
    s.setItem('_', { state: { a: 10, z: 'foreign' }, version: 1 });
    const saved = readStorage();
    expect(saved.a).toBe(10);
    expect(saved).not.toHaveProperty('z');
  });
});

// ── removeItem ────────────────────────────────────────────────────────────────

describe('removeItem', () => {
  it('removes owned slice keys from budget_v1', () => {
    writeStorage({ a: 1, b: 2, _testVersion: 1 });
    const s = makeStorage(['a', 'b'], '_testVersion', 1, []);
    s.removeItem('_');
    const saved = readStorage();
    expect(saved).not.toHaveProperty('a');
    expect(saved).not.toHaveProperty('b');
  });

  it('removes the domain version key', () => {
    writeStorage({ a: 1, _testVersion: 1 });
    const s = makeStorage(['a'], '_testVersion', 1, []);
    s.removeItem('_');
    expect(readStorage()).not.toHaveProperty('_testVersion');
  });

  it('preserves other domains data when removing one domain', () => {
    writeStorage({ a: 1, _testVersion: 1, people: ['bob'], _peopleVersion: 1 });
    const s = makeStorage(['a'], '_testVersion', 1, []);
    s.removeItem('_');
    const saved = readStorage();
    expect(saved.people).toEqual(['bob']);
    expect(saved._peopleVersion).toBe(1);
  });

  it('removes budget_v1 key entirely when no domain data remains after reset', () => {
    writeStorage({ a: 1, _testVersion: 1 });
    const s = makeStorage(['a'], '_testVersion', 1, []);
    s.removeItem('_');
    expect(localStorage.getItem('budget_v1')).toBeNull();
  });

  it('subsequent getItem after removeItem returns null (Zustand will use defaults)', () => {
    writeStorage({ a: 42, _testVersion: 1 });
    const s = makeStorage(['a'], '_testVersion', 1, []);
    s.removeItem('_');
    expect(s.getItem('_')).toBeNull();
  });
});

// ── Future-version guard ──────────────────────────────────────────────────────

describe('future version guard', () => {
  it('returns state as-is and warns when savedVersion > currentVersion', () => {
    writeStorage({ a: 'future-data', _testVersion: 99 });
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = makeStorage(['a'], '_testVersion', 1, []);
    const result = s.getItem('_');
    expect(result.state.a).toBe('future-data');
    expect(result.version).toBe(99);
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it('does not run any migrations when savedVersion > currentVersion', () => {
    writeStorage({ a: 'original', _testVersion: 5 });
    const migrateFn = vi.fn((s) => s);
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = makeStorage(['a'], '_testVersion', 1, [{ toVersion: 1, migrate: migrateFn }]);
    s.getItem('_');
    expect(migrateFn).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('preserves all slice data when loaded from a future version', () => {
    writeStorage({ a: 'keep-me', b: 'also-keep', _testVersion: 10 });
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = makeStorage(['a', 'b'], '_testVersion', 2, [
      { toVersion: 1, migrate: (sl) => sl },
      { toVersion: 2, migrate: (sl) => sl },
    ]);
    const result = s.getItem('_');
    expect(result.state.a).toBe('keep-me');
    expect(result.state.b).toBe('also-keep');
    spy.mockRestore();
  });
});

// ── Migration chain validation ────────────────────────────────────────────────

describe('migration chain validation', () => {
  it('throws when first migration does not start at toVersion 1', () => {
    expect(() =>
      createBudgetStorage(['a'], '_testVersion', 2, [
        { toVersion: 2, migrate: (s) => s }, // must start at 1
      ])
    ).toThrow(/migration chain gap/i);
  });

  it('throws when there is a gap in the migration sequence', () => {
    expect(() =>
      createBudgetStorage(['a'], '_testVersion', 3, [
        { toVersion: 1, migrate: (s) => s },
        { toVersion: 3, migrate: (s) => s }, // gap: missing toVersion 2
      ])
    ).toThrow(/migration chain gap/i);
  });

  it('throws when migrations are out of order', () => {
    expect(() =>
      createBudgetStorage(['a'], '_testVersion', 2, [
        { toVersion: 2, migrate: (s) => s },
        { toVersion: 1, migrate: (s) => s },
      ])
    ).toThrow(/migration chain gap/i);
  });

  it('accepts a valid contiguous migration chain', () => {
    expect(() =>
      createBudgetStorage(['a'], '_testVersion', 3, [
        { toVersion: 1, migrate: (s) => s },
        { toVersion: 2, migrate: (s) => s },
        { toVersion: 3, migrate: (s) => s },
      ])
    ).not.toThrow();
  });

  it('accepts an empty migration list with version 0', () => {
    expect(() =>
      createBudgetStorage(['a'], '_testVersion', 0, [])
    ).not.toThrow();
  });

  it('accepts an empty migration list with version > 0 (no migrations required)', () => {
    // Valid: domain at v1 with no migration definitions yet
    expect(() =>
      createBudgetStorage(['a'], '_testVersion', 1, [])
    ).not.toThrow();
  });
});

// ── Partial domain payloads ───────────────────────────────────────────────────

describe('partial domain payloads', () => {
  it('returns only keys that exist in storage — absent keys are not injected as undefined', () => {
    writeStorage({ a: 10 }); // b is absent; no version key
    const s = createBudgetStorage(['a', 'b'], '_testVersion', 0, []);
    const result = s.getItem('_');
    expect(result.state).toHaveProperty('a', 10);
    expect(result.state).not.toHaveProperty('b');
  });

  it('returns empty state object when no owned keys exist in storage', () => {
    writeStorage({ unrelated: 'other-domain' });
    const s = createBudgetStorage(['a', 'b'], '_testVersion', 0, []);
    const result = s.getItem('_');
    expect(result).not.toBeNull();
    expect(result.state).toEqual({});
  });

  it('migration receives only the keys present in storage (no undefined pollution)', () => {
    writeStorage({ a: 5 }); // b absent
    let capturedSlice;
    const migration = {
      toVersion: 1,
      migrate: (slice) => { capturedSlice = { ...slice }; return slice; },
    };
    const s = createBudgetStorage(['a', 'b'], '_testVersion', 1, [migration]);
    s.getItem('_');
    expect(capturedSlice).toHaveProperty('a', 5);
    expect(capturedSlice).not.toHaveProperty('b');
  });

  it('one domain having only some keys in storage does not affect another domain read', () => {
    // Only finance keys present; people keys absent
    writeStorage({ accounts: [{ id: 'main', balance: 500 }], _financeVersion: 1 });
    const people = createBudgetStorage(
      ['people', 'expenses', 'wishlist'],
      '_peopleVersion', 1, []
    );
    const result = people.getItem('_');
    // People slice is empty — no cross-contamination from finance data
    expect(Object.keys(result.state).length).toBe(0);
    expect(result.state).not.toHaveProperty('accounts');
  });
});
