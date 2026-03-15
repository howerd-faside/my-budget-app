// @vitest-environment jsdom
/**
 * Unit tests for the AssetDetail component.
 *
 * Covers: header display, position summary stats, transaction history,
 * income history, metadata/notes, quick actions (Add Buy/Sell/Dividend),
 * edit/delete transactions from detail view, back navigation, not-found state.
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

function renderPage() {
  return render(
    <NavigationProvider value={() => {}}>
      <InvestmentAssets />
    </NavigationProvider>
  );
}

async function navigateToDetail(user) {
  // Expand the asset row, then click "View Detail"
  const assetName = screen.getByText('Vanguard Total World');
  await user.click(assetName);
  const viewBtn = screen.getByText('View Detail');
  await user.click(viewBtn);
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

describe('AssetDetail — header and navigation', () => {
  it('shows asset name, ticker, category and platform in header', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset();
    seedPrice();
    renderPage();

    await navigateToDetail(user);

    // Header should show asset name prominently
    expect(screen.getByText('Vanguard Total World')).toBeInTheDocument();
    // Ticker and tags
    expect(screen.getAllByText('VT').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('ETF').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Hatch').length).toBeGreaterThanOrEqual(1);
  });

  it('navigates back to asset list when Back is clicked', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset();
    seedPrice();
    renderPage();

    await navigateToDetail(user);
    expect(screen.getByText('Transaction History')).toBeInTheDocument();

    const backBtn = screen.getByLabelText('Back to assets');
    await user.click(backBtn);

    // Should be back on the list view
    expect(screen.queryByText('Transaction History')).not.toBeInTheDocument();
  });
});

describe('AssetDetail — position summary', () => {
  it('shows position stat tiles', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset();
    seedTx({ type: 'buy', units: 10, price: 100, amount: 1000 });
    seedPrice({ price: 120 });
    renderPage();

    await navigateToDetail(user);

    // Stat labels
    expect(screen.getByText('Units')).toBeInTheDocument();
    expect(screen.getByText('Avg Cost')).toBeInTheDocument();
    expect(screen.getByText('Current Price')).toBeInTheDocument();
    expect(screen.getByText('Market Value')).toBeInTheDocument();
    expect(screen.getByText('Unrealised G/L')).toBeInTheDocument();
    expect(screen.getByText('Cost Basis')).toBeInTheDocument();
    expect(screen.getByText('Total Return')).toBeInTheDocument();
  });

  it('shows market value with correct calculation', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset();
    seedTx({ type: 'buy', units: 10, price: 100, amount: 1000 });
    seedPrice({ price: 120 });
    renderPage();

    await navigateToDetail(user);

    // 10 units × $120 = $1,200.00
    expect(screen.getAllByText('$1,200.00').length).toBeGreaterThanOrEqual(1);
  });

  it('shows realised G/L when present', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset();
    seedTx({ id: 'buy-1', type: 'buy', units: 10, price: 100, amount: 1000, date: '2026-02-01' });
    seedTx({ id: 'sell-1', type: 'sell', units: 5, price: 150, amount: 750, date: '2026-03-01' });
    seedPrice({ price: 120 });
    renderPage();

    await navigateToDetail(user);

    expect(screen.getByText('Realised G/L')).toBeInTheDocument();
  });
});

describe('AssetDetail — transaction history', () => {
  it('shows all transactions for the asset', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset();
    seedTx({ id: 'tx1', type: 'buy', units: 10, price: 100, amount: 1000, date: '2026-02-01' });
    seedTx({ id: 'tx2', type: 'buy', units: 5, price: 110, amount: 550, date: '2026-03-01' });
    seedPrice();
    renderPage();

    await navigateToDetail(user);

    expect(screen.getByText('Transaction History')).toBeInTheDocument();
    expect(screen.getByText(/2 transactions/)).toBeInTheDocument();
  });

  it('shows empty message when no transactions', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset();
    seedPrice();
    renderPage();

    await navigateToDetail(user);

    expect(screen.getByText(/No transactions recorded/)).toBeInTheDocument();
  });

  it('shows transaction type pills', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset();
    seedTx({ type: 'buy' });
    seedPrice();
    renderPage();

    await navigateToDetail(user);

    // Buy pill in transaction history
    expect(screen.getAllByText('Buy').length).toBeGreaterThanOrEqual(1);
  });
});

describe('AssetDetail — income history', () => {
  it('shows income section when dividends exist', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset();
    seedTx({ id: 'div-1', type: 'dividend', units: null, price: null, grossAmount: 100, taxAmount: 28, amount: 72, date: '2026-03-01' });
    seedPrice();
    renderPage();

    await navigateToDetail(user);

    expect(screen.getByText('Income History')).toBeInTheDocument();
    expect(screen.getByText('Gross')).toBeInTheDocument();
    expect(screen.getByText('Tax')).toBeInTheDocument();
    expect(screen.getByText('Net')).toBeInTheDocument();
    // Check totals
    expect(screen.getAllByText('$100.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$28.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$72.00').length).toBeGreaterThanOrEqual(1);
  });

  it('hides income section when no dividends', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset();
    seedTx({ type: 'buy' });
    seedPrice();
    renderPage();

    await navigateToDetail(user);

    expect(screen.queryByText('Income History')).not.toBeInTheDocument();
  });
});

describe('AssetDetail — metadata', () => {
  it('shows asset details section', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset({ notes: 'Core holding' });
    seedPrice();
    renderPage();

    await navigateToDetail(user);

    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('Core holding')).toBeInTheDocument();
    expect(screen.getByText('NZD')).toBeInTheDocument();
  });
});

describe('AssetDetail — quick actions', () => {
  it('shows Add Buy, Add Sell, Add Dividend buttons', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset();
    seedPrice();
    renderPage();

    await navigateToDetail(user);

    expect(screen.getByText('Add Buy')).toBeInTheDocument();
    expect(screen.getByText('Add Sell')).toBeInTheDocument();
    expect(screen.getByText('Add Dividend')).toBeInTheDocument();
  });

  it('opens Add Transaction modal with pre-filled type on quick action', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset();
    seedPrice();
    renderPage();

    await navigateToDetail(user);

    await user.click(screen.getByText('Add Buy'));

    expect(screen.getByRole('heading', { name: 'Add Transaction' })).toBeInTheDocument();
    // Type should be pre-set to Buy
    expect(screen.getByDisplayValue('Buy')).toBeInTheDocument();
  });

  it('creates a transaction via quick action', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset();
    seedPrice();
    renderPage();

    await navigateToDetail(user);

    await user.click(screen.getByText('Add Buy'));

    // Fill units
    const unitsInput = screen.getByPlaceholderText('0');
    await user.type(unitsInput, '5');

    // Fill price
    const priceInputs = screen.getAllByPlaceholderText('0.00');
    await user.type(priceInputs[0], '100');

    // Submit
    const addBtn = screen.getByRole('button', { name: 'Add Transaction' });
    await user.click(addBtn);

    // Should appear in transaction history
    const state = useInvestmentStore.getState();
    const newTx = state.investmentTransactions.find(t => t.units === 5 && t.price === 100);
    expect(newTx).toBeTruthy();
    expect(newTx.assetId).toBe('asset-1');
  });
});

describe('AssetDetail — edit/delete transactions', () => {
  it('edits a transaction from the detail view', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset();
    seedTx({ id: 'tx-edit', type: 'buy', date: '2026-03-01', units: 10, price: 100, amount: 1000 });
    seedPrice();
    renderPage();

    await navigateToDetail(user);

    await user.click(screen.getByLabelText('Edit transaction'));
    expect(screen.getByRole('heading', { name: 'Edit Transaction' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-03-01')).toBeInTheDocument();
  });

  it('deletes a transaction from the detail view', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset();
    seedTx({ id: 'tx-del', type: 'buy', amount: 999 });
    seedPrice();
    renderPage();

    await navigateToDetail(user);

    await user.click(screen.getByLabelText('Delete transaction'));
    expect(screen.getByText(/Remove this transaction/)).toBeInTheDocument();

    const removeBtn = Array.from(document.querySelectorAll('button.btn'))
      .find(b => !b.classList.contains('btn-ghost') && b.textContent.trim() === 'Remove');
    await user.click(removeBtn);

    const state = useInvestmentStore.getState();
    expect(state.investmentTransactions.find(t => t.id === 'tx-del')).toBeUndefined();
  });
});
