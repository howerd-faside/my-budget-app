// @vitest-environment jsdom
/**
 * Unit tests for the InvestmentTaxSummary page component.
 *
 * Covers: empty state (no activity), populated summary tiles,
 * contributions section, dividends section, year navigation.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvestmentTaxSummary from '../InvestmentTaxSummary';
import { useInvestmentStore } from '../../../store/investmentStore';

// ── helpers ──────────────────────────────────────────────────────────────────

const PORT_ID = 'port-1';
const THIS_YEAR = new Date().getFullYear();

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
    name: 'Vanguard ETF',
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
    date: `${THIS_YEAR}-03-01`,
    holdingId: 'hold-1',
    platform: 'Sharesies',
    amount: 1000,
    type: 'Regular',
    notes: '',
    createdAt: `${THIS_YEAR}-03-01`,
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
    date: `${THIS_YEAR}-03-05`,
    holdingId: 'hold-1',
    platform: 'Sharesies',
    grossAmount: 100,
    taxAmount: 20,
    netAmount: 80,
    notes: '',
    createdAt: `${THIS_YEAR}-03-05`,
    ...overrides,
  };
  const current = useInvestmentStore.getState().investmentDividends || [];
  useInvestmentStore.setState({ investmentDividends: [...current, div] });
  return div;
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

describe('InvestmentTaxSummary — empty state', () => {
  it('renders empty state when no activity for selected year', () => {
    seedPortfolio();
    render(<InvestmentTaxSummary />);
    expect(screen.getByText(new RegExp(`No investment activity recorded for ${THIS_YEAR}`))).toBeInTheDocument();
  });
});

describe('InvestmentTaxSummary — populated state', () => {
  it('renders summary tiles', () => {
    seedPortfolio();
    seedHolding();
    seedContribution();
    seedDividend();
    render(<InvestmentTaxSummary />);
    expect(screen.getByText('Contributions')).toBeInTheDocument();
    expect(screen.getByText('Dividend Income')).toBeInTheDocument();
    expect(screen.getByText('Tax Withheld')).toBeInTheDocument();
    expect(screen.getByText('Net Dividends')).toBeInTheDocument();
  });

  it('renders contributions section with holding name', () => {
    seedPortfolio();
    seedHolding({ id: 'h1', name: 'My Fund' });
    seedContribution({ holdingId: 'h1' });
    render(<InvestmentTaxSummary />);
    expect(screen.getByText('My Fund')).toBeInTheDocument();
  });

  it('renders dividends section with tax breakdown', () => {
    seedPortfolio();
    seedHolding();
    seedDividend({ grossAmount: 200, taxAmount: 40, netAmount: 160 });
    render(<InvestmentTaxSummary />);
    expect(screen.getByText('Gross dividends')).toBeInTheDocument();
    expect(screen.getByText(/Tax withheld/)).toBeInTheDocument();
    expect(screen.getByText('Net dividends received')).toBeInTheDocument();
  });
});

describe('InvestmentTaxSummary — year navigation', () => {
  it('renders year bar with current year', () => {
    seedPortfolio();
    render(<InvestmentTaxSummary />);
    expect(screen.getByText(String(THIS_YEAR))).toBeInTheDocument();
  });

  it('switches year when a different year pill is clicked', async () => {
    seedPortfolio();
    seedHolding();
    seedContribution();
    const user = userEvent.setup();
    render(<InvestmentTaxSummary />);

    // Click a different year — should show empty state for that year
    const prevYear = THIS_YEAR - 1;
    const yearBtn = screen.getByText(String(prevYear));
    await user.click(yearBtn);

    expect(screen.getByText(new RegExp(`No investment activity recorded for ${prevYear}`))).toBeInTheDocument();
  });
});
