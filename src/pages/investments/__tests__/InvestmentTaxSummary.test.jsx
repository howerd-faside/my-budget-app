// @vitest-environment jsdom
/**
 * Unit tests for the InvestmentTaxSummary page component (new model).
 *
 * Covers: empty state, summary tiles, dividend report table, realised
 * gains table, cash flow summary, fee detail, year navigation,
 * export button, disclaimer.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvestmentTaxSummary from '../InvestmentTaxSummary';
import { useInvestmentStore } from '../../../store/investmentStore';

// ── helpers ──────────────────────────────────────────────────────────────────

const PORT_ID = 'port-1';
const THIS_YEAR = new Date().getFullYear();
const Y = String(THIS_YEAR);

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
    date: `${Y}-03-01`,
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
    createdAt: `${Y}-03-01`,
    ...overrides,
  };
  const current = useInvestmentStore.getState().investmentTransactions || [];
  useInvestmentStore.setState({ investmentTransactions: [...current, tx] });
  return tx;
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

describe('InvestmentTaxSummary — empty state', () => {
  it('renders empty state when no activity for selected year', () => {
    seedPortfolio();
    render(<InvestmentTaxSummary />);
    expect(screen.getByText(new RegExp(`No investment activity recorded for ${THIS_YEAR}`))).toBeInTheDocument();
  });
});

describe('InvestmentTaxSummary — summary tiles', () => {
  it('renders all summary tiles with data', () => {
    seedPortfolio();
    seedAsset();
    seedTx({ type: 'buy', units: 10, price: 100, amount: 1000 });
    seedTx({ id: 'div-1', type: 'dividend', units: null, price: null, amount: 80, grossAmount: 100, taxAmount: 20 });
    render(<InvestmentTaxSummary />);

    expect(screen.getByText('Dividends Received')).toBeInTheDocument();
    expect(screen.getByText('Tax Withheld')).toBeInTheDocument();
    expect(screen.getByText('Realised G/L')).toBeInTheDocument();
    expect(screen.getByText('Invested')).toBeInTheDocument();
    expect(screen.getByText('Disposed')).toBeInTheDocument();
  });

  it('shows fees tile when fees exist', () => {
    seedPortfolio();
    seedAsset();
    seedTx({ type: 'buy', units: 10, price: 100, amount: 1000 });
    seedTx({ id: 'fee-1', type: 'fee', units: null, price: null, amount: 25, assetId: '' });
    render(<InvestmentTaxSummary />);

    expect(screen.getByText('Fees Paid')).toBeInTheDocument();
  });
});

describe('InvestmentTaxSummary — dividend report', () => {
  it('renders dividend table with gross/tax/net columns', () => {
    seedPortfolio();
    seedAsset();
    seedTx({ id: 'div-1', type: 'dividend', units: null, price: null, amount: 80, grossAmount: 100, taxAmount: 20 });
    render(<InvestmentTaxSummary />);

    expect(screen.getByText(/Dividend Report/)).toBeInTheDocument();
    expect(screen.getByText('Gross dividends')).toBeInTheDocument();
    expect(screen.getByText(/Tax withheld/)).toBeInTheDocument();
    expect(screen.getByText('Net dividends received')).toBeInTheDocument();
  });

  it('shows asset name in dividend rows', () => {
    seedPortfolio();
    seedAsset({ id: 'a1', name: 'My Fund' });
    seedTx({ id: 'div-1', assetId: 'a1', type: 'dividend', units: null, price: null, amount: 50, grossAmount: 60, taxAmount: 10 });
    render(<InvestmentTaxSummary />);

    expect(screen.getByText('My Fund')).toBeInTheDocument();
  });
});

describe('InvestmentTaxSummary — realised gains', () => {
  it('renders realised sells table when sells exist', () => {
    seedPortfolio();
    seedAsset();
    seedTx({ id: 'buy-1', type: 'buy', units: 10, price: 100, amount: 1000, date: `${Y}-01-01` });
    seedTx({ id: 'sell-1', type: 'sell', units: 5, price: 150, amount: 750, date: `${Y}-02-01` });
    render(<InvestmentTaxSummary />);

    expect(screen.getByText(/Realised Gains & Losses/)).toBeInTheDocument();
    // Table should have Proceeds and Cost Basis columns
    const headers = document.querySelectorAll('.perf-table th');
    const headerTexts = Array.from(headers).map(h => h.textContent);
    expect(headerTexts).toContain('Proceeds');
    expect(headerTexts).toContain('Cost Basis');
    expect(headerTexts).toContain('Gain/Loss');
  });

  it('does not render realised section when no sells', () => {
    seedPortfolio();
    seedAsset();
    seedTx({ type: 'buy', units: 10, price: 100, amount: 1000 });
    render(<InvestmentTaxSummary />);

    expect(screen.queryByText(/Realised Gains & Losses/)).not.toBeInTheDocument();
  });
});

describe('InvestmentTaxSummary — cash flow', () => {
  it('renders cash flow summary section', () => {
    seedPortfolio();
    seedAsset();
    seedTx({ type: 'buy', units: 10, price: 100, amount: 1000 });
    seedTx({ id: 'div-1', type: 'dividend', units: null, price: null, amount: 50, grossAmount: 60, taxAmount: 10 });
    render(<InvestmentTaxSummary />);

    expect(screen.getByText(/Cash Flow/)).toBeInTheDocument();
    expect(screen.getByText('Purchases')).toBeInTheDocument();
    expect(screen.getByText('Dividends')).toBeInTheDocument();
  });
});

describe('InvestmentTaxSummary — fees', () => {
  it('renders fee detail section', () => {
    seedPortfolio();
    seedAsset();
    seedTx({ id: 'fee-1', type: 'fee', units: null, price: null, amount: 25, assetId: '', label: 'Admin fee' });
    render(<InvestmentTaxSummary />);

    expect(screen.getByText(/Fees —/)).toBeInTheDocument();
    expect(screen.getByText('Admin fee')).toBeInTheDocument();
  });
});

describe('InvestmentTaxSummary — disclaimer', () => {
  it('renders disclaimer text', () => {
    seedPortfolio();
    seedAsset();
    seedTx({ type: 'buy', units: 10, price: 100, amount: 1000 });
    render(<InvestmentTaxSummary />);

    expect(screen.getByText(/This is not tax advice/)).toBeInTheDocument();
  });
});

describe('InvestmentTaxSummary — export', () => {
  it('renders export CSV button', () => {
    seedPortfolio();
    seedAsset();
    seedTx({ type: 'buy', units: 10, price: 100, amount: 1000 });
    render(<InvestmentTaxSummary />);

    expect(screen.getByText('↓ Export CSV')).toBeInTheDocument();
  });
});

describe('InvestmentTaxSummary — year navigation', () => {
  it('renders year bar with current year', () => {
    seedPortfolio();
    render(<InvestmentTaxSummary />);
    expect(screen.getByText(String(THIS_YEAR))).toBeInTheDocument();
  });

  it('switches year and shows empty state for year with no data', async () => {
    seedPortfolio();
    seedAsset();
    seedTx({ type: 'buy', units: 10, price: 100, amount: 1000 });
    const user = userEvent.setup();
    render(<InvestmentTaxSummary />);

    const prevYear = THIS_YEAR - 1;
    const yearBtn = screen.getByText(String(prevYear));
    await user.click(yearBtn);

    expect(screen.getByText(new RegExp(`No investment activity recorded for ${prevYear}`))).toBeInTheDocument();
  });
});
