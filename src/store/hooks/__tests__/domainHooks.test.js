/**
 * Tests for domain hooks: useFinance, usePeople, useProperty, useInvestment.
 *
 * These hooks are thin wrappers over Zustand domain stores.  We test them via
 * the underlying store singletons — calling getState() directly — rather than
 * rendering React components, matching the pattern used in financeStore.actions.test.js.
 *
 * Each test verifies:
 *   1. The hook module exports the expected function.
 *   2. The underlying store exposes every property the hook will return.
 *   3. The domain setters (setFinance / setPeople / …) update the correct store.
 *
 * Note: the persist middleware attempts to write to localStorage on each state
 * change.  localStorage is unavailable in Node; budgetStorage catches the error
 * and logs console.error.  We suppress that noise with spies.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { useFinanceStore }    from '../../financeStore';
import { usePeopleStore }     from '../../peopleStore';
import { usePropertyStore }   from '../../propertyStore';
import { useInvestmentStore } from '../../investmentStore';

// ── Verify hook exports ──────────────────────────────────────────────────────

import { useFinance }    from '../useFinance';
import { usePeople }     from '../usePeople';
import { useProperty }   from '../useProperty';
import { useInvestment } from '../useInvestment';
import { useUI }         from '../useUI';

describe('domain hook exports', () => {
  it('useFinance is a function', () => {
    expect(typeof useFinance).toBe('function');
  });
  it('usePeople is a function', () => {
    expect(typeof usePeople).toBe('function');
  });
  it('useProperty is a function', () => {
    expect(typeof useProperty).toBe('function');
  });
  it('useInvestment is a function', () => {
    expect(typeof useInvestment).toBe('function');
  });
  it('useUI is a function', () => {
    expect(typeof useUI).toBe('function');
  });
});

// ── Store contract: every key the hooks expose exists on the raw store ───────

describe('useFinance store contract', () => {
  it('finance store has all state slices that useFinance exposes', () => {
    const s = useFinanceStore.getState();
    expect(s).toHaveProperty('accounts');
    expect(s).toHaveProperty('transfers');
    expect(s).toHaveProperty('fortnightlyData');
    expect(s).toHaveProperty('goals');
    expect(s).toHaveProperty('assetIncomes');
    expect(s).toHaveProperty('settings');
  });

  it('finance store has all action methods that useFinance exposes', () => {
    const s = useFinanceStore.getState();
    expect(typeof s.setSlice).toBe('function');     // → setFinance
    expect(typeof s.mergeSlices).toBe('function');  // → mergeFinance
    expect(typeof s.updateFortnight).toBe('function');
    expect(typeof s.updateAccount).toBe('function');
    expect(typeof s.addTransfer).toBe('function');
    expect(typeof s.removeTransfer).toBe('function');
  });
});

describe('usePeople store contract', () => {
  it('people store has all state slices that usePeople exposes', () => {
    const s = usePeopleStore.getState();
    expect(s).toHaveProperty('people');
    expect(s).toHaveProperty('expenses');
    expect(s).toHaveProperty('wishlist');
  });

  it('people store has action methods that usePeople exposes', () => {
    const s = usePeopleStore.getState();
    expect(typeof s.setSlice).toBe('function');    // → setPeople
    expect(typeof s.mergeSlices).toBe('function'); // → mergePeople
  });
});

describe('useProperty store contract', () => {
  it('property store has all state slices that useProperty exposes', () => {
    const s = usePropertyStore.getState();
    expect(s).toHaveProperty('properties');
    expect(s).toHaveProperty('propertyTasks');
    expect(s).toHaveProperty('propertyMaintenance');
    expect(s).toHaveProperty('propertyProjects');
    expect(s).toHaveProperty('propertyAssets');
    expect(s).toHaveProperty('selectedPropertyId');
  });

  it('property store has action methods that useProperty exposes', () => {
    const s = usePropertyStore.getState();
    expect(typeof s.setSlice).toBe('function');    // → setProperty
    expect(typeof s.mergeSlices).toBe('function'); // → mergeProperty
  });
});

describe('useInvestment store contract', () => {
  it('investment store has all state slices that useInvestment exposes', () => {
    const s = useInvestmentStore.getState();
    expect(s).toHaveProperty('investmentPortfolios');
    expect(s).toHaveProperty('selectedPortfolioId');
    expect(s).toHaveProperty('investmentAssets');
    expect(s).toHaveProperty('investmentTransactions');
    expect(s).toHaveProperty('priceCache');
  });

  it('investment store has action methods that useInvestment exposes', () => {
    const s = useInvestmentStore.getState();
    expect(typeof s.setSlice).toBe('function');    // → setInvestment
    expect(typeof s.mergeSlices).toBe('function'); // → mergeInvestment
  });
});

// ── Setter behaviour: domain setters update the correct store ────────────────

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  // Reset stores to clean defaults
  useFinanceStore.setState({
    accounts: [], transfers: [], fortnightlyData: {}, goals: [], assetIncomes: [],
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
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('setFinance (via financeStore.setSlice)', () => {
  it('updates goals in the finance store', () => {
    const goal = { id: 'g1', name: 'Holiday', amount: 5000 };
    useFinanceStore.getState().setSlice('goals', [goal]);
    expect(useFinanceStore.getState().goals).toEqual([goal]);
  });

  it('updates assetIncomes without touching other slices', () => {
    const before = useFinanceStore.getState().accounts;
    useFinanceStore.getState().setSlice('assetIncomes', [{ id: 'ai1', amount: 500, frequency: 'monthly' }]);
    expect(useFinanceStore.getState().assetIncomes).toHaveLength(1);
    expect(useFinanceStore.getState().accounts).toStrictEqual(before);
  });
});

describe('mergeFinance (via financeStore.mergeSlices)', () => {
  it('applies multiple slice updates atomically', () => {
    const goal = { id: 'g2', name: 'Car', amount: 20000 };
    const acct = { id: 'main', name: 'Savings', balance: 10000 };
    useFinanceStore.getState().mergeSlices({ goals: [goal], accounts: [acct] });
    expect(useFinanceStore.getState().goals).toEqual([goal]);
    expect(useFinanceStore.getState().accounts).toEqual([acct]);
  });
});

describe('setPeople (via peopleStore.setSlice)', () => {
  it('updates expenses without touching people or wishlist', () => {
    const expense = { id: 'e1', name: 'Rent', amount: 1200, frequency: 'monthly' };
    usePeopleStore.getState().setSlice('expenses', [expense]);
    expect(usePeopleStore.getState().expenses).toEqual([expense]);
    expect(usePeopleStore.getState().people).toEqual([]);
    expect(usePeopleStore.getState().wishlist).toEqual([]);
  });

  it('updates wishlist', () => {
    const item = { id: 'w1', name: 'Laptop', estimatedCost: 2000 };
    usePeopleStore.getState().setSlice('wishlist', [item]);
    expect(usePeopleStore.getState().wishlist).toEqual([item]);
  });
});

describe('mergePeople (via peopleStore.mergeSlices)', () => {
  it('updates people and expenses atomically (simulates cascade delete)', () => {
    const p1 = { id: 'p1', name: 'Alice' };
    const p2 = { id: 'p2', name: 'Bob' };
    const e1 = { id: 'e1', name: 'Rent', forPerson: 'p1' };
    usePeopleStore.setState({ people: [p1, p2], expenses: [e1] });

    // Simulate cascadeDeletePerson: remove Bob, clear forPerson on expenses
    usePeopleStore.getState().mergeSlices({
      people:   [p1],
      expenses: [{ ...e1, forPerson: '' }],
    });

    expect(usePeopleStore.getState().people).toHaveLength(1);
    expect(usePeopleStore.getState().people[0].id).toBe('p1');
    expect(usePeopleStore.getState().expenses[0].forPerson).toBe('');
  });
});

describe('setProperty (via propertyStore.setSlice)', () => {
  it('updates selectedPropertyId', () => {
    usePropertyStore.getState().setSlice('selectedPropertyId', 'prop-abc');
    expect(usePropertyStore.getState().selectedPropertyId).toBe('prop-abc');
  });

  it('updates propertyTasks without touching properties', () => {
    const task = { id: 't1', title: 'Fix roof', propertyId: 'p1' };
    usePropertyStore.getState().setSlice('propertyTasks', [task]);
    expect(usePropertyStore.getState().propertyTasks).toEqual([task]);
    expect(usePropertyStore.getState().properties).toEqual([]);
  });
});

describe('mergeProperty (via propertyStore.mergeSlices)', () => {
  it('applies cross-slice updates atomically (simulates cascade delete)', () => {
    const prop = { id: 'p1', name: 'Home' };
    const task = { id: 't1', title: 'Inspect', propertyId: 'p1' };
    usePropertyStore.setState({ properties: [prop], propertyTasks: [task] });

    // Simulate cascadeDeleteProperty
    usePropertyStore.getState().mergeSlices({
      properties:    [],
      propertyTasks: [],
      selectedPropertyId: null,
    });

    expect(usePropertyStore.getState().properties).toHaveLength(0);
    expect(usePropertyStore.getState().propertyTasks).toHaveLength(0);
    expect(usePropertyStore.getState().selectedPropertyId).toBeNull();
  });
});

describe('setInvestment (via investmentStore.setSlice)', () => {
  it('updates selectedPortfolioId', () => {
    useInvestmentStore.getState().setSlice('selectedPortfolioId', 'port-1');
    expect(useInvestmentStore.getState().selectedPortfolioId).toBe('port-1');
  });

  it('updates investments without touching portfolios', () => {
    const holding = { id: 'h1', name: 'VGS', portfolioId: 'port-1' };
    useInvestmentStore.getState().setSlice('investments', [holding]);
    expect(useInvestmentStore.getState().investments).toEqual([holding]);
    expect(useInvestmentStore.getState().investmentPortfolios).toEqual([]);
  });
});

describe('mergeInvestment (via investmentStore.mergeSlices)', () => {
  it('cascade-deletes a portfolio atomically', () => {
    const portfolio  = { id: 'port-1', name: 'Main' };
    const portfolio2 = { id: 'port-2', name: 'KiwiSaver' };
    const asset      = { id: 'a1', name: 'VGS', portfolioId: 'port-1' };
    const tx         = { id: 'tx1', assetId: 'a1', portfolioId: 'port-1', type: 'buy', amount: 1000 };
    useInvestmentStore.setState({
      investmentPortfolios:    [portfolio, portfolio2],
      selectedPortfolioId:     'port-1',
      investmentAssets:        [asset],
      investmentTransactions:  [tx],
    });

    // Simulate cascadeDeletePortfolio for port-1
    useInvestmentStore.getState().mergeSlices({
      investmentPortfolios:    [portfolio2],
      investmentAssets:        [],
      investmentTransactions:  [],
      selectedPortfolioId:     'port-2',
    });

    expect(useInvestmentStore.getState().investmentPortfolios).toHaveLength(1);
    expect(useInvestmentStore.getState().investmentAssets).toHaveLength(0);
    expect(useInvestmentStore.getState().investmentTransactions).toHaveLength(0);
    expect(useInvestmentStore.getState().selectedPortfolioId).toBe('port-2');
  });
});
