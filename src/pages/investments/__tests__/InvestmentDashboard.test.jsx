// @vitest-environment jsdom
/**
 * Unit tests for the InvestmentDashboard (Overview) page component.
 *
 * Covers: no portfolios state, no data state, populated snapshot,
 * allocation section, top assets list, recent activity, returns & income.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import InvestmentDashboard from '../InvestmentDashboard';
import { useInvestmentStore } from '../../../store/investmentStore';
import { NavigationProvider } from '../../../contexts/NavigationContext';

// ── helpers ──────────────────────────────────────────────────────────────────

const PORT_ID = 'port-1';

function seedPortfolio() {
  useInvestmentStore.setState({
    investmentPortfolios: [{ id: PORT_ID, name: 'Main Portfolio', createdAt: '2026-01-01' }],
    selectedPortfolioId: PORT_ID,
  });
}

function seedAsset(overrides = {}) {
  const asset = {
    id: 'asset-1',
    portfolioId: PORT_ID,
    name: 'Vanguard S&P 500',
    ticker: 'VOO',
    platform: 'Sharesies',
    category: 'ETF',
    currency: 'NZD',
    notes: '',
    createdAt: '2026-01-15',
    ...overrides,
  };
  const current = useInvestmentStore.getState().investmentAssets || [];
  useInvestmentStore.setState({ investmentAssets: [...current, asset] });
  return asset;
}

function seedTransaction(overrides = {}) {
  const tx = {
    id: 'tx-' + Math.random().toString(36).slice(2, 8),
    portfolioId: PORT_ID,
    assetId: 'asset-1',
    date: '2026-01-15',
    type: 'buy',
    units: 10,
    price: 400,
    amount: 4000,
    fee: 0,
    grossAmount: null,
    taxAmount: null,
    label: '',
    linkedTxId: null,
    notes: '',
    createdAt: '2026-01-15',
    ...overrides,
  };
  const current = useInvestmentStore.getState().investmentTransactions || [];
  useInvestmentStore.setState({ investmentTransactions: [...current, tx] });
  return tx;
}

function seedPrice(overrides = {}) {
  const entry = {
    assetId: 'asset-1',
    price: 450,
    currency: 'NZD',
    updatedAt: '2026-03-15',
    ...overrides,
  };
  const current = useInvestmentStore.getState().priceCache || [];
  useInvestmentStore.setState({ priceCache: [...current, entry] });
  return entry;
}

function renderDashboard() {
  return render(
    <NavigationProvider value={() => {}}>
      <InvestmentDashboard />
    </NavigationProvider>
  );
}

// ── setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
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
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── tests ────────────────────────────────────────────────────────────────────

describe('InvestmentDashboard — empty states', () => {
  it('renders empty state when no portfolios exist', () => {
    renderDashboard();
    expect(screen.getByText(/Create a portfolio/)).toBeInTheDocument();
  });

  it('renders no-data state when portfolio exists but empty', () => {
    seedPortfolio();
    renderDashboard();
    expect(screen.getByText(/No investment data yet/)).toBeInTheDocument();
  });
});

describe('InvestmentDashboard — populated state', () => {
  it('renders portfolio snapshot tiles', () => {
    seedPortfolio();
    seedAsset();
    seedTransaction();
    seedPrice();
    renderDashboard();
    expect(screen.getByText('Portfolio Snapshot')).toBeInTheDocument();
    expect(screen.getByText('Portfolio Value')).toBeInTheDocument();
    expect(screen.getByText('Total Invested')).toBeInTheDocument();
    expect(screen.getByText('Unrealised G/L')).toBeInTheDocument();
    expect(screen.getByText('Realised G/L')).toBeInTheDocument();
  });

  it('renders top assets section with asset name', () => {
    seedPortfolio();
    seedAsset({ name: 'Vanguard S&P 500' });
    seedTransaction();
    seedPrice();
    renderDashboard();
    expect(screen.getByText('Top Assets')).toBeInTheDocument();
    // Name may appear in both top assets and recent activity
    expect(screen.getAllByText('Vanguard S&P 500').length).toBeGreaterThanOrEqual(1);
  });

  it('renders ticker tag', () => {
    seedPortfolio();
    seedAsset({ ticker: 'VOO' });
    seedTransaction();
    seedPrice();
    renderDashboard();
    expect(screen.getByText('VOO')).toBeInTheDocument();
  });

  it('renders allocation section when assets have categories', () => {
    seedPortfolio();
    seedAsset({ category: 'ETF' });
    seedTransaction();
    seedPrice();
    renderDashboard();
    expect(screen.getByText('Allocation')).toBeInTheDocument();
    expect(screen.getAllByText('ETF').length).toBeGreaterThanOrEqual(1);
  });

  it('renders recent activity when transactions exist', () => {
    seedPortfolio();
    seedAsset();
    seedTransaction({ date: '2026-03-01' });
    seedPrice();
    renderDashboard();
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('renders returns and income section', () => {
    seedPortfolio();
    seedAsset();
    seedTransaction({ units: 10, price: 400, amount: 4000 });
    seedPrice({ price: 450 });
    renderDashboard();
    expect(screen.getByText('Total Return')).toBeInTheDocument();
  });
});
