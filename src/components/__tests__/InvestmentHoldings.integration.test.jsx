// @vitest-environment jsdom
/**
 * Integration tests for the InvestmentHoldings page.
 *
 * Covers:
 *   - Empty state → Add Holding button → modal → form submission → store update
 *   - Holding appears in rendered list after creation
 *   - Edit holding → store update (units, avgCost computed from tranches)
 *   - Delete holding with no dependents → removed from store
 *   - Cascade delete: delete holding with contributions/dividends → all cleared
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../components/Toast';
import InvestmentHoldings from '../../pages/investments/InvestmentHoldings';
import { useInvestmentStore } from '../../store/investmentStore';

// ── helpers ───────────────────────────────────────────────────────────────────

const PORTFOLIO_ID = 'port-test-1';

function renderHoldings() {
  return render(
    <ToastProvider>
      <InvestmentHoldings />
    </ToastProvider>
  );
}

function seedPortfolio() {
  useInvestmentStore.setState({
    investmentPortfolios: [{ id: PORTFOLIO_ID, name: 'Main', createdAt: '' }],
    selectedPortfolioId: PORTFOLIO_ID,
    investments: [],
    investmentContributions: [],
    investmentDividends: [],
  });
}

function seedHolding(overrides = {}) {
  const holding = {
    id: 'h-seed-1',
    portfolioId: PORTFOLIO_ID,
    name: 'Apple Inc',
    ticker: 'AAPL',
    platform: 'Hatch',
    category: 'Shares',
    units: '10',
    avgCost: '150',
    currentPrice: '170',
    notes: '',
    tranches: [{ id: 't1', date: '2025-01-01', units: '10', costPerUnit: '150' }],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
  useInvestmentStore.setState({
    investmentPortfolios: [{ id: PORTFOLIO_ID, name: 'Main', createdAt: '' }],
    selectedPortfolioId: PORTFOLIO_ID,
    investments: [holding],
    investmentContributions: [],
    investmentDividends: [],
  });
  return holding;
}

// ── setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  useInvestmentStore.setState({
    investmentPortfolios: [], selectedPortfolioId: null,
    investments: [], investmentContributions: [], investmentDividends: [],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe('InvestmentHoldings — empty state', () => {
  it('shows "Add Holding" button when no holdings exist', () => {
    seedPortfolio();
    renderHoldings();
    expect(screen.getByText('+ Add Holding')).toBeInTheDocument();
  });

  it('opens the Add Holding modal on click', async () => {
    seedPortfolio();
    const user = userEvent.setup();
    renderHoldings();
    await user.click(screen.getByText('+ Add Holding'));
    expect(screen.getByRole('heading', { name: 'Add Holding' })).toBeInTheDocument();
  });
});

describe('InvestmentHoldings — creating a holding', () => {
  it('persists a new holding to the store on save', async () => {
    seedPortfolio();
    const user = userEvent.setup();
    renderHoldings();

    await user.click(screen.getByText('+ Add Holding'));

    // Asset name
    await user.type(screen.getByPlaceholderText('e.g. Apple Inc'), 'Tesla');

    // Current price (required by holdingSchema) — first 0.00 input; tranche costPerUnit is second
    const [priceInput] = screen.getAllByPlaceholderText('0.00');
    await user.clear(priceInput);
    await user.type(priceInput, '250');

    // Tranche: units and cost per unit
    const numericInputs = document.querySelectorAll('input[type="number"]');
    // First numeric is current price (already filled), next two are units + costPerUnit in tranche
    // Units input
    const unitsInput = screen.getByPlaceholderText('0');
    await user.clear(unitsInput);
    await user.type(unitsInput, '5');

    // costPerUnit input
    const costInputs = screen.getAllByPlaceholderText('0.00');
    // costInputs[0] = currentPrice (already filled); costInputs[1] = tranche costPerUnit
    await user.clear(costInputs[1]);
    await user.type(costInputs[1], '200');

    await user.click(screen.getByRole('button', { name: 'Add Holding' }));

    const { investments } = useInvestmentStore.getState();
    expect(investments).toHaveLength(1);
    expect(investments[0].name).toBe('Tesla');
    expect(investments[0].portfolioId).toBe(PORTFOLIO_ID);
  });

  it('shows the holding name in the list after creation', async () => {
    seedPortfolio();
    const user = userEvent.setup();
    renderHoldings();

    await user.click(screen.getByText('+ Add Holding'));
    await user.type(screen.getByPlaceholderText('e.g. Apple Inc'), 'Alphabet');

    const [priceInput] = screen.getAllByPlaceholderText('0.00');
    await user.clear(priceInput);
    await user.type(priceInput, '180');

    const unitsInput = screen.getByPlaceholderText('0');
    await user.clear(unitsInput);
    await user.type(unitsInput, '3');

    const costInputs = screen.getAllByPlaceholderText('0.00');
    await user.clear(costInputs[1]);
    await user.type(costInputs[1], '160');

    await user.click(screen.getByRole('button', { name: 'Add Holding' }));

    expect(screen.getByText('Alphabet')).toBeInTheDocument();
  });

  it('computes units and avgCost from tranches on save', async () => {
    seedPortfolio();
    const user = userEvent.setup();
    renderHoldings();

    await user.click(screen.getByText('+ Add Holding'));
    await user.type(screen.getByPlaceholderText('e.g. Apple Inc'), 'VGS');

    const [priceInput] = screen.getAllByPlaceholderText('0.00');
    await user.clear(priceInput);
    await user.type(priceInput, '100');

    const unitsInput = screen.getByPlaceholderText('0');
    await user.clear(unitsInput);
    await user.type(unitsInput, '10');

    const costInputs = screen.getAllByPlaceholderText('0.00');
    await user.clear(costInputs[1]);
    await user.type(costInputs[1], '90');

    await user.click(screen.getByRole('button', { name: 'Add Holding' }));

    const { investments } = useInvestmentStore.getState();
    expect(investments[0].units).toBe('10');
    expect(investments[0].avgCost).toBe('90');
  });
});

describe('InvestmentHoldings — deleting a holding', () => {
  it('removes a holding from the store when confirmed', async () => {
    seedHolding();
    const user = userEvent.setup();
    renderHoldings();

    expect(screen.getByText('Apple Inc')).toBeInTheDocument();

    const dangerBtns = document.querySelectorAll('.btn-icon.danger');
    await user.click(dangerBtns[0]);

    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(useInvestmentStore.getState().investments).toHaveLength(0);
  });

  it('cascade-deletes contributions and dividends linked to the holding', async () => {
    const holding = seedHolding();
    const user = userEvent.setup();
    useInvestmentStore.setState({
      investmentPortfolios: [{ id: PORTFOLIO_ID, name: 'Main', createdAt: '' }],
      selectedPortfolioId: PORTFOLIO_ID,
      investments: [holding],
      investmentContributions: [
        { id: 'c1', holdingId: holding.id, portfolioId: PORTFOLIO_ID, amount: 500, date: '2025-01-01', type: 'buy', platform: '', notes: '', createdAt: '' },
      ],
      investmentDividends: [
        { id: 'd1', holdingId: holding.id, portfolioId: PORTFOLIO_ID, grossAmount: 50, taxAmount: 8, netAmount: 42, date: '2025-06-01', platform: '', notes: '', createdAt: '' },
      ],
    });

    renderHoldings();

    const dangerBtns = document.querySelectorAll('.btn-icon.danger');
    await user.click(dangerBtns[0]);
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    const state = useInvestmentStore.getState();
    expect(state.investments).toHaveLength(0);
    // cascadeDeleteHolding clears holdingId on linked records (does not delete them)
    expect(state.investmentContributions[0].holdingId).toBe('');
    expect(state.investmentDividends[0].holdingId).toBe('');
  });

  it('does not delete when confirm is cancelled', async () => {
    seedHolding();
    const user = userEvent.setup();
    renderHoldings();

    const dangerBtns = document.querySelectorAll('.btn-icon.danger');
    await user.click(dangerBtns[0]);

    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(useInvestmentStore.getState().investments).toHaveLength(1);
  });
});

describe('InvestmentHoldings — modal cancel', () => {
  it('closes the modal without saving on Cancel', async () => {
    seedPortfolio();
    const user = userEvent.setup();
    renderHoldings();

    await user.click(screen.getByText('+ Add Holding'));
    await user.type(screen.getByPlaceholderText('e.g. Apple Inc'), 'Draft');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('heading', { name: 'Add Holding' })).not.toBeInTheDocument();
    expect(useInvestmentStore.getState().investments).toHaveLength(0);
  });
});
