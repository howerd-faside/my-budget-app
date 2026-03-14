// @vitest-environment jsdom
/**
 * Unit tests for the InvestmentDividends page component.
 *
 * Covers: empty state, populated rendering, summary tiles,
 * add/edit/delete dividend, confirm dialog.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvestmentDividends from '../InvestmentDividends';
import { useInvestmentStore } from '../../../store/investmentStore';

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

function seedDividend(overrides = {}) {
  const div = {
    id: 'div-1',
    portfolioId: PORT_ID,
    date: '2026-03-05',
    holdingId: '',
    platform: 'Sharesies',
    grossAmount: 100,
    taxAmount: 20,
    netAmount: 80,
    notes: '',
    createdAt: '2026-03-05',
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

describe('InvestmentDividends — empty state', () => {
  it('renders empty state when no dividends', () => {
    seedPortfolio();
    render(<InvestmentDividends />);
    expect(screen.getByText(/No dividends recorded yet/)).toBeInTheDocument();
  });

  it('renders add button in empty state', () => {
    seedPortfolio();
    render(<InvestmentDividends />);
    expect(screen.getByText('+ Add Dividend')).toBeInTheDocument();
  });
});

describe('InvestmentDividends — populated state', () => {
  it('renders summary tiles', () => {
    seedPortfolio();
    seedDividend();
    render(<InvestmentDividends />);
    expect(screen.getByText('Gross Total')).toBeInTheDocument();
    expect(screen.getByText('Tax Withheld')).toBeInTheDocument();
    expect(screen.getByText('Net Received')).toBeInTheDocument();
  });

  it('renders dividend pill', () => {
    seedPortfolio();
    seedDividend();
    render(<InvestmentDividends />);
    expect(screen.getByText('Dividend')).toBeInTheDocument();
  });

  it('renders linked holding name', () => {
    seedPortfolio();
    seedHolding({ id: 'h1', name: 'My Fund' });
    seedDividend({ holdingId: 'h1' });
    render(<InvestmentDividends />);
    expect(screen.getByText('My Fund')).toBeInTheDocument();
  });

  it('shows tax pill when tax withheld', () => {
    seedPortfolio();
    seedDividend({ taxAmount: 15 });
    render(<InvestmentDividends />);
    expect(screen.getByText(/Tax \$/)).toBeInTheDocument();
  });
});

describe('InvestmentDividends — add dividend', () => {
  it('opens add modal and saves', async () => {
    seedPortfolio();
    const user = userEvent.setup();
    render(<InvestmentDividends />);

    await user.click(screen.getByText('+ Add Dividend'));
    expect(screen.getByRole('heading', { name: 'Add Dividend' })).toBeInTheDocument();

    // Multiple inputs have placeholder '0.00' (gross, tax, net) — first one is gross
    const numInputs = screen.getAllByPlaceholderText('0.00');
    await user.clear(numInputs[0]);
    await user.type(numInputs[0], '200');

    await user.click(screen.getByRole('button', { name: 'Add Dividend' }));

    const { investmentDividends } = useInvestmentStore.getState();
    expect(investmentDividends.some(d => +d.grossAmount === 200)).toBe(true);
  });
});

describe('InvestmentDividends — edit dividend', () => {
  it('opens edit modal with existing data', async () => {
    seedPortfolio();
    seedDividend({ grossAmount: 100 });
    const user = userEvent.setup();
    render(<InvestmentDividends />);

    await user.click(screen.getByLabelText('Edit dividend'));
    expect(screen.getByRole('heading', { name: 'Edit Dividend' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
  });
});

describe('InvestmentDividends — delete dividend', () => {
  it('shows confirm dialog and removes on confirm', async () => {
    seedPortfolio();
    seedDividend({ id: 'div-del' });
    const user = userEvent.setup();
    render(<InvestmentDividends />);

    await user.click(screen.getByLabelText('Delete dividend'));
    expect(screen.getByText('Remove this dividend record?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(useInvestmentStore.getState().investmentDividends.find(d => d.id === 'div-del')).toBeUndefined();
  });
});
