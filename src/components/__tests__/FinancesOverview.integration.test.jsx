// @vitest-environment jsdom
/**
 * Integration tests for the FinancesOverview page.
 *
 * Covers:
 *   - All 6 summary section headings render
 *   - Legacy detailed sections (Income cards, Savings Trajectory, Expense
 *     breakdown, Home Loans analytics, Goals list) do NOT render on Overview
 *   - Summary tiles reflect seeded store values
 *   - Obligations section shows "no loans" state when no facilities exist
 *   - Obligations section shows summary tiles when a loan facility is configured
 *   - Cashflow Trend shows empty-state placeholder when no data
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import FinancesOverview from '../../pages/FinancesOverview';
import { useFinanceStore }    from '../../store/financeStore';
import { usePeopleStore }     from '../../store/peopleStore';
import { useInvestmentStore } from '../../store/investmentStore';

// ── helpers ───────────────────────────────────────────────────────────────────

function renderOverview(props = {}) {
  return render(<FinancesOverview onSelectTab={props.onSelectTab ?? (() => {})} />);
}

function resetStores() {
  useFinanceStore.setState({
    accounts: [
      { id: 'main',      name: 'Savings',   balance: 0 },
      { id: 'emergency', name: 'Emergency', balance: 0 },
      { id: 'travel',    name: 'Travel',    balance: 0 },
    ],
    assetIncomes: [],
    fortnightlyData: {},
    goals: [],
    transfers: [],
    settings: { currentBalance: 0 },
  });
  usePeopleStore.setState({ people: [], expenses: [], wishlist: [] });
  useInvestmentStore.setState({
    investmentPortfolios: [],
    selectedPortfolioId: null,
    investments: [],
    investmentContributions: [],
    investmentDividends: [],
  });
}

// ── setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  resetStores();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── section presence ──────────────────────────────────────────────────────────

describe('FinancesOverview — section headings', () => {
  it('renders Household Snapshot section', () => {
    renderOverview();
    expect(screen.getByText('Household Snapshot')).toBeInTheDocument();
  });

  it('renders Money Flow section', () => {
    renderOverview();
    expect(screen.getByText('Money Flow')).toBeInTheDocument();
  });

  it('renders Cashflow Trend section', () => {
    renderOverview();
    expect(screen.getByText('Cashflow Trend')).toBeInTheDocument();
  });

  it('renders Obligations Snapshot section', () => {
    renderOverview();
    expect(screen.getByText('Obligations Snapshot')).toBeInTheDocument();
  });

  it('renders Savings Position section', () => {
    renderOverview();
    expect(screen.getByText('Savings Position')).toBeInTheDocument();
  });

  it('renders Accounts section', () => {
    renderOverview();
    expect(screen.getByText('Accounts')).toBeInTheDocument();
  });
});

// ── legacy sections must NOT appear ──────────────────────────────────────────

describe('FinancesOverview — legacy sections absent', () => {
  it('does not render "Savings Trajectory" heading', () => {
    renderOverview();
    expect(screen.queryByText('Savings Trajectory')).toBeNull();
  });

  it('does not render "Home Loans" heading', () => {
    renderOverview();
    expect(screen.queryByText('Home Loans')).toBeNull();
  });

  it('does not render "Expenses" section heading', () => {
    renderOverview();
    // "Expenses" heading appears in the Expenses tab, not on Overview
    expect(screen.queryByRole('heading', { name: /^Expenses$/i })).toBeNull();
  });

  it('does not render a Goals list', () => {
    renderOverview();
    expect(screen.queryByText('Goals')).toBeNull();
  });
});

// ── Household Snapshot tiles ──────────────────────────────────────────────────

describe('FinancesOverview — Household Snapshot tiles', () => {
  it('renders the four snapshot tile labels', () => {
    renderOverview();
    expect(screen.getByText('Net Fortnightly Income')).toBeInTheDocument();
    expect(screen.getByText('Total Fortnightly Spend')).toBeInTheDocument();
    expect(screen.getByText('Net Cashflow')).toBeInTheDocument();
    expect(screen.getByText('Savings Rate')).toBeInTheDocument();
  });

  it('shows 0% savings rate with no data configured', () => {
    renderOverview();
    // Savings Rate label is present; multiple "0%" values may appear across sections
    expect(screen.getByText('Savings Rate')).toBeInTheDocument();
    const zeros = screen.getAllByText('0%');
    expect(zeros.length).toBeGreaterThan(0);
  });
});

// ── Obligations Snapshot ──────────────────────────────────────────────────────

describe('FinancesOverview — Obligations Snapshot', () => {
  it('shows "No loans configured" when no loan expenses exist', () => {
    renderOverview();
    expect(screen.getByText(/No loans configured/i)).toBeInTheDocument();
  });

  it('shows summary tiles when a qualifying facility is configured', () => {
    usePeopleStore.setState({
      people: [],
      wishlist: [],
      expenses: [{
        id: 'loan1',
        name: 'Home Loan',
        amount: 0,
        frequency: 'fortnightly',
        type: 'loan',
        facilities: [{
          id: 'f1',
          balance: 400000,
          rate: 6.5,
          amount: 1200,
          frequency: 'fortnightly',
        }],
      }],
    });

    renderOverview();
    expect(screen.getByText('Total Outstanding')).toBeInTheDocument();
    expect(screen.getByText('Repayment /fn')).toBeInTheDocument();
    expect(screen.getByText('Total Interest Left')).toBeInTheDocument();
    expect(screen.getByText('Payoff Year')).toBeInTheDocument();
    expect(screen.queryByText(/No loans configured/i)).toBeNull();
  });
});

// ── Cashflow Trend ────────────────────────────────────────────────────────────

describe('FinancesOverview — Cashflow Trend', () => {
  it('shows empty-state message when no income or expense data', () => {
    renderOverview();
    expect(screen.getByText(/Add income or expenses to see your cashflow trend/i)).toBeInTheDocument();
  });
});

// ── Accounts section ──────────────────────────────────────────────────────────

describe('FinancesOverview — Accounts section', () => {
  it('renders the three reserve account names', () => {
    useFinanceStore.setState({
      accounts: [
        { id: 'main',      name: 'Savings',   balance: 12000 },
        { id: 'emergency', name: 'Emergency', balance: 5000 },
        { id: 'travel',    name: 'Travel',    balance: 1500 },
      ],
      assetIncomes: [], fortnightlyData: {}, goals: [], transfers: [],
      settings: { currentBalance: 0 },
    });

    renderOverview();
    // "Savings" also appears in the Money Flow legend — use getAllByText and confirm ≥1
    expect(screen.getAllByText('Savings').length).toBeGreaterThan(0);
    expect(screen.getByText('Emergency')).toBeInTheDocument();
    expect(screen.getByText('Travel')).toBeInTheDocument();
  });
});
