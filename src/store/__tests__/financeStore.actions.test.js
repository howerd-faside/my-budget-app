/**
 * Tests for finance store actions.
 *
 * Covers:
 *   - updateAccount: updates a single account balance, leaves others intact
 *   - addTransfer: deducts from source, credits target, records transfer, ignores
 *     zero/negative/non-numeric amounts
 *   - removeTransfer: reverses both account balances, removes the record,
 *     is a no-op for unknown txId
 *   - updateFortnight: creates nested entry when absent, merges data into existing
 *     entry, preserves sibling fortnights and sibling years
 *   - setSlice / mergeSlices: single and multi-key state updates, unrelated keys
 *     untouched
 *
 * Note: the persist middleware tries to write to localStorage on every state change.
 * localStorage is not available in the Node test environment; the budgetStorage
 * adapter catches the ReferenceError internally and logs a console.error.
 * We suppress that noise in beforeEach / afterEach.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useFinanceStore } from '../financeStore';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_ACCOUNTS = [
  { id: 'main',      name: 'Savings',   balance: 1000 },
  { id: 'emergency', name: 'Emergency', balance: 500  },
  { id: 'travel',    name: 'Travel',    balance: 200  },
];

function resetStore() {
  // Use merge mode (no replace flag) so action methods defined in create()
  // are preserved. replace=true would wipe them from the state object.
  useFinanceStore.setState({
    accounts:        BASE_ACCOUNTS.map(a => ({ ...a })),
    transfers:       [],
    fortnightlyData: {},
    goals:           [],
    assetIncomes:    [],
    settings:        { currentBalance: 0 },
  });
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  resetStore();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Convenience — get current state without repeating getState()
function state() { return useFinanceStore.getState(); }

// ── updateAccount ──────────────────────────────────────────────────────────────

describe('updateAccount', () => {
  it('sets the balance of the named account', () => {
    state().updateAccount('main', 5000);
    expect(state().accounts.find(a => a.id === 'main').balance).toBe(5000);
  });

  it('does not change other accounts', () => {
    state().updateAccount('main', 9999);
    expect(state().accounts.find(a => a.id === 'emergency').balance).toBe(500);
    expect(state().accounts.find(a => a.id === 'travel').balance).toBe(200);
  });

  it('coerces a string value to a number', () => {
    state().updateAccount('emergency', '750');
    const em = state().accounts.find(a => a.id === 'emergency');
    expect(em.balance).toBe(750);
    expect(typeof em.balance).toBe('number');
  });

  it('can set balance to zero', () => {
    state().updateAccount('travel', 0);
    expect(state().accounts.find(a => a.id === 'travel').balance).toBe(0);
  });
});

// ── addTransfer ────────────────────────────────────────────────────────────────

describe('addTransfer', () => {
  it('deducts the amount from the source account', () => {
    state().addTransfer({ fromId: 'main', toId: 'emergency', amount: 300 });
    expect(state().accounts.find(a => a.id === 'main').balance).toBe(700);
  });

  it('credits the amount to the destination account', () => {
    state().addTransfer({ fromId: 'main', toId: 'emergency', amount: 300 });
    expect(state().accounts.find(a => a.id === 'emergency').balance).toBe(800);
  });

  it('does not change uninvolved accounts', () => {
    state().addTransfer({ fromId: 'main', toId: 'emergency', amount: 100 });
    expect(state().accounts.find(a => a.id === 'travel').balance).toBe(200);
  });

  it('adds a transfer record with the correct fields', () => {
    state().addTransfer({ fromId: 'main', toId: 'travel', amount: 150, note: 'Holiday' });
    const tx = state().transfers[0];
    expect(tx.fromId).toBe('main');
    expect(tx.toId).toBe('travel');
    expect(tx.amount).toBe(150);
    expect(tx.note).toBe('Holiday');
    expect(tx.id).toBeTruthy();
    expect(tx.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('defaults note to empty string when not supplied', () => {
    state().addTransfer({ fromId: 'main', toId: 'emergency', amount: 50 });
    expect(state().transfers[0].note).toBe('');
  });

  it('coerces a string amount to a number', () => {
    state().addTransfer({ fromId: 'main', toId: 'emergency', amount: '200' });
    expect(state().transfers[0].amount).toBe(200);
    expect(state().accounts.find(a => a.id === 'main').balance).toBe(800);
  });

  it('is a no-op when amount is 0', () => {
    state().addTransfer({ fromId: 'main', toId: 'emergency', amount: 0 });
    expect(state().transfers).toHaveLength(0);
    expect(state().accounts.find(a => a.id === 'main').balance).toBe(1000);
  });

  it('is a no-op when amount is negative', () => {
    state().addTransfer({ fromId: 'main', toId: 'emergency', amount: -100 });
    expect(state().transfers).toHaveLength(0);
  });

  it('is a no-op when amount is a non-numeric string', () => {
    state().addTransfer({ fromId: 'main', toId: 'emergency', amount: 'abc' });
    expect(state().transfers).toHaveLength(0);
  });

  it('accumulates multiple independent transfers', () => {
    state().addTransfer({ fromId: 'main', toId: 'emergency', amount: 100 });
    state().addTransfer({ fromId: 'main', toId: 'travel',    amount: 50  });
    expect(state().transfers).toHaveLength(2);
    expect(state().accounts.find(a => a.id === 'main').balance).toBe(850);
  });

  it('each transfer record gets a unique id', () => {
    state().addTransfer({ fromId: 'main', toId: 'emergency', amount: 100 });
    state().addTransfer({ fromId: 'main', toId: 'emergency', amount: 100 });
    const ids = state().transfers.map(t => t.id);
    expect(new Set(ids).size).toBe(2);
  });
});

// ── removeTransfer ─────────────────────────────────────────────────────────────

describe('removeTransfer', () => {
  function addAndGetTxId(amount = 300) {
    state().addTransfer({ fromId: 'main', toId: 'emergency', amount });
    return state().transfers[0].id;
  }

  it('restores the source account balance', () => {
    const txId = addAndGetTxId(300);
    state().removeTransfer(txId);
    expect(state().accounts.find(a => a.id === 'main').balance).toBe(1000);
  });

  it('restores the destination account balance', () => {
    const txId = addAndGetTxId(300);
    state().removeTransfer(txId);
    expect(state().accounts.find(a => a.id === 'emergency').balance).toBe(500);
  });

  it('removes the transfer record', () => {
    const txId = addAndGetTxId();
    state().removeTransfer(txId);
    expect(state().transfers).toHaveLength(0);
  });

  it('does not change state when txId is unknown', () => {
    const { accounts: before, transfers: txsBefore } = state();
    state().removeTransfer('does-not-exist');
    expect(state().accounts).toEqual(before);
    expect(state().transfers).toEqual(txsBefore);
  });

  it('only removes the targeted transfer when multiple exist', () => {
    state().addTransfer({ fromId: 'main', toId: 'emergency', amount: 100 });
    state().addTransfer({ fromId: 'main', toId: 'travel',    amount: 50  });
    const firstId = state().transfers[0].id;
    state().removeTransfer(firstId);
    expect(state().transfers).toHaveLength(1);
    expect(state().transfers[0].toId).toBe('travel');
  });

  it('does not alter uninvolved accounts when reversing', () => {
    const txId = addAndGetTxId(100);
    state().removeTransfer(txId);
    expect(state().accounts.find(a => a.id === 'travel').balance).toBe(200);
  });
});

// ── updateFortnight ────────────────────────────────────────────────────────────

describe('updateFortnight', () => {
  it('creates a new year entry when none exists', () => {
    state().updateFortnight(2026, 3, { note: 'bonus' });
    expect(state().fortnightlyData[2026]).toBeDefined();
    expect(state().fortnightlyData[2026].fortnights[3].note).toBe('bonus');
  });

  it('new fortnight starts with an empty adhocTransactions array', () => {
    state().updateFortnight(2026, 1, { note: 'x' });
    expect(state().fortnightlyData[2026].fortnights[1].adhocTransactions).toEqual([]);
  });

  it('merges new data into an existing fortnight entry', () => {
    state().updateFortnight(2026, 3, { adhocTransactions: [{ id: 'tx1' }] });
    state().updateFortnight(2026, 3, { note: 'updated' });
    const ft = state().fortnightlyData[2026].fortnights[3];
    expect(ft.adhocTransactions).toEqual([{ id: 'tx1' }]);
    expect(ft.note).toBe('updated');
  });

  it('overwrites a specific field when updated', () => {
    state().updateFortnight(2026, 0, { note: 'first' });
    state().updateFortnight(2026, 0, { note: 'second' });
    expect(state().fortnightlyData[2026].fortnights[0].note).toBe('second');
  });

  it('preserves sibling fortnights in the same year', () => {
    state().updateFortnight(2026, 0, { a: 1 });
    state().updateFortnight(2026, 5, { b: 2 });
    expect(state().fortnightlyData[2026].fortnights[0].a).toBe(1);
    expect(state().fortnightlyData[2026].fortnights[5].b).toBe(2);
  });

  it('preserves entries from other years', () => {
    state().updateFortnight(2025, 0, { x: 10 });
    state().updateFortnight(2026, 0, { y: 20 });
    expect(state().fortnightlyData[2025].fortnights[0].x).toBe(10);
    expect(state().fortnightlyData[2026].fortnights[0].y).toBe(20);
  });
});

// ── setSlice ───────────────────────────────────────────────────────────────────

describe('setSlice', () => {
  it('replaces the target slice key', () => {
    const goals = [{ id: 'g1', name: 'Holiday', amount: 5000 }];
    state().setSlice('goals', goals);
    expect(state().goals).toEqual(goals);
  });

  it('does not affect other slice keys', () => {
    state().setSlice('goals', [{ id: 'g1' }]);
    expect(state().transfers).toEqual([]);
    expect(state().assetIncomes).toEqual([]);
    expect(state().accounts).toHaveLength(3);
  });

  it('can set fortnightlyData to a non-empty object', () => {
    const fd = { 2026: { fortnights: { 0: { adhocTransactions: [] } } } };
    state().setSlice('fortnightlyData', fd);
    expect(state().fortnightlyData[2026]).toBeDefined();
  });
});

// ── mergeSlices ────────────────────────────────────────────────────────────────

describe('mergeSlices', () => {
  it('applies multiple key updates atomically', () => {
    const goals = [{ id: 'g1' }];
    const assetIncomes = [{ id: 'ai1' }];
    state().mergeSlices({ goals, assetIncomes });
    expect(state().goals).toEqual(goals);
    expect(state().assetIncomes).toEqual(assetIncomes);
  });

  it('does not overwrite keys not included in the merge', () => {
    state().mergeSlices({ goals: [{ id: 'g1' }] });
    expect(state().transfers).toEqual([]);
    expect(state().accounts).toHaveLength(3);
  });

  it('can update accounts and transfers together', () => {
    const accounts = [{ id: 'main', name: 'Savings', balance: 9000 }];
    const transfers = [{ id: 'tx1', fromId: 'main', toId: 'emergency', amount: 100, note: '', date: '2026-01-01' }];
    state().mergeSlices({ accounts, transfers });
    expect(state().accounts[0].balance).toBe(9000);
    expect(state().transfers[0].id).toBe('tx1');
  });
});
