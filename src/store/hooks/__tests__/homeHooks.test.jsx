// @vitest-environment jsdom
/**
 * Tests for Home-screen derived hooks:
 *   useWishlistSummary, useGoalsSummary, usePropertyAlerts,
 *   useNetWorth, useUpcomingObligations
 *
 * These hooks compose domain stores + utility functions inside useMemo,
 * so we use renderHook from @testing-library/react.
 *
 * Store state is seeded via direct setState() calls on the Zustand singletons.
 * The dates module is mocked so time-sensitive hooks produce deterministic results.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useFinanceStore }    from '../../financeStore';
import { usePeopleStore }     from '../../peopleStore';
import { usePropertyStore }   from '../../propertyStore';
import { useInvestmentStore } from '../../investmentStore';

import { useWishlistSummary }     from '../useWishlistSummary';
import { useGoalsSummary }        from '../useGoalsSummary';
import { usePropertyAlerts }      from '../usePropertyAlerts';
import { useNetWorth }            from '../useNetWorth';
import { useUpcomingObligations } from '../useUpcomingObligations';

// ── Mock today() so date-dependent hooks are deterministic ───────────────────
vi.mock('../../../utils/finance/dates', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, today: () => '2026-03-16' };
});

// ── Store reset ──────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});

  useFinanceStore.setState({
    accounts: [], transfers: [], fortnightlyData: {}, goals: [], assetIncomes: [],
    settings: { currentBalance: 0 }, lastSettledFortnight: null,
  });
  usePeopleStore.setState({ people: [], expenses: [], wishlist: [] });
  usePropertyStore.setState({
    properties: [], propertyTasks: [], propertyMaintenance: [],
    propertyProjects: [], propertyAssets: [], selectedPropertyId: null,
  });
  useInvestmentStore.setState({
    investmentPortfolios: [], selectedPortfolioId: null,
    investments: [], investmentContributions: [], investmentDividends: [],
    investmentAssets: [], investmentTransactions: [], priceCache: [],
    watchlist: [], watchlistPrices: [],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});


// ═══════════════════════════════════════════════════════════════════════════════
// useWishlistSummary
// ═══════════════════════════════════════════════════════════════════════════════

describe('useWishlistSummary', () => {
  it('returns empty summary when no wishlist items exist', () => {
    const { result } = renderHook(() => useWishlistSummary());
    expect(result.current).toMatchObject({
      pendingCount: 0,
      totalPendingCost: 0,
      affordableNow: 0,
      nextAffordable: null,
      hasWishlist: false,
    });
  });

  it('counts pending items and sums their costs', () => {
    usePeopleStore.setState({
      wishlist: [
        { id: 'w1', name: 'TV', estimatedCost: 1500, purchased: false },
        { id: 'w2', name: 'Laptop', estimatedCost: 2500, purchased: false },
        { id: 'w3', name: 'Headphones', estimatedCost: 300, purchased: true },
      ],
    });

    const { result } = renderHook(() => useWishlistSummary());
    expect(result.current.hasWishlist).toBe(true);
    expect(result.current.pendingCount).toBe(2);
    expect(result.current.totalPendingCost).toBe(4000);
  });

  it('counts affordable items based on current balance', () => {
    useFinanceStore.setState({
      accounts: [{ id: 'main', name: 'Savings', balance: 2000 }],
    });
    usePeopleStore.setState({
      wishlist: [
        { id: 'w1', name: 'TV', estimatedCost: 1500, purchased: false },
        { id: 'w2', name: 'Laptop', estimatedCost: 2500, purchased: false },
        { id: 'w3', name: 'Chair', estimatedCost: 500, purchased: false },
      ],
    });

    const { result } = renderHook(() => useWishlistSummary());
    expect(result.current.affordableNow).toBe(2);   // TV + Chair
  });

  it('treats zero-cost items as not affordable (no false positives)', () => {
    useFinanceStore.setState({
      accounts: [{ id: 'main', name: 'Savings', balance: 5000 }],
    });
    usePeopleStore.setState({
      wishlist: [
        { id: 'w1', name: 'TBD item', estimatedCost: 0, purchased: false },
        { id: 'w2', name: 'No cost', estimatedCost: null, purchased: false },
      ],
    });

    const { result } = renderHook(() => useWishlistSummary());
    expect(result.current.affordableNow).toBe(0);
    expect(result.current.totalPendingCost).toBe(0);
  });

  it('hasWishlist is true even when all items are purchased', () => {
    usePeopleStore.setState({
      wishlist: [
        { id: 'w1', name: 'Done', estimatedCost: 100, purchased: true },
      ],
    });

    const { result } = renderHook(() => useWishlistSummary());
    expect(result.current.hasWishlist).toBe(true);
    expect(result.current.pendingCount).toBe(0);
  });

  it('handles string estimatedCost values (coerced via +)', () => {
    useFinanceStore.setState({
      accounts: [{ id: 'main', name: 'Savings', balance: 1000 }],
    });
    usePeopleStore.setState({
      wishlist: [
        { id: 'w1', name: 'Item', estimatedCost: '800', purchased: false },
      ],
    });

    const { result } = renderHook(() => useWishlistSummary());
    expect(result.current.totalPendingCost).toBe(800);
    expect(result.current.affordableNow).toBe(1);
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// useGoalsSummary
// ═══════════════════════════════════════════════════════════════════════════════

describe('useGoalsSummary', () => {
  it('returns empty when no goals exist', () => {
    const { result } = renderHook(() => useGoalsSummary());
    expect(result.current).toMatchObject({ goals: [], hasGoals: false });
  });

  it('calculates progress percentage from current balance', () => {
    useFinanceStore.setState({
      accounts: [{ id: 'main', name: 'Savings', balance: 7500 }],
      goals: [
        { id: 'g1', name: 'Holiday', amount: 10000 },
        { id: 'g2', name: 'Emergency Fund', amount: 5000 },
      ],
    });

    const { result } = renderHook(() => useGoalsSummary());
    expect(result.current.hasGoals).toBe(true);
    expect(result.current.goals).toHaveLength(2);

    const holiday = result.current.goals.find(g => g.id === 'g1');
    expect(holiday.progressPct).toBe(75);

    const emergency = result.current.goals.find(g => g.id === 'g2');
    expect(emergency.progressPct).toBe(100);   // clamped at 100
  });

  it('handles zero-amount goals (divide-by-zero safe)', () => {
    useFinanceStore.setState({
      accounts: [{ id: 'main', name: 'Savings', balance: 5000 }],
      goals: [{ id: 'g1', name: 'Empty Goal', amount: 0 }],
    });

    const { result } = renderHook(() => useGoalsSummary());
    expect(result.current.goals[0].progressPct).toBe(0);
  });

  it('handles null/undefined goal amount', () => {
    useFinanceStore.setState({
      accounts: [{ id: 'main', name: 'Savings', balance: 1000 }],
      goals: [{ id: 'g1', name: 'No Amount', amount: null }],
    });

    const { result } = renderHook(() => useGoalsSummary());
    expect(result.current.goals[0].progressPct).toBe(0);
    expect(result.current.goals[0].amount).toBe(0);
  });

  it('clamps progress at 100% when balance exceeds goal', () => {
    useFinanceStore.setState({
      accounts: [{ id: 'main', name: 'Savings', balance: 20000 }],
      goals: [{ id: 'g1', name: 'Small Goal', amount: 5000 }],
    });

    const { result } = renderHook(() => useGoalsSummary());
    expect(result.current.goals[0].progressPct).toBe(100);
  });

  it('returns 0% progress when no accounts / zero balance', () => {
    useFinanceStore.setState({
      goals: [{ id: 'g1', name: 'Goal', amount: 10000 }],
    });

    const { result } = renderHook(() => useGoalsSummary());
    expect(result.current.goals[0].progressPct).toBe(0);
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// usePropertyAlerts
// ═══════════════════════════════════════════════════════════════════════════════

describe('usePropertyAlerts', () => {
  it('returns empty with hasProperties=false when no properties', () => {
    const { result } = renderHook(() => usePropertyAlerts());
    expect(result.current).toMatchObject({ items: [], hasProperties: false });
  });

  it('returns hasProperties=true with no alerts when everything is clean', () => {
    usePropertyStore.setState({
      properties: [{ id: 'p1', name: 'Home' }],
      propertyTasks: [],
      propertyProjects: [],
      propertyAssets: [],
    });

    const { result } = renderHook(() => usePropertyAlerts());
    expect(result.current.hasProperties).toBe(true);
    expect(result.current.items).toHaveLength(0);
  });

  it('detects overdue tasks (dueDate < today)', () => {
    usePropertyStore.setState({
      properties: [{ id: 'p1', name: 'Home' }],
      propertyTasks: [
        { id: 't1', propertyId: 'p1', title: 'Fix roof', status: 'Todo', dueDate: '2026-03-10' },
        { id: 't2', propertyId: 'p1', title: 'Paint', status: 'Todo', dueDate: '2026-03-20' },
      ],
      propertyProjects: [],
      propertyAssets: [],
    });

    const { result } = renderHook(() => usePropertyAlerts());
    const overdue = result.current.items.find(i => i.id === 'prop-overdue');
    expect(overdue).toBeDefined();
    expect(overdue.severity).toBe('urgent');
    expect(overdue.label).toContain('1 overdue');
  });

  it('excludes Done and Cancelled tasks from overdue count', () => {
    usePropertyStore.setState({
      properties: [{ id: 'p1', name: 'Home' }],
      propertyTasks: [
        { id: 't1', propertyId: 'p1', title: 'Done task', status: 'Done', dueDate: '2026-03-01' },
        { id: 't2', propertyId: 'p1', title: 'Cancelled', status: 'Cancelled', dueDate: '2026-03-01' },
      ],
      propertyProjects: [],
      propertyAssets: [],
    });

    const { result } = renderHook(() => usePropertyAlerts());
    expect(result.current.items.find(i => i.id === 'prop-overdue')).toBeUndefined();
  });

  it('detects urgent-priority tasks (not already overdue)', () => {
    usePropertyStore.setState({
      properties: [{ id: 'p1', name: 'Home' }],
      propertyTasks: [
        { id: 't1', propertyId: 'p1', title: 'Urgent future', status: 'Todo', priority: 'Urgent', dueDate: '2026-04-01' },
      ],
      propertyProjects: [],
      propertyAssets: [],
    });

    const { result } = renderHook(() => usePropertyAlerts());
    const urgent = result.current.items.find(i => i.id === 'prop-urgent');
    expect(urgent).toBeDefined();
    expect(urgent.severity).toBe('warn');
  });

  it('detects poor/critical asset condition', () => {
    usePropertyStore.setState({
      properties: [{ id: 'p1', name: 'Home' }],
      propertyTasks: [],
      propertyProjects: [],
      propertyAssets: [
        { id: 'a1', propertyId: 'p1', name: 'Oven', condition: 'Critical' },
        { id: 'a2', propertyId: 'p1', name: 'Dishwasher', condition: 'Poor' },
        { id: 'a3', propertyId: 'p1', name: 'Fridge', condition: 'Good' },
      ],
    });

    const { result } = renderHook(() => usePropertyAlerts());
    const cond = result.current.items.find(i => i.id === 'prop-asset-condition');
    expect(cond).toBeDefined();
    expect(cond.label).toContain('2 assets');
    expect(cond.severity).toBe('urgent'); // has Critical
  });

  it('severity is warn (not urgent) when poor but no critical assets', () => {
    usePropertyStore.setState({
      properties: [{ id: 'p1', name: 'Home' }],
      propertyTasks: [],
      propertyProjects: [],
      propertyAssets: [
        { id: 'a1', propertyId: 'p1', name: 'Dishwasher', condition: 'Poor' },
      ],
    });

    const { result } = renderHook(() => usePropertyAlerts());
    const cond = result.current.items.find(i => i.id === 'prop-asset-condition');
    expect(cond.severity).toBe('warn');
  });

  it('detects warranties expiring within 90 days', () => {
    usePropertyStore.setState({
      properties: [{ id: 'p1', name: 'Home' }],
      propertyTasks: [],
      propertyProjects: [],
      propertyAssets: [
        { id: 'a1', propertyId: 'p1', name: 'Heat pump', warrantyExpiry: '2026-05-01', condition: 'Good' },
        { id: 'a2', propertyId: 'p1', name: 'Old item', warrantyExpiry: '2025-01-01', condition: 'Good' },  // expired
        { id: 'a3', propertyId: 'p1', name: 'Future', warrantyExpiry: '2027-01-01', condition: 'Good' },    // > 90d
      ],
    });

    const { result } = renderHook(() => usePropertyAlerts());
    const warranty = result.current.items.find(i => i.id === 'prop-warranty');
    expect(warranty).toBeDefined();
    expect(warranty.label).toContain('1 warranty');
  });

  it('ignores assets with no warrantyExpiry', () => {
    usePropertyStore.setState({
      properties: [{ id: 'p1', name: 'Home' }],
      propertyTasks: [],
      propertyProjects: [],
      propertyAssets: [
        { id: 'a1', propertyId: 'p1', name: 'No warranty', condition: 'Good' },
      ],
    });

    const { result } = renderHook(() => usePropertyAlerts());
    expect(result.current.items.find(i => i.id === 'prop-warranty')).toBeUndefined();
  });

  it('detects active projects', () => {
    usePropertyStore.setState({
      properties: [{ id: 'p1', name: 'Home' }],
      propertyTasks: [],
      propertyProjects: [
        { id: 'pr1', propertyId: 'p1', title: 'Renovation', status: 'In Progress' },
        { id: 'pr2', propertyId: 'p1', title: 'Done reno', status: 'Completed' },
        { id: 'pr3', propertyId: 'p1', title: 'Dropped', status: 'Cancelled' },
      ],
      propertyAssets: [],
    });

    const { result } = renderHook(() => usePropertyAlerts());
    const proj = result.current.items.find(i => i.id === 'prop-projects');
    expect(proj).toBeDefined();
    expect(proj.label).toContain('1 active');
    expect(proj.severity).toBe('info');
  });

  it('aggregates multiple alert types simultaneously', () => {
    usePropertyStore.setState({
      properties: [{ id: 'p1', name: 'Home' }],
      propertyTasks: [
        { id: 't1', propertyId: 'p1', title: 'Overdue', status: 'Todo', dueDate: '2026-01-01' },
      ],
      propertyProjects: [
        { id: 'pr1', propertyId: 'p1', title: 'Active', status: 'Planning' },
      ],
      propertyAssets: [
        { id: 'a1', propertyId: 'p1', name: 'Bad asset', condition: 'Poor' },
      ],
    });

    const { result } = renderHook(() => usePropertyAlerts());
    expect(result.current.items.length).toBe(3);
    expect(result.current.items.map(i => i.id)).toEqual(
      expect.arrayContaining(['prop-overdue', 'prop-asset-condition', 'prop-projects']),
    );
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// useNetWorth
// ═══════════════════════════════════════════════════════════════════════════════

describe('useNetWorth', () => {
  it('returns zeros and hasData=false when all stores are empty', () => {
    const { result } = renderHook(() => useNetWorth());
    expect(result.current).toMatchObject({
      cash: 0, investments: 0, property: 0, liabilities: 0, netWorth: 0, hasData: false,
    });
  });

  it('sums cash from multiple accounts', () => {
    useFinanceStore.setState({
      accounts: [
        { id: 'main', name: 'Savings', balance: 10000 },
        { id: 'emergency', name: 'Emergency', balance: 5000 },
      ],
    });

    const { result } = renderHook(() => useNetWorth());
    expect(result.current.cash).toBe(15000);
    expect(result.current.netWorth).toBe(15000);
    expect(result.current.hasData).toBe(true);
  });

  it('includes property valuations', () => {
    useFinanceStore.setState({
      accounts: [{ id: 'main', name: 'Savings', balance: 5000 }],
    });
    usePropertyStore.setState({
      properties: [
        { id: 'p1', name: 'Home', valuation: { estimatedValue: 800000 } },
        { id: 'p2', name: 'Bach', valuation: { estimatedValue: 350000 } },
      ],
    });

    const { result } = renderHook(() => useNetWorth());
    expect(result.current.property).toBe(1150000);
    expect(result.current.netWorth).toBe(1155000);
  });

  it('ignores properties without valuation', () => {
    usePropertyStore.setState({
      properties: [
        { id: 'p1', name: 'Home' },   // no valuation
        { id: 'p2', name: 'Bach', valuation: {} },  // empty valuation
        { id: 'p3', name: 'Lot', valuation: { estimatedValue: 0 } },  // zero
        { id: 'p4', name: 'Neg', valuation: { estimatedValue: -100 } },  // negative
      ],
    });

    const { result } = renderHook(() => useNetWorth());
    expect(result.current.property).toBe(0);
  });

  it('subtracts liabilities from net worth', () => {
    useFinanceStore.setState({
      accounts: [{ id: 'main', name: 'Savings', balance: 50000 }],
    });
    usePeopleStore.setState({
      expenses: [
        {
          id: 'loan1', name: 'Home Loan', type: 'loan', lender: 'ANZ',
          facilities: [
            { id: 'f1', label: 'Fixed', balance: 400000, rate: 5.5, amount: 1500, frequency: 'fortnightly', rateType: 'fixed' },
            { id: 'f2', label: 'Floating', balance: 100000, rate: 6.0, amount: 800, frequency: 'fortnightly', rateType: 'floating' },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useNetWorth());
    expect(result.current.liabilities).toBe(500000);
    expect(result.current.netWorth).toBe(50000 - 500000);  // negative net worth
    expect(result.current.hasData).toBe(true);
  });

  it('handles missing balance on facilities (coerced via +)', () => {
    usePeopleStore.setState({
      expenses: [
        {
          id: 'loan1', name: 'Loan', type: 'loan', lender: 'Bank',
          facilities: [
            { id: 'f1', label: 'A', balance: null, rate: 5, amount: 100, frequency: 'fortnightly' },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useNetWorth());
    expect(result.current.liabilities).toBe(0);
  });

  it('computes investment value from assets + priceCache', () => {
    useInvestmentStore.setState({
      investmentAssets: [
        { id: 'a1', portfolioId: 'p1', name: 'VGS', ticker: 'VGS', category: 'International Shares' },
      ],
      investmentTransactions: [
        { id: 'tx1', assetId: 'a1', portfolioId: 'p1', type: 'buy', date: '2026-01-15', units: 50, price: 90, fee: 0 },
      ],
      priceCache: [
        { assetId: 'a1', price: 100, date: '2026-03-16' },
      ],
    });

    const { result } = renderHook(() => useNetWorth());
    // 50 units * $100 price = $5000
    expect(result.current.investments).toBe(5000);
    expect(result.current.hasData).toBe(true);
  });

  it('returns hasData=true when only liabilities exist', () => {
    usePeopleStore.setState({
      expenses: [
        {
          id: 'loan1', name: 'Loan', type: 'loan', lender: 'Bank',
          facilities: [
            { id: 'f1', label: 'Fixed', balance: 100000, rate: 5, amount: 500, frequency: 'fortnightly' },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useNetWorth());
    expect(result.current.hasData).toBe(true);
    expect(result.current.netWorth).toBe(-100000);
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// useUpcomingObligations
// ═══════════════════════════════════════════════════════════════════════════════

describe('useUpcomingObligations', () => {
  it('returns empty when no people, expenses, or facilities', () => {
    const { result } = renderHook(() => useUpcomingObligations());
    expect(result.current).toMatchObject({ items: [], hasItems: false });
  });

  // ── Fixed-rate expiry ───────────────────────────────────────────────────────

  it('detects mortgage fixed-rate expiry within 180 days', () => {
    usePeopleStore.setState({
      expenses: [
        {
          id: 'loan1', name: 'Home Loan', type: 'loan', lender: 'ANZ',
          facilities: [
            { id: 'f1', label: '2yr Fixed', rateType: 'fixed', fixedTermExpiry: '2026-06-01', balance: 400000, rate: 5.5, amount: 1500, frequency: 'fortnightly' },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useUpcomingObligations());
    expect(result.current.hasItems).toBe(true);
    const item = result.current.items[0];
    expect(item.label).toContain('fixed rate expires');
    expect(item.severity).toBe('warn'); // ~77 days → warn
  });

  it('assigns urgent severity when fixed rate expires within 30 days', () => {
    usePeopleStore.setState({
      expenses: [
        {
          id: 'loan1', name: 'Mortgage', type: 'loan', lender: 'BNZ',
          facilities: [
            { id: 'f1', label: '1yr', rateType: 'fixed', fixedTermExpiry: '2026-04-01', balance: 300000, rate: 5, amount: 1000, frequency: 'fortnightly' },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useUpcomingObligations());
    // 2026-03-16 to 2026-04-01 = 16 days
    expect(result.current.items[0].severity).toBe('urgent');
    expect(result.current.items[0].detail).toBe('16d');
  });

  it('assigns info severity when fixed rate expires 91–180 days out', () => {
    usePeopleStore.setState({
      expenses: [
        {
          id: 'loan1', name: 'Mortgage', type: 'loan', lender: 'ANZ',
          facilities: [
            { id: 'f1', label: '5yr', rateType: 'fixed', fixedTermExpiry: '2026-08-15', balance: 200000, rate: 4.5, amount: 800, frequency: 'fortnightly' },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useUpcomingObligations());
    // 2026-03-16 to 2026-08-15 = ~152 days
    expect(result.current.items[0].severity).toBe('info');
  });

  it('ignores floating rate facilities', () => {
    usePeopleStore.setState({
      expenses: [
        {
          id: 'loan1', name: 'Mortgage', type: 'loan', lender: 'ANZ',
          facilities: [
            { id: 'f1', label: 'Float', rateType: 'floating', balance: 100000, rate: 6, amount: 500, frequency: 'fortnightly' },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useUpcomingObligations());
    expect(result.current.items).toHaveLength(0);
  });

  it('ignores fixed rate expiry beyond 180 days', () => {
    usePeopleStore.setState({
      expenses: [
        {
          id: 'loan1', name: 'Mortgage', type: 'loan', lender: 'ANZ',
          facilities: [
            { id: 'f1', label: 'Long', rateType: 'fixed', fixedTermExpiry: '2027-01-01', balance: 200000, rate: 5, amount: 800, frequency: 'fortnightly' },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useUpcomingObligations());
    expect(result.current.items).toHaveLength(0);
  });

  it('ignores already-expired fixed terms', () => {
    usePeopleStore.setState({
      expenses: [
        {
          id: 'loan1', name: 'Mortgage', type: 'loan', lender: 'ANZ',
          facilities: [
            { id: 'f1', label: 'Expired', rateType: 'fixed', fixedTermExpiry: '2026-01-01', balance: 200000, rate: 5, amount: 800, frequency: 'fortnightly' },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useUpcomingObligations());
    expect(result.current.items).toHaveLength(0);
  });

  // ── Income events ──────────────────────────────────────────────────────────

  it('detects income events starting within 90 days', () => {
    usePeopleStore.setState({
      people: [
        {
          id: 'p1', name: 'Alice', grossAnnual: 80000,
          incomeEvents: [
            { id: 'ev1', label: 'Parental Leave', startDate: '2026-04-15', endDate: '2026-10-15', grossAnnual: 30000 },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useUpcomingObligations());
    expect(result.current.hasItems).toBe(true);
    const start = result.current.items.find(i => i.id === 'income-start-ev1');
    expect(start).toBeDefined();
    expect(start.label).toContain('Alice');
    expect(start.label).toContain('Parental Leave starts');
    expect(start.severity).toBe('info'); // 30 days out
  });

  it('detects income events ending within 90 days', () => {
    usePeopleStore.setState({
      people: [
        {
          id: 'p1', name: 'Bob', grossAnnual: 70000,
          incomeEvents: [
            { id: 'ev1', label: 'Sabbatical', startDate: '2025-12-01', endDate: '2026-04-01', grossAnnual: 0 },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useUpcomingObligations());
    const end = result.current.items.find(i => i.id === 'income-end-ev1');
    expect(end).toBeDefined();
    expect(end.label).toContain('Sabbatical ends');
  });

  it('assigns warn severity for income events within 14 days', () => {
    usePeopleStore.setState({
      people: [
        {
          id: 'p1', name: 'Alice', grossAnnual: 80000,
          incomeEvents: [
            { id: 'ev1', label: 'Leave', startDate: '2026-03-25', endDate: '2026-06-25', grossAnnual: 30000 },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useUpcomingObligations());
    // 2026-03-16 to 2026-03-25 = 9 days
    const start = result.current.items.find(i => i.id === 'income-start-ev1');
    expect(start.severity).toBe('warn');
  });

  it('ignores income events beyond 90 days or already started', () => {
    usePeopleStore.setState({
      people: [
        {
          id: 'p1', name: 'Alice', grossAnnual: 80000,
          incomeEvents: [
            { id: 'ev1', label: 'Far away', startDate: '2026-12-01', endDate: '2027-03-01', grossAnnual: 0 },
            { id: 'ev2', label: 'Already started', startDate: '2026-03-01', endDate: '2026-09-01', grossAnnual: 50000 },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useUpcomingObligations());
    expect(result.current.items.find(i => i.id === 'income-start-ev1')).toBeUndefined();
    expect(result.current.items.find(i => i.id === 'income-start-ev2')).toBeUndefined();
  });

  it('handles people with no incomeEvents array', () => {
    usePeopleStore.setState({
      people: [{ id: 'p1', name: 'Solo', grossAnnual: 60000 }],
    });

    const { result } = renderHook(() => useUpcomingObligations());
    expect(result.current.items).toHaveLength(0);
  });

  // ── Recurring expenses ─────────────────────────────────────────────────────

  it('detects recurring expenses ending within 90 days', () => {
    usePeopleStore.setState({
      expenses: [
        { id: 'e1', name: 'Car Insurance', type: 'standard', endDate: '2026-05-01', amount: 150, frequency: 'monthly' },
      ],
    });

    const { result } = renderHook(() => useUpcomingObligations());
    const item = result.current.items.find(i => i.id === 'exp-end-e1');
    expect(item).toBeDefined();
    expect(item.label).toContain('Car Insurance expires');
  });

  it('ignores loan-type expenses (only standard)', () => {
    usePeopleStore.setState({
      expenses: [
        { id: 'e1', name: 'Mortgage', type: 'loan', endDate: '2026-04-01' },
      ],
    });

    const { result } = renderHook(() => useUpcomingObligations());
    expect(result.current.items.find(i => i.id === 'exp-end-e1')).toBeUndefined();
  });

  it('ignores expenses without endDate', () => {
    usePeopleStore.setState({
      expenses: [
        { id: 'e1', name: 'Rent', type: 'standard', amount: 2000, frequency: 'monthly' },
      ],
    });

    const { result } = renderHook(() => useUpcomingObligations());
    expect(result.current.items).toHaveLength(0);
  });

  // ── Sorting ────────────────────────────────────────────────────────────────

  it('sorts items by severity: urgent first, then warn, then info', () => {
    usePeopleStore.setState({
      people: [
        {
          id: 'p1', name: 'Alice', grossAnnual: 80000,
          incomeEvents: [
            { id: 'ev1', label: 'Leave', startDate: '2026-05-01', endDate: '2026-08-01', grossAnnual: 0 },
          ],
        },
      ],
      expenses: [
        {
          id: 'loan1', name: 'Mortgage', type: 'loan', lender: 'ANZ',
          facilities: [
            { id: 'f1', label: 'Fixed', rateType: 'fixed', fixedTermExpiry: '2026-04-01', balance: 200000, rate: 5, amount: 800, frequency: 'fortnightly' },
          ],
        },
        { id: 'e1', name: 'Insurance', type: 'standard', endDate: '2026-03-25', amount: 100, frequency: 'monthly' },
      ],
    });

    const { result } = renderHook(() => useUpcomingObligations());
    const severities = result.current.items.map(i => i.severity);
    // Urgent items first
    const urgentIdx = severities.indexOf('urgent');
    const warnIdx   = severities.indexOf('warn');
    const infoIdx   = severities.indexOf('info');
    if (urgentIdx >= 0 && warnIdx >= 0) expect(urgentIdx).toBeLessThan(warnIdx);
    if (warnIdx >= 0 && infoIdx >= 0) expect(warnIdx).toBeLessThan(infoIdx);
  });
});
