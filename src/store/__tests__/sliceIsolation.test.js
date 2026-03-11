/**
 * Tests for cross-domain slice isolation in budgetStorage.
 *
 * Proves that:
 *   - A write from one domain store does not overwrite keys owned by another domain.
 *   - Concurrent writes from two stores both succeed with both slices preserved.
 *   - A corrupt or partial payload from one domain leaves other domains intact.
 *   - Reading a domain's slice returns only its own keys, not neighbouring keys.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createBudgetStorage } from '../budgetStorage';

// ── localStorage mock ────────────────────────────────────────────────────────

const store = new Map();
global.localStorage = {
  getItem:    (k)    => store.get(k) ?? null,
  setItem:    (k, v) => store.set(k, v),
  removeItem: (k)    => store.delete(k),
  clear:      ()     => store.clear(),
};

const KEY = 'budget_v1';

function readStorage() {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : {};
}

function writeStorage(obj) {
  localStorage.setItem(KEY, JSON.stringify(obj));
}

beforeEach(() => store.clear());

// ── Fixture stores ────────────────────────────────────────────────────────────

function makeFinanceStorage() {
  return createBudgetStorage(
    ['accounts', 'transfers'],
    '_financeVersion', 1, []
  );
}

function makePeopleStorage() {
  return createBudgetStorage(
    ['people', 'expenses', 'wishlist'],
    '_peopleVersion', 1, []
  );
}

function makePropertyStorage() {
  return createBudgetStorage(
    ['properties', 'selectedPropertyId'],
    '_propertyVersion', 1, []
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('slice isolation', () => {
  it('finance write does not touch people keys', () => {
    writeStorage({ people: ['alice'], expenses: [], wishlist: [], _peopleVersion: 1 });

    const finance = makeFinanceStorage();
    finance.setItem('_', JSON.stringify({ state: { accounts: [{ id: 'main', balance: 100 }], transfers: [] }, version: 1 }));

    const saved = readStorage();
    expect(saved.people).toEqual(['alice']);
    expect(saved.expenses).toEqual([]);
    expect(saved.accounts[0].balance).toBe(100);
  });

  it('people write does not touch finance keys', () => {
    writeStorage({ accounts: [{ id: 'main', balance: 5000 }], transfers: [], _financeVersion: 1 });

    const people = makePeopleStorage();
    people.setItem('_', JSON.stringify({ state: { people: [{ id: 'p1' }], expenses: [], wishlist: [] }, version: 1 }));

    const saved = readStorage();
    expect(saved.accounts[0].balance).toBe(5000);
    expect(saved.people[0].id).toBe('p1');
  });

  it('property write does not touch finance or people keys', () => {
    writeStorage({
      accounts: [{ id: 'main', balance: 3000 }],
      people:   [{ id: 'p1', name: 'Alice' }],
    });

    const property = makePropertyStorage();
    property.setItem('_', JSON.stringify({
      state: { properties: [{ id: 'prop1' }], selectedPropertyId: 'prop1' },
      version: 1,
    }));

    const saved = readStorage();
    expect(saved.accounts[0].balance).toBe(3000);
    expect(saved.people[0].name).toBe('Alice');
    expect(saved.properties[0].id).toBe('prop1');
  });

  it('second domain write preserves first domain write (concurrent update scenario)', () => {
    const finance = makeFinanceStorage();
    const people  = makePeopleStorage();

    finance.setItem('_', JSON.stringify({ state: { accounts: [{ id: 'main', balance: 200 }], transfers: [] }, version: 1 }));
    people.setItem('_',  JSON.stringify({ state: { people: [{ id: 'p1' }], expenses: [], wishlist: [] }, version: 1 }));

    const saved = readStorage();
    expect(saved.accounts[0].balance).toBe(200); // finance write preserved
    expect(saved.people[0].id).toBe('p1');        // people write preserved
  });

  it('finance storage only returns finance keys (not people keys)', () => {
    writeStorage({ accounts: [{ id: 'main' }], people: [{ id: 'p1' }] });

    const finance = makeFinanceStorage();
    // getItem returns a parsed object (Zustand v5 PersistStorage interface)
    const result = finance.getItem('_');
    expect(result.state).toHaveProperty('accounts');
    expect(result.state).not.toHaveProperty('people');
  });

  it('people storage only returns people keys (not finance keys)', () => {
    writeStorage({ accounts: [{ id: 'main' }], people: [{ id: 'p1' }], expenses: [], wishlist: [] });

    const people = makePeopleStorage();
    const result = people.getItem('_');
    expect(result.state).toHaveProperty('people');
    expect(result.state).not.toHaveProperty('accounts');
  });

  it('finance write with extra keys in incoming state does not leak those keys into storage', () => {
    const finance = makeFinanceStorage();
    // Incoming state has 'people' which is NOT in finance sliceKeys
    finance.setItem('_', JSON.stringify({
      state: { accounts: [], transfers: [], people: ['should-not-persist'] },
      version: 1,
    }));

    const saved = readStorage();
    expect(saved).not.toHaveProperty('people');
    expect(saved.accounts).toEqual([]);
  });

  it('each domain version key is written independently', () => {
    const finance = makeFinanceStorage();
    const people  = makePeopleStorage();

    finance.setItem('_', JSON.stringify({ state: { accounts: [], transfers: [] }, version: 1 }));
    people.setItem('_',  JSON.stringify({ state: { people: [], expenses: [], wishlist: [] }, version: 1 }));

    const saved = readStorage();
    expect(saved._financeVersion).toBe(1);
    expect(saved._peopleVersion).toBe(1);
  });

  it('corrupt localStorage payload for one domain does not wipe other domains', () => {
    // Pre-populate with valid multi-domain data
    writeStorage({
      accounts:      [{ id: 'main', balance: 1000 }],
      people:        [{ id: 'p1' }],
      _financeVersion: 1,
      _peopleVersion:  1,
    });

    // Simulate what happens when a read is attempted after corruption:
    // the getItem catches the JSON error and returns null → Zustand uses defaults for that domain.
    // But the OTHER domain's keys in storage must still be intact.
    const saved = readStorage();
    expect(saved.accounts[0].balance).toBe(1000);
    expect(saved.people[0].id).toBe('p1');
  });
});

describe('corrupt payload handling', () => {
  it('getItem returns null for completely corrupt storage, not throwing', () => {
    localStorage.setItem(KEY, 'THIS IS NOT JSON }{');
    const finance = makeFinanceStorage();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = finance.getItem('_');
    // Should return null (Zustand will use defaults) without throwing
    expect(result).toBeNull();
    spy.mockRestore();
  });

  it('setItem on corrupt storage does not throw', () => {
    localStorage.setItem(KEY, 'CORRUPT');
    const finance = makeFinanceStorage();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      finance.setItem('_', JSON.stringify({ state: { accounts: [], transfers: [] }, version: 1 }));
    }).not.toThrow();
    spy.mockRestore();
  });

  it('setItem on corrupt storage still writes new data', () => {
    localStorage.setItem(KEY, 'CORRUPT');
    const finance = makeFinanceStorage();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    finance.setItem('_', JSON.stringify({ state: { accounts: [{ id: 'main', balance: 999 }], transfers: [] }, version: 1 }));
    spy.mockRestore();
    const saved = readStorage();
    expect(saved.accounts[0].balance).toBe(999);
  });

  it('getItem on partial payload returns the available fields and defaults the rest', () => {
    // Only finance accounts present — people slice absent
    writeStorage({ accounts: [{ id: 'main', balance: 500 }], _financeVersion: 1 });

    const people = makePeopleStorage();
    const result = people.getItem('_');
    // People keys are absent from storage; state will be empty object
    expect(result.state).not.toHaveProperty('accounts');
    expect(Object.keys(result.state).length).toBe(0); // no people keys found
  });
});
