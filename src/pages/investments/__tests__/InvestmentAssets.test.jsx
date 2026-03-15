// @vitest-environment jsdom
/**
 * Unit tests for the InvestmentAssets page component.
 *
 * Covers: empty states, populated list, filtering (category, platform, search),
 * expanded detail view, add/edit modal, delete with cascade.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvestmentAssets from '../InvestmentAssets';
import { useInvestmentStore } from '../../../store/investmentStore';
import { NavigationProvider } from '../../../contexts/NavigationContext';

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
    notes: 'Core holding',
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
    price: 100,
    amount: 1000,
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
    price: 120,
    currency: 'NZD',
    updatedAt: '2026-03-15',
    ...overrides,
  };
  const current = useInvestmentStore.getState().priceCache || [];
  useInvestmentStore.setState({ priceCache: [...current, entry] });
  return entry;
}

function renderPage() {
  return render(
    <NavigationProvider value={() => {}}>
      <InvestmentAssets />
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

describe('InvestmentAssets — empty states', () => {
  it('renders empty state when no assets exist', () => {
    seedPortfolio();
    renderPage();
    expect(screen.getByText(/No assets yet/)).toBeInTheDocument();
  });

  it('shows "Add Asset" button in empty state', () => {
    seedPortfolio();
    renderPage();
    expect(screen.getByText('+ Add Asset')).toBeInTheDocument();
  });
});

describe('InvestmentAssets — populated list', () => {
  it('renders asset name and ticker', () => {
    seedPortfolio();
    seedAsset();
    seedTransaction();
    seedPrice();
    renderPage();
    expect(screen.getByText('Vanguard Total World')).toBeInTheDocument();
    expect(screen.getByText('VT')).toBeInTheDocument();
  });

  it('renders category tag', () => {
    seedPortfolio();
    seedAsset({ category: 'ETF' });
    seedTransaction();
    seedPrice();
    renderPage();
    // ETF appears in both filter tab and asset tag
    expect(screen.getAllByText('ETF').length).toBeGreaterThanOrEqual(2);
  });

  it('renders platform tag', () => {
    seedPortfolio();
    seedAsset({ platform: 'Hatch' });
    seedTransaction();
    seedPrice();
    renderPage();
    expect(screen.getByText('Hatch')).toBeInTheDocument();
  });

  it('renders market value', () => {
    seedPortfolio();
    seedAsset();
    seedTransaction({ units: 10, price: 100, amount: 1000 });
    seedPrice({ price: 120 });
    renderPage();
    // 10 units × $120 = $1,200.00
    expect(screen.getByText('$1,200.00')).toBeInTheDocument();
  });
});

describe('InvestmentAssets — expanded detail', () => {
  it('shows position details when expanded', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset();
    seedTransaction({ units: 10, price: 100, amount: 1000 });
    seedPrice({ price: 120 });
    renderPage();

    // Click to expand
    await user.click(screen.getByText('Vanguard Total World'));

    expect(screen.getByText('Units')).toBeInTheDocument();
    expect(screen.getByText('Avg Cost')).toBeInTheDocument();
    expect(screen.getByText('Current Price')).toBeInTheDocument();
    expect(screen.getByText('Cost Basis')).toBeInTheDocument();
    expect(screen.getByText('Market Value')).toBeInTheDocument();
    expect(screen.getByText('Unrealised G/L')).toBeInTheDocument();
  });

  it('shows recent transactions when expanded', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset();
    seedTransaction({ date: '2026-03-01' });
    seedPrice();
    renderPage();

    await user.click(screen.getByText('Vanguard Total World'));
    expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
    expect(screen.getByText('2026-03-01')).toBeInTheDocument();
  });

  it('shows notes when expanded', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset({ notes: 'Core holding' });
    seedTransaction();
    seedPrice();
    renderPage();

    await user.click(screen.getByText('Vanguard Total World'));
    expect(screen.getByText('Core holding')).toBeInTheDocument();
  });
});

describe('InvestmentAssets — category filter', () => {
  it('filters by category', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset({ id: 'a1', name: 'VT ETF', category: 'ETF' });
    seedAsset({ id: 'a2', name: 'Apple Shares', category: 'Shares' });
    seedTransaction({ assetId: 'a1' });
    seedTransaction({ assetId: 'a2' });
    seedPrice({ assetId: 'a1' });
    seedPrice({ assetId: 'a2' });
    renderPage();

    // Both visible initially
    expect(screen.getByText('VT ETF')).toBeInTheDocument();
    expect(screen.getByText('Apple Shares')).toBeInTheDocument();

    // Click ETF filter
    const etfTab = screen.getAllByText('ETF').find(el => el.classList.contains('filter-tab'));
    await user.click(etfTab);

    expect(screen.getByText('VT ETF')).toBeInTheDocument();
    expect(screen.queryByText('Apple Shares')).not.toBeInTheDocument();
  });
});

describe('InvestmentAssets — search filter', () => {
  it('filters by name', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset({ id: 'a1', name: 'Vanguard Total World', ticker: 'VT' });
    seedAsset({ id: 'a2', name: 'Apple Inc', ticker: 'AAPL' });
    seedTransaction({ assetId: 'a1' });
    seedTransaction({ assetId: 'a2' });
    seedPrice({ assetId: 'a1' });
    seedPrice({ assetId: 'a2' });
    renderPage();

    const searchInput = screen.getByPlaceholderText('Search name or ticker…');
    await user.type(searchInput, 'apple');

    expect(screen.queryByText('Vanguard Total World')).not.toBeInTheDocument();
    expect(screen.getByText('Apple Inc')).toBeInTheDocument();
  });

  it('filters by ticker', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset({ id: 'a1', name: 'Vanguard Total World', ticker: 'VT' });
    seedAsset({ id: 'a2', name: 'Apple Inc', ticker: 'AAPL' });
    seedTransaction({ assetId: 'a1' });
    seedTransaction({ assetId: 'a2' });
    seedPrice({ assetId: 'a1' });
    seedPrice({ assetId: 'a2' });
    renderPage();

    const searchInput = screen.getByPlaceholderText('Search name or ticker…');
    await user.type(searchInput, 'VT');

    expect(screen.getByText('Vanguard Total World')).toBeInTheDocument();
    expect(screen.queryByText('Apple Inc')).not.toBeInTheDocument();
  });
});

describe('InvestmentAssets — add modal', () => {
  it('opens add modal and creates asset', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    // Need at least one asset for the filter bar to show
    renderPage();

    await user.click(screen.getByText('+ Add Asset'));

    // Modal title is "Add Asset" in the h3
    expect(screen.getByRole('heading', { name: 'Add Asset' })).toBeInTheDocument();

    // Fill in name
    const nameInput = screen.getByPlaceholderText('e.g. Vanguard Total World ETF');
    await user.type(nameInput, 'New Fund');

    // Submit via primary button
    const addBtn = screen.getByRole('button', { name: 'Add Asset' });
    await user.click(addBtn);

    // Asset created in store
    const state = useInvestmentStore.getState();
    expect(state.investmentAssets.find(a => a.name === 'New Fund')).toBeTruthy();
  });
});

describe('InvestmentAssets — edit modal', () => {
  it('opens edit modal with pre-filled data', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset({ name: 'Vanguard Total World' });
    seedTransaction();
    seedPrice();
    renderPage();

    // Expand row first
    await user.click(screen.getByText('Vanguard Total World'));
    // Click edit button
    await user.click(screen.getByLabelText('Edit asset'));

    expect(screen.getByText('Edit Asset')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Vanguard Total World')).toBeInTheDocument();
  });
});

describe('InvestmentAssets — delete', () => {
  it('shows confirm dialog and deletes asset + related transactions', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset({ id: 'asset-1', name: 'Delete Me' });
    seedTransaction({ id: 'tx-1', assetId: 'asset-1' });
    seedPrice({ assetId: 'asset-1' });
    renderPage();

    // Expand and click delete
    await user.click(screen.getByText('Delete Me'));
    await user.click(screen.getByLabelText('Delete asset'));

    // Confirm dialog visible
    expect(screen.getByText(/Delete "Delete Me"/)).toBeInTheDocument();

    // Confirm deletion — the dialog's confirm button has class "btn danger" (not btn-ghost)
    const confirmBtn = Array.from(document.querySelectorAll('button.btn.danger'))
      .find(b => !b.classList.contains('btn-ghost') && b.textContent.trim() === 'Delete');
    await user.click(confirmBtn);

    // Store cleared
    const state = useInvestmentStore.getState();
    expect(state.investmentAssets.find(a => a.id === 'asset-1')).toBeUndefined();
    expect(state.investmentTransactions.find(t => t.assetId === 'asset-1')).toBeUndefined();
    expect(state.priceCache.find(p => p.assetId === 'asset-1')).toBeUndefined();
  });
});

describe('InvestmentAssets — no-match filter state', () => {
  it('shows no-match message when filters exclude all', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset({ id: 'a1', name: 'VT ETF', category: 'ETF' });
    seedTransaction({ assetId: 'a1' });
    seedPrice({ assetId: 'a1' });
    renderPage();

    // Filter by Shares (none exist)
    const sharesTab = screen.getByText('Shares');
    await user.click(sharesTab);

    expect(screen.getByText(/No assets match your filters/)).toBeInTheDocument();
  });
});
