// @vitest-environment jsdom
/**
 * Unit tests for the InvestmentPerformance page component (new model).
 *
 * Covers: empty state, performance summary tiles, period returns table,
 * category breakdown, asset detail table, chart section,
 * graceful degradation (no prices, no tickers, partial data).
 *
 * Recharts is mocked to avoid SVG rendering issues in jsdom.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useInvestmentStore } from '../../../store/investmentStore';

// Mock recharts before importing the component
vi.mock('recharts', () => {
  const Passthrough = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Passthrough,
    AreaChart: Passthrough,
    Area: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
  };
});

// Mock Toast context
vi.mock('../../../components/Toast', () => ({
  useToast: () => vi.fn(),
}));

// Import after mocks
import InvestmentPerformance from '../InvestmentPerformance';

// ── helpers ──────────────────────────────────────────────────────────────────

const PORT_ID = 'port-1';

function seedPortfolio() {
  useInvestmentStore.setState({
    investmentPortfolios: [{ id: PORT_ID, name: 'Main', createdAt: '2026-01-01' }],
    selectedPortfolioId: PORT_ID,
  });
}

function seedAsset(overrides = {}) {
  const asset = {
    id: 'asset-1',
    portfolioId: PORT_ID,
    name: 'Vanguard Total World',
    ticker: 'VT',
    platform: 'Hatch',
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

function seedTx(overrides = {}) {
  const tx = {
    id: 'tx-' + Math.random().toString(36).slice(2, 8),
    portfolioId: PORT_ID,
    assetId: 'asset-1',
    date: '2026-03-01',
    type: 'buy',
    units: 10,
    price: 100,
    amount: 1000,
    fee: 0,
    grossAmount: null,
    taxAmount: null,
    label: '',
    linkedTxId: null,
    notes: '',
    createdAt: '2026-03-01',
    ...overrides,
  };
  const current = useInvestmentStore.getState().investmentTransactions || [];
  useInvestmentStore.setState({ investmentTransactions: [...current, tx] });
  return tx;
}

function seedPrice(overrides = {}) {
  const entry = { assetId: 'asset-1', price: 120, currency: 'NZD', updatedAt: '2026-03-15', ...overrides };
  const current = useInvestmentStore.getState().priceCache || [];
  useInvestmentStore.setState({ priceCache: [...current, entry] });
  return entry;
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

describe('InvestmentPerformance — empty state', () => {
  it('renders empty state when no assets', () => {
    seedPortfolio();
    render(<InvestmentPerformance />);
    expect(screen.getByText(/No performance data yet/)).toBeInTheDocument();
  });
});

describe('InvestmentPerformance — performance summary', () => {
  it('renders performance-focused stat tiles', () => {
    seedPortfolio();
    seedAsset();
    seedTx({ type: 'buy', units: 10, price: 100, amount: 1000 });
    seedPrice({ price: 120 });
    render(<InvestmentPerformance />);

    expect(screen.getByText('Performance Summary')).toBeInTheDocument();
    expect(screen.getByText('Total Return')).toBeInTheDocument();
    expect(screen.getByText('Unrealised G/L')).toBeInTheDocument();
    expect(screen.getByText('Realised G/L')).toBeInTheDocument();
    expect(screen.getByText('Dividend Income')).toBeInTheDocument();
  });

  it('shows fees tile when fees exist', () => {
    seedPortfolio();
    seedAsset();
    seedTx({ type: 'buy', units: 10, price: 100, amount: 1000 });
    seedTx({ id: 'fee-1', type: 'fee', units: null, price: null, amount: 25, assetId: '' });
    seedPrice({ price: 120 });
    render(<InvestmentPerformance />);

    expect(screen.getByText('Fees Paid')).toBeInTheDocument();
  });
});

describe('InvestmentPerformance — period returns table', () => {
  it('renders period returns table with period rows', () => {
    seedPortfolio();
    seedAsset();
    seedTx({ type: 'buy', units: 10, price: 100, amount: 1000, date: '2026-03-01' });
    seedPrice({ price: 120 });
    render(<InvestmentPerformance />);

    expect(screen.getByText('Returns by Period')).toBeInTheDocument();
    expect(screen.getByText('1M')).toBeInTheDocument();
    expect(screen.getByText('3M')).toBeInTheDocument();
    expect(screen.getByText('YTD')).toBeInTheDocument();
    expect(screen.getByText('1Y')).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('shows dividend income in period table', () => {
    seedPortfolio();
    seedAsset();
    seedTx({ type: 'buy', units: 10, price: 100, amount: 1000, date: '2026-01-01' });
    seedTx({ id: 'div-1', type: 'dividend', units: null, price: null, amount: 50, grossAmount: 60, taxAmount: 10, date: '2026-03-01' });
    seedPrice({ price: 120 });
    render(<InvestmentPerformance />);

    // Dividend amount ($50) should appear in some period rows
    expect(screen.getAllByText('$50.00').length).toBeGreaterThanOrEqual(1);
  });
});

describe('InvestmentPerformance — category breakdown', () => {
  it('renders category breakdown when multiple categories', () => {
    seedPortfolio();
    seedAsset({ id: 'a1', category: 'ETF' });
    seedAsset({ id: 'a2', category: 'Shares', name: 'Fisher & Paykel', ticker: 'FPH' });
    seedTx({ assetId: 'a1', units: 10, price: 100, amount: 1000 });
    seedTx({ id: 'tx2', assetId: 'a2', units: 5, price: 50, amount: 250 });
    seedPrice({ assetId: 'a1', price: 120 });
    seedPrice({ assetId: 'a2', price: 60 });
    render(<InvestmentPerformance />);

    expect(screen.getByText('By Category')).toBeInTheDocument();
    expect(screen.getAllByText('ETF').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Shares').length).toBeGreaterThanOrEqual(1);
  });

  it('hides category breakdown with single category', () => {
    seedPortfolio();
    seedAsset({ category: 'ETF' });
    seedTx({ units: 10, price: 100, amount: 1000 });
    seedPrice({ price: 120 });
    render(<InvestmentPerformance />);

    expect(screen.queryByText('By Category')).not.toBeInTheDocument();
  });
});

describe('InvestmentPerformance — asset detail table', () => {
  it('renders asset detail table', () => {
    seedPortfolio();
    seedAsset({ name: 'Test Fund' });
    seedTx({ units: 10, price: 100, amount: 1000 });
    seedPrice({ price: 120 });
    render(<InvestmentPerformance />);

    expect(screen.getByText('Asset Detail')).toBeInTheDocument();
    expect(screen.getAllByText('Test Fund').length).toBeGreaterThanOrEqual(1);
  });

  it('shows realised G/L column in asset table', () => {
    seedPortfolio();
    seedAsset();
    seedTx({ id: 'buy-1', type: 'buy', units: 10, price: 100, amount: 1000, date: '2026-01-01' });
    seedTx({ id: 'sell-1', type: 'sell', units: 5, price: 150, amount: 750, date: '2026-02-01' });
    seedPrice({ price: 120 });
    render(<InvestmentPerformance />);

    // Table should have Realised column header
    const headers = document.querySelectorAll('.perf-table th');
    const headerTexts = Array.from(headers).map(h => h.textContent);
    expect(headerTexts).toContain('Realised');
  });
});

describe('InvestmentPerformance — chart section', () => {
  it('renders chart section with load button', () => {
    seedPortfolio();
    seedAsset({ ticker: 'VT' });
    seedTx({ units: 10, price: 100, amount: 1000 });
    seedPrice({ price: 120 });
    render(<InvestmentPerformance />);

    expect(screen.getByText('Portfolio History')).toBeInTheDocument();
    expect(screen.getByText('↓ Load History')).toBeInTheDocument();
  });

  it('shows compact hint when no tickers', () => {
    seedPortfolio();
    seedAsset({ ticker: '' });
    seedTx({ units: 10, price: 100, amount: 1000 });
    seedPrice({ price: 120 });
    render(<InvestmentPerformance />);

    expect(screen.getByText(/Add tickers to your assets/)).toBeInTheDocument();
  });
});

describe('InvestmentPerformance — graceful degradation', () => {
  it('renders with no price cache (value shows $0)', () => {
    seedPortfolio();
    seedAsset();
    seedTx({ units: 10, price: 100, amount: 1000 });
    // No seedPrice — price cache empty
    render(<InvestmentPerformance />);

    // Should still render without crashing
    expect(screen.getByText('Performance Summary')).toBeInTheDocument();
    expect(screen.getByText('Asset Detail')).toBeInTheDocument();
    // "No price" indicator in the table
    expect(screen.getByText('No price')).toBeInTheDocument();
  });

  it('renders with transactions but zero units (sold everything)', () => {
    seedPortfolio();
    seedAsset();
    seedTx({ id: 'b1', type: 'buy', units: 10, price: 100, amount: 1000, date: '2026-01-01' });
    seedTx({ id: 's1', type: 'sell', units: 10, price: 150, amount: 1500, date: '2026-02-01' });
    seedPrice({ price: 150 });
    render(<InvestmentPerformance />);

    expect(screen.getByText('Realised G/L')).toBeInTheDocument();
    expect(screen.getByText('Asset Detail')).toBeInTheDocument();
  });
});
