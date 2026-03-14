// @vitest-environment jsdom
/**
 * Unit tests for the InvestmentContributions page component.
 *
 * Covers: empty state, populated rendering, summary tiles,
 * add/edit/delete contribution, confirm dialog.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvestmentContributions from '../InvestmentContributions';
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

function seedContribution(overrides = {}) {
  const contrib = {
    id: 'contrib-1',
    portfolioId: PORT_ID,
    date: '2026-03-01',
    holdingId: '',
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

describe('InvestmentContributions — empty state', () => {
  it('renders empty state when no contributions', () => {
    seedPortfolio();
    render(<InvestmentContributions />);
    expect(screen.getByText(/No contributions recorded yet/)).toBeInTheDocument();
  });

  it('renders add button in empty state', () => {
    seedPortfolio();
    render(<InvestmentContributions />);
    expect(screen.getByText('+ Add Contribution')).toBeInTheDocument();
  });
});

describe('InvestmentContributions — populated state', () => {
  it('renders summary tiles', () => {
    seedPortfolio();
    seedContribution();
    render(<InvestmentContributions />);
    expect(screen.getByText('All Time')).toBeInTheDocument();
    expect(screen.getByText('This Year')).toBeInTheDocument();
    expect(screen.getByText('This Month')).toBeInTheDocument();
  });

  it('renders contribution type pill', () => {
    seedPortfolio();
    seedContribution({ type: 'Regular' });
    render(<InvestmentContributions />);
    expect(screen.getByText('Regular')).toBeInTheDocument();
  });

  it('renders linked holding name', () => {
    seedPortfolio();
    seedHolding({ id: 'h1', name: 'My ETF' });
    seedContribution({ holdingId: 'h1' });
    render(<InvestmentContributions />);
    expect(screen.getByText('My ETF')).toBeInTheDocument();
  });
});

describe('InvestmentContributions — add contribution', () => {
  it('opens add modal and saves', async () => {
    seedPortfolio();
    const user = userEvent.setup();
    render(<InvestmentContributions />);

    await user.click(screen.getByText('+ Add Contribution'));
    expect(screen.getByRole('heading', { name: 'Add Contribution' })).toBeInTheDocument();

    const amountInput = screen.getByPlaceholderText('0.00');
    await user.clear(amountInput);
    await user.type(amountInput, '1000');

    await user.click(screen.getByRole('button', { name: 'Add Contribution' }));

    const { investmentContributions } = useInvestmentStore.getState();
    expect(investmentContributions.some(c => +c.amount === 1000)).toBe(true);
  });
});

describe('InvestmentContributions — edit contribution', () => {
  it('opens edit modal with existing data', async () => {
    seedPortfolio();
    seedContribution({ amount: 750 });
    const user = userEvent.setup();
    render(<InvestmentContributions />);

    await user.click(screen.getByLabelText('Edit contribution'));
    expect(screen.getByRole('heading', { name: 'Edit Contribution' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('750')).toBeInTheDocument();
  });
});

describe('InvestmentContributions — delete contribution', () => {
  it('shows confirm dialog and removes on confirm', async () => {
    seedPortfolio();
    seedContribution({ id: 'contrib-del' });
    const user = userEvent.setup();
    render(<InvestmentContributions />);

    await user.click(screen.getByLabelText('Delete contribution'));
    expect(screen.getByText('Remove this contribution?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(useInvestmentStore.getState().investmentContributions.find(c => c.id === 'contrib-del')).toBeUndefined();
  });
});
