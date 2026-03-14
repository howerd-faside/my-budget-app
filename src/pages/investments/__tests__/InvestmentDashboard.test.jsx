// @vitest-environment jsdom
/**
 * Unit tests for the InvestmentDashboard page component.
 *
 * Covers: no portfolios state, no data state, populated snapshot,
 * allocation section, holdings list, recent activity.
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

function seedContribution(overrides = {}) {
  const contrib = {
    id: 'contrib-1',
    portfolioId: PORT_ID,
    date: '2026-03-01',
    holdingId: 'hold-1',
    platform: 'Sharesies',
    amount: 500,
    type: 'Regular',
    notes: '',
    createdAt: '2026-03-01',
    ...overrides,
  };
  const current = useInvestmentStore.getState().investmentContributions || [];
  useInvestmentStore.setState({ investmentContributions: [...current, contrib] });
  return contrib;
}

function seedDividend(overrides = {}) {
  const div = {
    id: 'div-1',
    portfolioId: PORT_ID,
    date: '2026-03-05',
    holdingId: 'hold-1',
    platform: 'Sharesies',
    grossAmount: 50,
    taxAmount: 10,
    netAmount: 40,
    notes: '',
    createdAt: '2026-03-05',
    ...overrides,
  };
  const current = useInvestmentStore.getState().investmentDividends || [];
  useInvestmentStore.setState({ investmentDividends: [...current, div] });
  return div;
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
    seedHolding();
    renderDashboard();
    expect(screen.getByText('Portfolio Snapshot')).toBeInTheDocument();
    expect(screen.getByText('Portfolio Value')).toBeInTheDocument();
    expect(screen.getByText('Total Contributed')).toBeInTheDocument();
    expect(screen.getByText('Total Dividends')).toBeInTheDocument();
  });

  it('renders holdings section with holding name', () => {
    seedPortfolio();
    seedHolding({ name: 'Vanguard S&P 500' });
    renderDashboard();
    expect(screen.getByText('Vanguard S&P 500')).toBeInTheDocument();
  });

  it('renders ticker tag', () => {
    seedPortfolio();
    seedHolding({ ticker: 'VOO' });
    renderDashboard();
    expect(screen.getByText('VOO')).toBeInTheDocument();
  });

  it('renders allocation section when holdings have categories', () => {
    seedPortfolio();
    seedHolding({ category: 'US Equities' });
    renderDashboard();
    expect(screen.getByText('Allocation')).toBeInTheDocument();
    // 'US Equities' appears in both holdings row tag and allocation legend
    expect(screen.getAllByText('US Equities').length).toBeGreaterThanOrEqual(1);
  });

  it('renders recent activity when contributions/dividends exist', () => {
    seedPortfolio();
    seedHolding();
    seedContribution();
    seedDividend();
    renderDashboard();
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('renders performance section with unrealised return', () => {
    seedPortfolio();
    seedHolding({ units: 10, avgCost: 400, currentPrice: 450 });
    renderDashboard();
    expect(screen.getByText('Unrealised Return')).toBeInTheDocument();
  });
});
