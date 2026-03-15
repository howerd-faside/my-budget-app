// @vitest-environment jsdom
/**
 * Unit tests for the InvestmentDiscovery page component.
 *
 * Covers: empty state, watchlist rendering, manual add, remove,
 * edit modal, expand/collapse, convert button, quote lookup UI.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useInvestmentStore } from '../../../store/investmentStore';

// Mock Toast context
vi.mock('../../../components/Toast', () => ({
  useToast: () => vi.fn(),
}));

// Mock price service (no network in tests)
vi.mock('../../../utils/priceService', () => ({
  fetchQuote: vi.fn(),
}));

import InvestmentDiscovery from '../InvestmentDiscovery';

// ── helpers ──────────────────────────────────────────────────────────────────

const PORT_ID = 'port-1';

function seedPortfolio() {
  useInvestmentStore.setState({
    investmentPortfolios: [{ id: PORT_ID, name: 'Main', currency: 'NZD', costBasisMethod: 'average', archived: false, createdAt: '2026-01-01' }],
    selectedPortfolioId: PORT_ID,
  });
}

function seedWatchlistItem(overrides = {}) {
  const item = {
    id: 'wl-' + Math.random().toString(36).slice(2, 8),
    ticker: 'VTI',
    name: 'Vanguard Total Stock Market',
    category: 'ETF',
    currency: 'USD',
    targetPrice: 240,
    thesis: 'Broad US market exposure',
    tags: ['US', 'Core'],
    priceAtAdd: 250,
    addedAt: '2026-03-01',
    ...overrides,
  };
  const current = useInvestmentStore.getState().watchlist || [];
  useInvestmentStore.setState({ watchlist: [...current, item] });
  return item;
}

function seedWatchlistPrice(ticker = 'VTI', price = 248) {
  const entry = { ticker, price, currency: 'USD', updatedAt: '2026-03-15T12:00:00Z' };
  const current = useInvestmentStore.getState().watchlistPrices || [];
  useInvestmentStore.setState({ watchlistPrices: [...current, entry] });
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
    watchlist: [],
    watchlistPrices: [],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── tests ────────────────────────────────────────────────────────────────────

describe('InvestmentDiscovery — empty state', () => {
  it('renders empty watchlist message', () => {
    seedPortfolio();
    render(<InvestmentDiscovery />);
    expect(screen.getByText(/Nothing on your watchlist yet/)).toBeInTheDocument();
  });

  it('shows quote lookup input', () => {
    seedPortfolio();
    render(<InvestmentDiscovery />);
    expect(screen.getByPlaceholderText(/Enter ticker/)).toBeInTheDocument();
  });

  it('shows Look Up button', () => {
    seedPortfolio();
    render(<InvestmentDiscovery />);
    expect(screen.getByRole('button', { name: /Look Up/ })).toBeInTheDocument();
  });

  it('shows + Add button', () => {
    seedPortfolio();
    render(<InvestmentDiscovery />);
    // The section header add button
    expect(screen.getByText('+ Add')).toBeInTheDocument();
  });
});

describe('InvestmentDiscovery — watchlist rendering', () => {
  it('renders watchlist item with ticker', () => {
    seedPortfolio();
    seedWatchlistItem({ ticker: 'VTI', name: 'Vanguard Total Stock Market' });
    render(<InvestmentDiscovery />);
    expect(screen.getByText('VTI')).toBeInTheDocument();
  });

  it('shows current price when available', () => {
    seedPortfolio();
    seedWatchlistItem({ ticker: 'VTI' });
    seedWatchlistPrice('VTI', 248.50);
    render(<InvestmentDiscovery />);
    expect(screen.getByText('$248.50')).toBeInTheDocument();
  });

  it('shows target price tag', () => {
    seedPortfolio();
    seedWatchlistItem({ ticker: 'VTI', targetPrice: 240 });
    render(<InvestmentDiscovery />);
    expect(screen.getByText('Target $240.00')).toBeInTheDocument();
  });

  it('shows "In portfolio" pill when ticker matches an asset', () => {
    seedPortfolio();
    seedWatchlistItem({ ticker: 'VTI' });
    const current = useInvestmentStore.getState().investmentAssets || [];
    useInvestmentStore.setState({
      investmentAssets: [...current, {
        id: 'a1', portfolioId: PORT_ID, name: 'Vanguard Total Stock',
        ticker: 'VTI', platform: 'Hatch', category: 'ETF', currency: 'USD',
        notes: '', createdAt: '2026-01-15',
      }],
    });
    render(<InvestmentDiscovery />);
    expect(screen.getByText('In portfolio')).toBeInTheDocument();
  });

  it('shows item count in subtitle', () => {
    seedPortfolio();
    seedWatchlistItem({ id: 'w1', ticker: 'VTI' });
    seedWatchlistItem({ id: 'w2', ticker: 'VT' });
    render(<InvestmentDiscovery />);
    expect(screen.getByText('2 items')).toBeInTheDocument();
  });
});

describe('InvestmentDiscovery — manual add', () => {
  it('opens inline add row when + Add is clicked', async () => {
    seedPortfolio();
    const user = userEvent.setup();
    render(<InvestmentDiscovery />);
    await user.click(screen.getByText('+ Add Item'));
    expect(screen.getByPlaceholderText('Ticker')).toBeInTheDocument();
  });
});

describe('InvestmentDiscovery — remove', () => {
  it('removes item when close button is clicked', async () => {
    seedPortfolio();
    const item = seedWatchlistItem({ ticker: 'VTI' });
    const user = userEvent.setup();
    render(<InvestmentDiscovery />);

    const removeBtn = screen.getByTitle('Remove');
    await user.click(removeBtn);

    // Item should be removed from store
    expect(useInvestmentStore.getState().watchlist).toHaveLength(0);
  });
});

describe('InvestmentDiscovery — expand', () => {
  it('shows detail when row is clicked', async () => {
    seedPortfolio();
    seedWatchlistItem({ ticker: 'VTI', thesis: 'Broad US market exposure' });
    const user = userEvent.setup();
    render(<InvestmentDiscovery />);

    // Click the row to expand
    await user.click(screen.getByText('VTI'));
    expect(screen.getByText('Thesis')).toBeInTheDocument();
    expect(screen.getByText('Broad US market exposure')).toBeInTheDocument();
  });

  it('shows Add to Portfolio button in expanded detail', async () => {
    seedPortfolio();
    seedWatchlistItem({ ticker: 'VTI' });
    const user = userEvent.setup();
    render(<InvestmentDiscovery />);

    await user.click(screen.getByText('VTI'));
    expect(screen.getByRole('button', { name: 'Add to Portfolio' })).toBeInTheDocument();
  });

  it('shows Edit button in expanded detail', async () => {
    seedPortfolio();
    seedWatchlistItem({ ticker: 'VTI' });
    const user = userEvent.setup();
    render(<InvestmentDiscovery />);

    await user.click(screen.getByText('VTI'));
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });
});

describe('InvestmentDiscovery — edit modal', () => {
  it('opens edit modal from expanded detail', async () => {
    seedPortfolio();
    seedWatchlistItem({ ticker: 'VTI' });
    const user = userEvent.setup();
    render(<InvestmentDiscovery />);

    await user.click(screen.getByText('VTI'));
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(screen.getByText('Edit Watchlist Item')).toBeInTheDocument();
  });
});

describe('InvestmentDiscovery — convert flow', () => {
  it('opens convert modal from expanded detail', async () => {
    seedPortfolio();
    seedWatchlistItem({ ticker: 'VTI', name: 'Vanguard Total Stock' });
    const user = userEvent.setup();
    render(<InvestmentDiscovery />);

    await user.click(screen.getByText('VTI'));
    await user.click(screen.getByRole('button', { name: 'Add to Portfolio' }));

    // Modal header shows the title
    expect(document.querySelector('.modal-header h3')).toHaveTextContent('Add to Portfolio');
    expect(screen.getByRole('button', { name: 'Create Asset' })).toBeInTheDocument();
  });
});
