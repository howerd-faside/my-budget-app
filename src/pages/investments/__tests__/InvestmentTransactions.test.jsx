// @vitest-environment jsdom
/**
 * Unit tests for the InvestmentTransactions page component.
 *
 * Covers: empty states, populated ledger, type/asset/date filters,
 * add modal (type-adaptive fields), edit modal, delete flow,
 * calculation previews.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock Toast context (ImportModal uses useToast)
vi.mock('../../../components/Toast', () => ({
  useToast: () => vi.fn(),
}));

import InvestmentTransactions from '../InvestmentTransactions';
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

function renderPage() {
  return render(
    <NavigationProvider value={() => {}}>
      <InvestmentTransactions />
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

describe('InvestmentTransactions — empty states', () => {
  it('renders empty state when no transactions exist', () => {
    seedPortfolio();
    renderPage();
    expect(screen.getByText(/No transactions yet/)).toBeInTheDocument();
  });

  it('shows "Add Transaction" button in empty state', () => {
    seedPortfolio();
    renderPage();
    expect(screen.getByText('+ Add Transaction')).toBeInTheDocument();
  });
});

describe('InvestmentTransactions — populated ledger', () => {
  it('renders transaction with asset name and type pill', () => {
    seedPortfolio();
    seedAsset();
    seedTx({ type: 'buy' });
    seedPrice();
    renderPage();
    expect(screen.getByText('Vanguard Total World')).toBeInTheDocument();
    expect(screen.getAllByText('Buy').length).toBeGreaterThanOrEqual(1);
  });

  it('renders transaction amount in ledger', () => {
    seedPortfolio();
    seedAsset();
    seedTx({ amount: 1000 });
    seedPrice();
    renderPage();
    // $1,000.00 appears in stat tiles and row — at least one present
    expect(screen.getAllByText('$1,000.00').length).toBeGreaterThanOrEqual(1);
  });

  it('renders units and price for buy transactions', () => {
    seedPortfolio();
    seedAsset();
    seedTx({ units: 10, price: 100 });
    seedPrice();
    renderPage();
    expect(screen.getByText(/10 units/)).toBeInTheDocument();
  });

  it('renders stat tiles for populated list', () => {
    seedPortfolio();
    seedAsset();
    seedTx({ type: 'buy', amount: 1000 });
    seedPrice();
    renderPage();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(screen.getByText('Buys')).toBeInTheDocument();
    expect(screen.getByText('Sells')).toBeInTheDocument();
    // "Dividends" in stat tiles (also in filter tabs)
    expect(screen.getAllByText('Dividends').length).toBeGreaterThanOrEqual(1);
  });

  it('shows date in the row', () => {
    seedPortfolio();
    seedAsset();
    seedTx({ date: '2026-03-01' });
    seedPrice();
    renderPage();
    expect(screen.getByText('2026-03-01')).toBeInTheDocument();
  });

  it('shows notes when present', () => {
    seedPortfolio();
    seedAsset();
    seedTx({ notes: 'Monthly DCA' });
    seedPrice();
    renderPage();
    expect(screen.getByText('Monthly DCA')).toBeInTheDocument();
  });
});

describe('InvestmentTransactions — type filter', () => {
  it('filters by transaction type', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset();
    seedTx({ id: 'buy-1', type: 'buy', amount: 1000, date: '2026-03-01' });
    seedTx({ id: 'div-1', type: 'dividend', assetId: 'asset-1', amount: 50, grossAmount: 60, taxAmount: 10, units: null, price: null, date: '2026-03-02' });
    seedPrice();
    renderPage();

    expect(screen.getByText('Ledger')).toBeInTheDocument();

    // Find the Dividend filter-tab button (not the stat tile)
    const filterTabs = document.querySelector('.filter-tabs');
    const divTab = Array.from(filterTabs.querySelectorAll('.filter-tab'))
      .find(el => el.textContent === 'Dividend');
    await user.click(divTab);

    // Ledger subtitle should show 1 transaction
    expect(screen.getByText(/1 transaction/)).toBeInTheDocument();
  });
});

describe('InvestmentTransactions — asset filter', () => {
  it('filters by asset', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset({ id: 'a1', name: 'Fund A', ticker: 'FA' });
    seedAsset({ id: 'a2', name: 'Fund B', ticker: 'FB' });
    seedTx({ id: 'tx1', assetId: 'a1', amount: 100, date: '2026-03-01' });
    seedTx({ id: 'tx2', assetId: 'a2', amount: 200, date: '2026-03-02' });
    seedPrice({ assetId: 'a1' });
    seedPrice({ assetId: 'a2' });
    renderPage();

    const assetSelect = screen.getByDisplayValue('All Assets');
    await user.selectOptions(assetSelect, 'a1');

    // Should show 1 transaction
    expect(screen.getByText(/1 transaction/)).toBeInTheDocument();
    expect(screen.getByText('Fund A')).toBeInTheDocument();
  });
});

describe('InvestmentTransactions — no-match state', () => {
  it('shows no-match message when filters exclude all', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset();
    seedTx({ type: 'buy' });
    seedPrice();
    renderPage();

    const filterTabs = document.querySelector('.filter-tabs');
    const sellTab = Array.from(filterTabs.querySelectorAll('.filter-tab'))
      .find(el => el.textContent === 'Sell');
    await user.click(sellTab);

    expect(screen.getByText(/No transactions match your filters/)).toBeInTheDocument();
  });
});

describe('InvestmentTransactions — add modal', () => {
  it('opens add modal with type-adaptive fields for buy', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset();
    renderPage();

    await user.click(screen.getByText('+ Add Transaction'));
    expect(screen.getByRole('heading', { name: 'Add Transaction' })).toBeInTheDocument();

    // Buy type is default — should show Units and Price fields
    expect(screen.getByText('Units')).toBeInTheDocument();
    expect(screen.getByText('Price per Unit ($)')).toBeInTheDocument();
    expect(screen.getByText('Asset')).toBeInTheDocument();
  });

  it('shows dividend fields when type is Dividend', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset();
    renderPage();

    await user.click(screen.getByText('+ Add Transaction'));

    // Switch to Dividend
    const typeSelect = screen.getByDisplayValue('Buy');
    await user.selectOptions(typeSelect, 'dividend');

    expect(screen.getByText('Gross Amount ($)')).toBeInTheDocument();
    expect(screen.getByText('Tax Withheld ($)')).toBeInTheDocument();
    expect(screen.queryByText('Units')).not.toBeInTheDocument();
  });

  it('shows amount field for fee type', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset();
    renderPage();

    await user.click(screen.getByText('+ Add Transaction'));

    const typeSelect = screen.getByDisplayValue('Buy');
    await user.selectOptions(typeSelect, 'fee');

    expect(screen.getByText('Amount ($)')).toBeInTheDocument();
    expect(screen.queryByText('Units')).not.toBeInTheDocument();
    expect(screen.queryByText('Asset')).not.toBeInTheDocument();
  });

  it('creates a buy transaction', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset();
    renderPage();

    await user.click(screen.getByText('+ Add Transaction'));

    // Fill date
    const dateInput = screen.getByDisplayValue(new Date().toISOString().slice(0, 10));
    await user.clear(dateInput);
    await user.type(dateInput, '2026-03-10');

    // Select asset
    const assetSelect = screen.getByDisplayValue('— Select asset —');
    await user.selectOptions(assetSelect, 'asset-1');

    // Fill units
    const unitsInput = screen.getByPlaceholderText('0');
    await user.type(unitsInput, '5');

    // Fill price
    const priceInputs = screen.getAllByPlaceholderText('0.00');
    // First 0.00 placeholder is price, second is fee
    await user.type(priceInputs[0], '100');

    // Submit
    const addBtn = screen.getByRole('button', { name: 'Add Transaction' });
    await user.click(addBtn);

    // Verify in store
    const state = useInvestmentStore.getState();
    const newTx = state.investmentTransactions.find(t => t.date === '2026-03-10');
    expect(newTx).toBeTruthy();
    expect(newTx.type).toBe('buy');
    expect(newTx.assetId).toBe('asset-1');
    expect(newTx.units).toBe(5);
    expect(newTx.price).toBe(100);
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset();
    renderPage();

    await user.click(screen.getByText('+ Add Transaction'));

    // Clear the date
    const dateInput = screen.getByDisplayValue(new Date().toISOString().slice(0, 10));
    await user.clear(dateInput);

    const addBtn = screen.getByRole('button', { name: 'Add Transaction' });
    await user.click(addBtn);

    expect(screen.getByText('Date is required')).toBeInTheDocument();
  });
});

describe('InvestmentTransactions — edit modal', () => {
  it('opens edit modal with pre-filled data', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset();
    seedTx({ id: 'tx-edit', type: 'buy', date: '2026-03-01', units: 10, price: 100, amount: 1000 });
    seedPrice();
    renderPage();

    await user.click(screen.getByLabelText('Edit transaction'));
    expect(screen.getByRole('heading', { name: 'Edit Transaction' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-03-01')).toBeInTheDocument();
  });
});

describe('InvestmentTransactions — delete', () => {
  it('shows confirm dialog and deletes transaction', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset();
    seedTx({ id: 'tx-del', type: 'buy', amount: 999 });
    seedPrice();
    renderPage();

    await user.click(screen.getByLabelText('Delete transaction'));
    expect(screen.getByText(/Remove this transaction/)).toBeInTheDocument();

    const removeBtn = Array.from(document.querySelectorAll('button.btn'))
      .find(b => !b.classList.contains('btn-ghost') && b.textContent.trim() === 'Remove');
    await user.click(removeBtn);

    const state = useInvestmentStore.getState();
    expect(state.investmentTransactions.find(t => t.id === 'tx-del')).toBeUndefined();
  });
});

describe('InvestmentTransactions — dividend calc preview', () => {
  it('shows dividend preview with gross/tax/net', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset();
    renderPage();

    await user.click(screen.getByText('+ Add Transaction'));

    const typeSelect = screen.getByDisplayValue('Buy');
    await user.selectOptions(typeSelect, 'dividend');

    // Select asset
    const assetSelect = screen.getByDisplayValue('— Select asset —');
    await user.selectOptions(assetSelect, 'asset-1');

    // Fill gross and tax (both have 0.00 placeholder)
    const amountInputs = screen.getAllByPlaceholderText('0.00');
    await user.type(amountInputs[0], '100');
    await user.type(amountInputs[1], '28');

    // Preview: Gross $100, Tax $28, Net $72
    const preview = document.querySelector('.calc-preview');
    expect(preview).toBeTruthy();
    expect(preview.textContent).toContain('$100.00');
    expect(preview.textContent).toContain('$28.00');
    expect(preview.textContent).toContain('$72.00');
  });
});

describe('InvestmentTransactions — buy calc preview', () => {
  it('shows buy preview with units × price', async () => {
    const user = userEvent.setup();
    seedPortfolio();
    seedAsset();
    renderPage();

    await user.click(screen.getByText('+ Add Transaction'));

    const assetSelect = screen.getByDisplayValue('— Select asset —');
    await user.selectOptions(assetSelect, 'asset-1');

    const unitsInput = screen.getByPlaceholderText('0');
    await user.type(unitsInput, '5');

    const priceInputs = screen.getAllByPlaceholderText('0.00');
    await user.type(priceInputs[0], '200');

    // Preview: 5 × $200 = $1,000.00
    const preview = document.querySelector('.calc-preview');
    expect(preview).toBeTruthy();
    expect(preview.textContent).toContain('$1,000.00');
  });
});
