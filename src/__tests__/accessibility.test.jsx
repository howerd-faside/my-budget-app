// @vitest-environment jsdom
/**
 * Accessibility tests — run axe-core against each major page component
 * to verify WCAG 2.1 Level A/AA compliance.
 *
 * Pages tested: Dashboard, Expenses, People, Wishlist, FinancialTracking,
 * PropertyOverview, PropertyRegister, PropertyTasks,
 * InvestmentDashboard, InvestmentAssets.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';

// ── Mock recharts (jsdom has no SVG layout engine) ──────────────────────────
vi.mock('recharts', () => {
  const Passthrough = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Passthrough,
    AreaChart: Passthrough,
    BarChart: Passthrough,
    LineChart: Passthrough,
    Area: () => null,
    Bar: () => null,
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    ReferenceLine: () => null,
  };
});

// ── Mock Toast context ──────────────────────────────────────────────────────
vi.mock('../components/Toast', () => ({
  useToast: () => vi.fn(),
  ToastProvider: ({ children }) => <>{children}</>,
}));

// ── Imports (after mocks) ───────────────────────────────────────────────────
import Dashboard from '../pages/Dashboard';
import Expenses from '../pages/Expenses';
import People from '../pages/People';
import Wishlist from '../pages/Wishlist';
import FinancialTracking from '../pages/FinancialTracking';
import PropertyOverview from '../pages/property/PropertyOverview';
import PropertyRegister from '../pages/property/PropertyRegister';
import PropertyTasks from '../pages/property/PropertyTasks';
import InvestmentDashboard from '../pages/investments/InvestmentDashboard';
import InvestmentAssets from '../pages/investments/InvestmentAssets';

import { useFinanceStore } from '../store/financeStore';
import { usePeopleStore } from '../store/peopleStore';
import { usePropertyStore } from '../store/propertyStore';
import { useInvestmentStore } from '../store/investmentStore';
import { NavigationProvider } from '../contexts/NavigationContext';

// ── Helpers ─────────────────────────────────────────────────────────────────

const PROP_ID = 'prop-1';
const PORT_ID = 'port-1';

function resetStores() {
  useFinanceStore.setState({
    accounts: [
      { id: 'main', name: 'Savings', balance: 1000 },
      { id: 'emergency', name: 'Emergency', balance: 500 },
    ],
    transfers: [],
    fortnightlyData: {},
    goals: [],
    assetIncomes: [],
    settings: { currentBalance: 0 },
  });
  usePeopleStore.setState({
    people: [],
    expenses: [],
    wishlist: [],
  });
  usePropertyStore.setState({
    properties: [],
    propertyTasks: [],
    propertyMaintenance: [],
    propertyProjects: [],
    propertyAssets: [],
    selectedPropertyId: null,
  });
  useInvestmentStore.setState({
    investmentPortfolios: [],
    selectedPortfolioId: null,
    investments: [],
    investmentContributions: [],
    investmentDividends: [],
    investmentAssets: [],
    investmentTransactions: [],
    priceCache: [],
  });
}

function seedPerson() {
  usePeopleStore.setState({
    people: [{
      id: 'p1', name: 'Alice', taxCode: 'M', kiwiSaverRate: 3,
      payFrequency: 'fortnightly', grossAnnual: 80000,
      secondaryIncomes: [], incomeEvents: [],
    }],
  });
}

function seedExpenses() {
  usePeopleStore.setState({
    expenses: [{
      id: 'e1', name: 'Groceries', amount: 200, frequency: 'fortnightly',
      group: 'Groceries & Household', category: 'Groceries', notes: '',
    }],
  });
}

function seedProperty() {
  usePropertyStore.setState({
    properties: [{
      id: PROP_ID, name: 'Test House', type: 'House', address: '1 Test St',
      areas: [{ id: 'area-1', name: 'Kitchen', group: 'Interior' }],
    }],
    selectedPropertyId: PROP_ID,
  });
}

function seedPortfolio() {
  useInvestmentStore.setState({
    investmentPortfolios: [{ id: PORT_ID, name: 'Main', createdAt: '2026-01-01' }],
    selectedPortfolioId: PORT_ID,
  });
}

function seedAsset() {
  useInvestmentStore.setState({
    investmentAssets: [{
      id: 'a1', portfolioId: PORT_ID, name: 'Vanguard ETF', ticker: 'VOO',
      platform: 'Sharesies', category: 'ETF', currency: 'NZD',
      notes: '', createdAt: '2026-01-15',
    }],
    investmentTransactions: [{
      id: 'tx1', portfolioId: PORT_ID, assetId: 'a1', date: '2026-01-15',
      type: 'buy', units: 10, price: 400, amount: 4000, fee: 0,
      grossAmount: null, taxAmount: null, label: '', linkedTxId: null,
      notes: '', createdAt: '2026-01-15',
    }],
    priceCache: [{
      assetId: 'a1', price: 450, currency: 'NZD', updatedAt: '2026-03-15',
    }],
  });
}

function withNav(ui) {
  return <NavigationProvider value={() => {}}>{ui}</NavigationProvider>;
}

// ── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  resetStores();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Axe helper ──────────────────────────────────────────────────────────────

async function expectNoA11yViolations(ui) {
  const { container } = render(ui);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Accessibility — Finance pages', () => {
  it('Dashboard has no a11y violations (empty)', async () => {
    await expectNoA11yViolations(<Dashboard />);
  });

  it('Dashboard has no a11y violations (populated)', async () => {
    seedPerson();
    await expectNoA11yViolations(<Dashboard />);
  });

  it('Expenses has no a11y violations (empty)', async () => {
    await expectNoA11yViolations(<Expenses />);
  });

  it('Expenses has no a11y violations (populated)', async () => {
    seedExpenses();
    await expectNoA11yViolations(<Expenses />);
  });

  it('People has no a11y violations (empty)', async () => {
    await expectNoA11yViolations(<People />);
  });

  it('People has no a11y violations (populated)', async () => {
    seedPerson();
    await expectNoA11yViolations(<People />);
  });

  it('Wishlist has no a11y violations (empty)', async () => {
    await expectNoA11yViolations(<Wishlist />);
  });

  it('FinancialTracking has no a11y violations (empty)', async () => {
    await expectNoA11yViolations(<FinancialTracking />);
  });
});

describe('Accessibility — Property pages', () => {
  it('PropertyOverview has no a11y violations (empty)', async () => {
    await expectNoA11yViolations(withNav(<PropertyOverview />));
  });

  it('PropertyOverview has no a11y violations (populated)', async () => {
    seedProperty();
    await expectNoA11yViolations(withNav(<PropertyOverview />));
  });

  it('PropertyRegister has no a11y violations (empty)', async () => {
    await expectNoA11yViolations(withNav(<PropertyRegister />));
  });

  it('PropertyRegister has no a11y violations (populated)', async () => {
    seedProperty();
    await expectNoA11yViolations(withNav(<PropertyRegister />));
  });

  it('PropertyTasks has no a11y violations (empty)', async () => {
    await expectNoA11yViolations(<PropertyTasks />);
  });

  it('PropertyTasks has no a11y violations (populated)', async () => {
    seedProperty();
    usePropertyStore.setState({
      propertyTasks: [{
        id: 'task-1', propertyId: PROP_ID, title: 'Fix Roof',
        description: '', areaId: '', category: 'Repair', priority: 'High',
        status: 'To Do', dueDate: '2026-04-01', effort: '',
        notes: [], recurring: null, createdAt: '2026-03-01',
      }],
    });
    await expectNoA11yViolations(<PropertyTasks />);
  });
});

describe('Accessibility — Investment pages', () => {
  it('InvestmentDashboard has no a11y violations (empty)', async () => {
    await expectNoA11yViolations(withNav(<InvestmentDashboard />));
  });

  it('InvestmentDashboard has no a11y violations (populated)', async () => {
    seedPortfolio();
    seedAsset();
    await expectNoA11yViolations(withNav(<InvestmentDashboard />));
  });

  it('InvestmentAssets has no a11y violations (empty)', async () => {
    seedPortfolio();
    await expectNoA11yViolations(<InvestmentAssets />);
  });

  it('InvestmentAssets has no a11y violations (populated)', async () => {
    seedPortfolio();
    seedAsset();
    await expectNoA11yViolations(<InvestmentAssets />);
  });
});
