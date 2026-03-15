// @vitest-environment jsdom
/**
 * Unit tests for the InvestmentPortfolios page component.
 *
 * Covers: empty state, portfolio cards with stats, create, rename, archive,
 * unarchive, delete confirmation, aggregate summary, active selection.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvestmentPortfolios from '../InvestmentPortfolios';
import { useInvestmentStore } from '../../../store/investmentStore';

// ── helpers ──────────────────────────────────────────────────────────────────

function seedPortfolio(overrides = {}) {
  const p = {
    id: 'port-' + Math.random().toString(36).slice(2, 8),
    name: 'Main',
    currency: 'NZD',
    costBasisMethod: 'average',
    archived: false,
    createdAt: '2026-01-01',
    ...overrides,
  };
  const current = useInvestmentStore.getState().investmentPortfolios || [];
  useInvestmentStore.setState({ investmentPortfolios: [...current, p] });
  if (!useInvestmentStore.getState().selectedPortfolioId) {
    useInvestmentStore.setState({ selectedPortfolioId: p.id });
  }
  return p;
}

function seedAsset(portfolioId, overrides = {}) {
  const asset = {
    id: 'asset-' + Math.random().toString(36).slice(2, 8),
    portfolioId,
    name: 'Test Fund',
    ticker: 'TF',
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

function seedTx(portfolioId, assetId, overrides = {}) {
  const tx = {
    id: 'tx-' + Math.random().toString(36).slice(2, 8),
    portfolioId,
    assetId,
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

function seedPrice(assetId, price = 120) {
  const entry = { assetId, price, currency: 'NZD', updatedAt: '2026-03-15' };
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

describe('InvestmentPortfolios — empty state', () => {
  it('renders empty state when no portfolios', () => {
    render(<InvestmentPortfolios />);
    expect(screen.getByText(/No portfolios yet/)).toBeInTheDocument();
  });

  it('shows create button', () => {
    render(<InvestmentPortfolios />);
    expect(screen.getByText('+ New Portfolio')).toBeInTheDocument();
  });
});

describe('InvestmentPortfolios — portfolio cards', () => {
  it('renders portfolio card with name', () => {
    seedPortfolio({ id: 'p1', name: 'Growth' });
    render(<InvestmentPortfolios />);
    expect(screen.getAllByText('Growth').length).toBeGreaterThanOrEqual(1);
  });

  it('shows Active pill for selected portfolio', () => {
    const p = seedPortfolio({ id: 'p1', name: 'Main' });
    useInvestmentStore.setState({ selectedPortfolioId: 'p1' });
    render(<InvestmentPortfolios />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows asset count and value stats', () => {
    const p = seedPortfolio({ id: 'p1', name: 'Main' });
    const a = seedAsset('p1');
    seedTx('p1', a.id, { type: 'buy', units: 10, price: 100, amount: 1000 });
    seedPrice(a.id, 120);
    render(<InvestmentPortfolios />);

    // Card stats + settings summary may duplicate labels
    expect(screen.getAllByText('Assets').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Value')).toBeInTheDocument();
    expect(screen.getByText('Cost')).toBeInTheDocument();
    expect(screen.getByText('Return')).toBeInTheDocument();
  });
});

describe('InvestmentPortfolios — create', () => {
  it('creates a new portfolio via inline input', async () => {
    const user = userEvent.setup();
    render(<InvestmentPortfolios />);

    await user.click(screen.getByText('+ New Portfolio'));
    const input = screen.getByPlaceholderText('Portfolio name…');
    await user.type(input, 'New Fund');
    await user.keyboard('{Enter}');

    // Portfolio should now appear (card name + settings subtitle)
    expect(screen.getAllByText('New Fund').length).toBeGreaterThanOrEqual(1);
  });
});

describe('InvestmentPortfolios — archive', () => {
  it('archives a portfolio and shows it in archived section', async () => {
    const user = userEvent.setup();
    const p = seedPortfolio({ id: 'p1', name: 'Old Fund' });
    seedPortfolio({ id: 'p2', name: 'Active Fund' });
    useInvestmentStore.setState({ selectedPortfolioId: 'p2' });
    render(<InvestmentPortfolios />);

    // Find the Archive button for Old Fund
    const archiveBtn = screen.getAllByTitle('Archive')[0];
    await user.click(archiveBtn);

    // Should now show Archived section
    expect(screen.getByText(/Archived/)).toBeInTheDocument();
  });

  it('unarchives a portfolio and selects it', async () => {
    const user = userEvent.setup();
    seedPortfolio({ id: 'p1', name: 'Active Fund' });
    seedPortfolio({ id: 'p2', name: 'Hidden Fund', archived: true });
    useInvestmentStore.setState({ selectedPortfolioId: 'p1' });
    render(<InvestmentPortfolios />);

    // Show archived
    await user.click(screen.getByText('Show'));

    // Unarchive
    const unarchiveBtn = screen.getByTitle('Unarchive');
    await user.click(unarchiveBtn);

    // Should now be selected
    expect(useInvestmentStore.getState().selectedPortfolioId).toBe('p2');
  });
});

describe('InvestmentPortfolios — delete', () => {
  it('shows confirmation dialog before deleting', async () => {
    const user = userEvent.setup();
    seedPortfolio({ id: 'p1', name: 'Growth' });
    render(<InvestmentPortfolios />);

    const deleteBtn = screen.getByTitle('Delete');
    await user.click(deleteBtn);

    // Dialog overlay should be visible (modal-overlay class)
    expect(document.querySelector('.modal-overlay')).toBeInTheDocument();
    // Cancel button exists in dialog
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });
});

describe('InvestmentPortfolios — aggregate', () => {
  it('shows aggregate summary when multiple active portfolios', () => {
    const p1 = seedPortfolio({ id: 'p1', name: 'Fund A' });
    const p2 = seedPortfolio({ id: 'p2', name: 'Fund B' });
    const a1 = seedAsset('p1', { id: 'a1' });
    const a2 = seedAsset('p2', { id: 'a2' });
    seedTx('p1', 'a1', { type: 'buy', units: 10, price: 100, amount: 1000 });
    seedTx('p2', 'a2', { type: 'buy', units: 5, price: 200, amount: 1000 });
    seedPrice('a1', 120);
    seedPrice('a2', 220);
    render(<InvestmentPortfolios />);

    expect(screen.getByText('Total Value')).toBeInTheDocument();
    expect(screen.getByText('Total Cost')).toBeInTheDocument();
    expect(screen.getByText('Total Return')).toBeInTheDocument();
    expect(screen.getByText('Total Assets')).toBeInTheDocument();
  });

  it('hides aggregate when only one portfolio', () => {
    seedPortfolio({ id: 'p1', name: 'Solo' });
    render(<InvestmentPortfolios />);

    expect(screen.queryByText('Total Value')).not.toBeInTheDocument();
  });
});

describe('InvestmentPortfolios — selection', () => {
  it('clicking a portfolio card selects it', async () => {
    const user = userEvent.setup();
    seedPortfolio({ id: 'p1', name: 'Fund A' });
    seedPortfolio({ id: 'p2', name: 'Fund B' });
    useInvestmentStore.setState({ selectedPortfolioId: 'p1' });
    render(<InvestmentPortfolios />);

    // Click Fund B card
    await user.click(screen.getByText('Fund B'));

    expect(useInvestmentStore.getState().selectedPortfolioId).toBe('p2');
  });
});

describe('InvestmentPortfolios — rename', () => {
  it('renders rename button on hover area', () => {
    seedPortfolio({ id: 'p1', name: 'Main' });
    render(<InvestmentPortfolios />);
    expect(screen.getByTitle('Rename')).toBeInTheDocument();
  });
});

describe('InvestmentPortfolios — settings', () => {
  it('renders Portfolio Settings card for selected portfolio', () => {
    seedPortfolio({ id: 'p1', name: 'Growth' });
    render(<InvestmentPortfolios />);
    expect(screen.getByText('Portfolio Settings')).toBeInTheDocument();
  });

  it('shows currency and cost basis method selectors', () => {
    seedPortfolio({ id: 'p1', name: 'Growth' });
    render(<InvestmentPortfolios />);
    expect(screen.getByText('Base Currency')).toBeInTheDocument();
    expect(screen.getByText('Cost Basis Method')).toBeInTheDocument();
  });

  it('shows portfolio summary stats in settings', () => {
    const p = seedPortfolio({ id: 'p1', name: 'Growth' });
    const a = seedAsset('p1');
    seedTx('p1', a.id, { type: 'buy', units: 10, price: 100, amount: 1000 });
    seedPrice(a.id, 120);
    render(<InvestmentPortfolios />);
    expect(screen.getByText('Market Value')).toBeInTheDocument();
    expect(screen.getByText('Cost Basis')).toBeInTheDocument();
    expect(screen.getByText('Unrealised G/L')).toBeInTheDocument();
  });

  it('updates currency when changed', async () => {
    const user = userEvent.setup();
    seedPortfolio({ id: 'p1', name: 'Test' });
    render(<InvestmentPortfolios />);

    const currSelect = screen.getByDisplayValue('NZD');
    await user.selectOptions(currSelect, 'USD');

    const updated = useInvestmentStore.getState().investmentPortfolios.find(p => p.id === 'p1');
    expect(updated.currency).toBe('USD');
  });

  it('updates cost basis method when changed', async () => {
    const user = userEvent.setup();
    seedPortfolio({ id: 'p1', name: 'Test' });
    render(<InvestmentPortfolios />);

    const cbmSelect = screen.getByDisplayValue('Weighted Average');
    await user.selectOptions(cbmSelect, 'fifo');

    const updated = useInvestmentStore.getState().investmentPortfolios.find(p => p.id === 'p1');
    expect(updated.costBasisMethod).toBe('fifo');
  });
});
