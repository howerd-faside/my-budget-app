/**
 * Store-level integration tests covering multi-step user flows.
 *
 * These tests exercise sequences of store mutations (the same actions components
 * trigger) and verify the resulting state is coherent across slices.
 *
 * Flows covered:
 *   1. Account balance editing
 *   2. Transfer round-trip (add → verify balances → remove → balances restored)
 *   3. Multiple transfers and cumulative balance tracking
 *   4. Person lifecycle: create → link expense → cascade delete → expense link cleared
 *   5. Investment portfolio lifecycle: create → associate holdings/contributions/dividends
 *      → cascade delete portfolio → everything cleared
 *   6. Property lifecycle: create → add task/maintenance/project/asset
 *      → cascade delete property → all dependents cleared
 *
 * Note: backup round-trip tests (requiring localStorage) live in
 *       backup.integration.test.jsx which runs in the jsdom environment.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { useFinanceStore }    from '../financeStore';
import { usePeopleStore }     from '../peopleStore';
import { usePropertyStore }   from '../propertyStore';
import { useInvestmentStore } from '../investmentStore';
import { cascadeDeletePerson }   from '../../utils/cascade';
import { cascadeDeleteProperty } from '../../utils/cascade';
import { cascadeDeletePortfolio } from '../../utils/cascade';

// ── store reset helpers ───────────────────────────────────────────────────────
// Use setState WITHOUT the replace flag so Zustand action methods are preserved
// (setState(patch, true) would strip all actions from the state).

const DEFAULT_ACCOUNTS = [
  { id: 'main',      name: 'Savings',   balance: 0 },
  { id: 'emergency', name: 'Emergency', balance: 0 },
  { id: 'travel',    name: 'Travel',    balance: 0 },
];

function resetStores() {
  useFinanceStore.setState({
    accounts: DEFAULT_ACCOUNTS.map(a => ({ ...a })),
    transfers: [], fortnightlyData: {}, goals: [], assetIncomes: [],
    settings: { currentBalance: 0 },
  });
  usePeopleStore.setState({ people: [], expenses: [], wishlist: [] });
  usePropertyStore.setState({
    properties: [], propertyTasks: [], propertyMaintenance: [],
    propertyProjects: [], propertyAssets: [], selectedPropertyId: null,
  });
  useInvestmentStore.setState({
    investmentPortfolios: [], selectedPortfolioId: null,
    investments: [], investmentContributions: [], investmentDividends: [],
  });
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  resetStores();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Flow 1: Account balance editing ──────────────────────────────────────────

describe('Flow: account balance editing', () => {
  it('updateAccount sets the balance for the target account only', () => {
    useFinanceStore.setState({
      accounts: [
        { id: 'main',      name: 'Savings',   balance: 1000 },
        { id: 'emergency', name: 'Emergency', balance: 500  },
      ],
    });

    useFinanceStore.getState().updateAccount('main', 2500);

    const { accounts } = useFinanceStore.getState();
    expect(accounts.find(a => a.id === 'main').balance).toBe(2500);
    expect(accounts.find(a => a.id === 'emergency').balance).toBe(500); // untouched
  });

  it('summing account balances gives the total portfolio value', () => {
    useFinanceStore.setState({
      accounts: [
        { id: 'main',      name: 'Savings',   balance: 3000 },
        { id: 'emergency', name: 'Emergency', balance: 1500 },
        { id: 'travel',    name: 'Travel',    balance: 500  },
      ],
    });

    const total = useFinanceStore.getState().accounts.reduce((s, a) => s + a.balance, 0);
    expect(total).toBe(5000);
  });
});

// ── Flow 2: Transfer round-trip ───────────────────────────────────────────────

describe('Flow: transfer round-trip', () => {
  beforeEach(() => {
    useFinanceStore.setState({
      accounts: [
        { id: 'main',      name: 'Savings',   balance: 5000 },
        { id: 'emergency', name: 'Emergency', balance: 1000 },
        { id: 'travel',    name: 'Travel',    balance: 0    },
      ],
    });
  });

  it('addTransfer deducts from source and credits destination', () => {
    useFinanceStore.getState().addTransfer({ fromId: 'main', toId: 'emergency', amount: 500, note: 'top up' });

    const { accounts } = useFinanceStore.getState();
    expect(accounts.find(a => a.id === 'main').balance).toBe(4500);
    expect(accounts.find(a => a.id === 'emergency').balance).toBe(1500);
  });

  it('addTransfer records the transfer with correct metadata', () => {
    useFinanceStore.getState().addTransfer({ fromId: 'main', toId: 'travel', amount: 200, note: 'holiday' });

    const { transfers } = useFinanceStore.getState();
    expect(transfers).toHaveLength(1);
    expect(transfers[0].fromId).toBe('main');
    expect(transfers[0].toId).toBe('travel');
    expect(transfers[0].amount).toBe(200);
    expect(transfers[0].note).toBe('holiday');
    expect(transfers[0].id).toBeTruthy();
    expect(transfers[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('removeTransfer reverses the balance change', () => {
    useFinanceStore.getState().addTransfer({ fromId: 'main', toId: 'emergency', amount: 500 });
    const txId = useFinanceStore.getState().transfers[0].id;

    useFinanceStore.getState().removeTransfer(txId);

    const { accounts } = useFinanceStore.getState();
    expect(accounts.find(a => a.id === 'main').balance).toBe(5000);
    expect(accounts.find(a => a.id === 'emergency').balance).toBe(1000);
    expect(useFinanceStore.getState().transfers).toHaveLength(0);
  });

  it('total balance is preserved after a transfer (zero-sum)', () => {
    const before = useFinanceStore.getState().accounts.reduce((s, a) => s + a.balance, 0);
    useFinanceStore.getState().addTransfer({ fromId: 'main', toId: 'emergency', amount: 750 });
    const after = useFinanceStore.getState().accounts.reduce((s, a) => s + a.balance, 0);
    expect(after).toBe(before);
  });

  it('total balance is preserved after transfer is removed', () => {
    const original = useFinanceStore.getState().accounts.reduce((s, a) => s + a.balance, 0);
    useFinanceStore.getState().addTransfer({ fromId: 'main', toId: 'travel', amount: 300 });
    const txId = useFinanceStore.getState().transfers[0].id;
    useFinanceStore.getState().removeTransfer(txId);
    const restored = useFinanceStore.getState().accounts.reduce((s, a) => s + a.balance, 0);
    expect(restored).toBe(original);
  });

  it('addTransfer silently ignores a zero amount', () => {
    useFinanceStore.getState().addTransfer({ fromId: 'main', toId: 'emergency', amount: 0 });
    expect(useFinanceStore.getState().transfers).toHaveLength(0);
  });
});

// ── Flow 3: Multiple transfers cumulative ─────────────────────────────────────

describe('Flow: multiple transfers', () => {
  it('stacks multiple transfers and each affects balances independently', () => {
    useFinanceStore.setState({
      accounts: [
        { id: 'main',      name: 'Savings',   balance: 10000 },
        { id: 'emergency', name: 'Emergency', balance: 0 },
        { id: 'travel',    name: 'Travel',    balance: 0 },
      ],
    });

    useFinanceStore.getState().addTransfer({ fromId: 'main', toId: 'emergency', amount: 2000 });
    useFinanceStore.getState().addTransfer({ fromId: 'main', toId: 'travel',    amount: 1000 });

    const { accounts, transfers } = useFinanceStore.getState();
    expect(transfers).toHaveLength(2);
    expect(accounts.find(a => a.id === 'main').balance).toBe(7000);
    expect(accounts.find(a => a.id === 'emergency').balance).toBe(2000);
    expect(accounts.find(a => a.id === 'travel').balance).toBe(1000);
  });
});

// ── Flow 4: Person lifecycle with cascade ─────────────────────────────────────

describe('Flow: person lifecycle with cascade delete', () => {
  it('cascade-deletes a person and clears forPerson on their linked expenses', () => {
    const person = { id: 'p1', name: 'Alice', grossAnnual: 80000, taxCode: 'M', kiwiSaverRate: 3, payFrequency: 'fortnightly', secondaryIncomes: [], incomeEvents: [], employmentHistory: [], netFortnightly: 2100 };
    const expAlice  = { id: 'e1', name: "Alice's Spending", forPerson: 'p1', category: 'Spending Money', amount: 300, frequency: 'fortnightly', type: 'standard', subtype: 'fixed', facilities: [] };
    const expShared = { id: 'e2', name: 'Power', forPerson: '', category: 'Electricity', amount: 120, frequency: 'monthly', type: 'standard', subtype: 'fixed', facilities: [] };

    usePeopleStore.setState({ people: [person], expenses: [expAlice, expShared] });

    const state    = usePeopleStore.getState();
    const newSlice = cascadeDeletePerson(state, 'p1');
    usePeopleStore.getState().mergeSlices(newSlice);

    const final = usePeopleStore.getState();
    expect(final.people).toHaveLength(0);
    // Alice's expense should have forPerson cleared (not deleted)
    expect(final.expenses.find(e => e.id === 'e1').forPerson).toBe('');
    // Shared expense untouched
    expect(final.expenses.find(e => e.id === 'e2').forPerson).toBe('');
  });

  it('a person with no linked expenses is fully removed by cascade', () => {
    const person = { id: 'p2', name: 'Bob', grossAnnual: 60000, secondaryIncomes: [], incomeEvents: [], employmentHistory: [] };
    usePeopleStore.setState({ people: [person], expenses: [] });

    const newSlice = cascadeDeletePerson(usePeopleStore.getState(), 'p2');
    usePeopleStore.getState().mergeSlices(newSlice);

    expect(usePeopleStore.getState().people).toHaveLength(0);
    expect(usePeopleStore.getState().expenses).toHaveLength(0);
  });
});

// ── Flow 5: Investment portfolio lifecycle ────────────────────────────────────

describe('Flow: investment portfolio lifecycle', () => {
  it('cascade-deletes portfolio, holdings, contributions, and dividends atomically', () => {
    const portfolio  = { id: 'port-1', name: 'Growth', createdAt: '' };
    const portfolio2 = { id: 'port-2', name: 'Income', createdAt: '' };
    const holding    = { id: 'h1', portfolioId: 'port-1', name: 'VGS', ticker: 'VGS', platform: 'Sharesies', category: 'ETF', units: '50', avgCost: '80', currentPrice: '95', notes: '', tranches: [], createdAt: '' };
    const contrib    = { id: 'c1', portfolioId: 'port-1', holdingId: 'h1', date: '2025-06-01', amount: 4000, type: 'buy', platform: '', notes: '', createdAt: '' };
    const dividend   = { id: 'd1', portfolioId: 'port-1', holdingId: 'h1', date: '2025-09-01', grossAmount: 100, taxAmount: 17, netAmount: 83, platform: '', notes: '', createdAt: '' };

    useInvestmentStore.setState({
      investmentPortfolios: [portfolio, portfolio2],
      selectedPortfolioId: 'port-1',
      investments: [holding],
      investmentContributions: [contrib],
      investmentDividends: [dividend],
    });

    const newSlice = cascadeDeletePortfolio(useInvestmentStore.getState(), 'port-1');
    useInvestmentStore.getState().mergeSlices(newSlice);

    const final = useInvestmentStore.getState();
    expect(final.investmentPortfolios).toHaveLength(1);
    expect(final.investmentPortfolios[0].id).toBe('port-2');
    expect(final.investments).toHaveLength(0);
    expect(final.investmentContributions).toHaveLength(0);
    expect(final.investmentDividends).toHaveLength(0);
    expect(final.selectedPortfolioId).not.toBe('port-1');
  });
});

// ── Flow 6: Property lifecycle with cascade ───────────────────────────────────

describe('Flow: property lifecycle with cascade delete', () => {
  it('cascade-deletes tasks, maintenance, projects, and assets when property removed', () => {
    const prop = { id: 'prop-1', name: 'Home', type: 'Primary Home', address: '', areas: [], createdAt: '' };

    usePropertyStore.setState({
      properties: [prop],
      selectedPropertyId: 'prop-1',
      propertyTasks:       [{ id: 't1', propertyId: 'prop-1', title: 'Paint fence', status: 'Open', priority: 'Low', notes: [], createdAt: '' }],
      propertyMaintenance: [{ id: 'm1', propertyId: 'prop-1', title: 'Roof check', date: '2026-01-01', createdAt: '' }],
      propertyProjects:    [{ id: 'pj1', propertyId: 'prop-1', title: 'Deck build', status: 'Planning', priority: 'Medium', areas: [], taskIds: [], notes: [], createdAt: '' }],
      propertyAssets:      [{ id: 'a1', propertyId: 'prop-1', name: 'Heat pump', type: 'HVAC', createdAt: '' }],
    });

    const newSlice = cascadeDeleteProperty(usePropertyStore.getState(), 'prop-1');
    usePropertyStore.getState().mergeSlices(newSlice);

    const final = usePropertyStore.getState();
    expect(final.properties).toHaveLength(0);
    expect(final.propertyTasks).toHaveLength(0);
    expect(final.propertyMaintenance).toHaveLength(0);
    expect(final.propertyProjects).toHaveLength(0);
    expect(final.propertyAssets).toHaveLength(0);
    expect(final.selectedPropertyId).toBeNull();
  });

  it('second property is unaffected when first property is cascade-deleted', () => {
    const p1 = { id: 'prop-1', name: 'Home', type: 'Primary Home', areas: [], createdAt: '' };
    const p2 = { id: 'prop-2', name: 'Bach', type: 'Bach/Holiday', areas: [], createdAt: '' };

    usePropertyStore.setState({
      properties: [p1, p2],
      selectedPropertyId: 'prop-1',
      propertyTasks:       [{ id: 't1', propertyId: 'prop-1', title: 'Task1', status: 'Open', priority: 'Low', notes: [], createdAt: '' },
                            { id: 't2', propertyId: 'prop-2', title: 'Task2', status: 'Open', priority: 'Low', notes: [], createdAt: '' }],
      propertyMaintenance: [],
      propertyProjects: [],
      propertyAssets: [],
    });

    const newSlice = cascadeDeleteProperty(usePropertyStore.getState(), 'prop-1');
    usePropertyStore.getState().mergeSlices(newSlice);

    const final = usePropertyStore.getState();
    expect(final.properties).toHaveLength(1);
    expect(final.properties[0].id).toBe('prop-2');
    expect(final.propertyTasks).toHaveLength(1);
    expect(final.propertyTasks[0].id).toBe('t2');
  });
});
