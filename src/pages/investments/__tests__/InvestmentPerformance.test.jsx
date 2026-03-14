// @vitest-environment jsdom
/**
 * Unit tests for the InvestmentPerformance page component.
 *
 * Covers: empty state, populated snapshot tiles, category breakdown,
 * rankings table, holdings detail table.
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

function seedHolding(overrides = {}) {
  const holding = {
    id: 'hold-1',
    portfolioId: PORT_ID,
    name: 'Vanguard S&P 500',
    ticker: 'VOO',
    platform: 'Sharesies',
    category: 'US Equities',
    units: 10,
    avgCost: 400,
    currentPrice: 450,
    notes: '',
    createdAt: '2026-01-15',
    ...overrides,
  };
  const current = useInvestmentStore.getState().investments || [];
  useInvestmentStore.setState({ investments: [...current, holding] });
  return holding;
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
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── tests ────────────────────────────────────────────────────────────────────

describe('InvestmentPerformance — empty state', () => {
  it('renders empty state when no holdings', () => {
    seedPortfolio();
    render(<InvestmentPerformance />);
    expect(screen.getByText(/Add holdings with cost and current price/)).toBeInTheDocument();
  });
});

describe('InvestmentPerformance — populated state', () => {
  it('renders snapshot tiles', () => {
    seedPortfolio();
    seedHolding();
    render(<InvestmentPerformance />);
    expect(screen.getByText('Portfolio Value')).toBeInTheDocument();
    expect(screen.getByText('Cost Basis')).toBeInTheDocument();
  });

  it('renders holdings detail table', () => {
    seedPortfolio();
    seedHolding({ name: 'Test Fund' });
    render(<InvestmentPerformance />);
    expect(screen.getByText('Holdings Detail')).toBeInTheDocument();
    // 'Test Fund' appears in ranked section + detail table
    expect(screen.getAllByText('Test Fund').length).toBeGreaterThanOrEqual(1);
  });

  it('renders ranked by return section', () => {
    seedPortfolio();
    seedHolding({ units: 10, avgCost: 100, currentPrice: 120 });
    render(<InvestmentPerformance />);
    expect(screen.getByText('Ranked by Return')).toBeInTheDocument();
  });

  it('renders category breakdown when multiple categories', () => {
    seedPortfolio();
    seedHolding({ id: 'h1', category: 'US Equities', units: 10, avgCost: 100, currentPrice: 120 });
    seedHolding({ id: 'h2', category: 'NZ Equities', units: 5, avgCost: 50, currentPrice: 60 });
    render(<InvestmentPerformance />);
    expect(screen.getByText('By Category')).toBeInTheDocument();
    expect(screen.getByText('US Equities')).toBeInTheDocument();
    expect(screen.getByText('NZ Equities')).toBeInTheDocument();
  });

  it('shows ticker in holdings detail', () => {
    seedPortfolio();
    seedHolding({ ticker: 'VOO' });
    render(<InvestmentPerformance />);
    expect(screen.getAllByText('VOO').length).toBeGreaterThanOrEqual(1);
  });

  it('renders portfolio history chart section', () => {
    seedPortfolio();
    seedHolding();
    render(<InvestmentPerformance />);
    expect(screen.getByText('Portfolio History')).toBeInTheDocument();
  });
});
