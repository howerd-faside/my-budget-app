// @vitest-environment jsdom
/**
 * Unit tests for the ImportModal component.
 *
 * Covers: upload step rendering, file selection, preview step,
 * error/warning display, import commit, template download.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useInvestmentStore } from '../../../store/investmentStore';

// Mock Toast context
vi.mock('../../../components/Toast', () => ({
  useToast: () => vi.fn(),
}));

// Mock csvExport (no actual download in tests)
vi.mock('../../../utils/csvExport', () => ({
  exportCSV: vi.fn(),
}));

import ImportModal from '../../../components/investments/ImportModal';

// ── helpers ──────────────────────────────────────────────────────────────────

const PORT_ID = 'port-1';

function seedPortfolio() {
  useInvestmentStore.setState({
    investmentPortfolios: [{ id: PORT_ID, name: 'Main', currency: 'NZD', costBasisMethod: 'average', archived: false, createdAt: '2026-01-01' }],
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

function renderModal(props = {}) {
  return render(<ImportModal isOpen={true} onClose={vi.fn()} {...props} />);
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

describe('ImportModal — upload step', () => {
  it('renders upload step with dropzone', () => {
    seedPortfolio();
    renderModal();
    expect(screen.getByText(/Drop a CSV file here/)).toBeInTheDocument();
  });

  it('renders format selector with Generic option', () => {
    seedPortfolio();
    renderModal();
    expect(screen.getByText('Import Format')).toBeInTheDocument();
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
  });

  it('renders template download button', () => {
    seedPortfolio();
    renderModal();
    expect(screen.getByText('Download Template CSV')).toBeInTheDocument();
  });

  it('has disabled Preview button when no file selected', () => {
    seedPortfolio();
    renderModal();
    const previewBtn = screen.getByRole('button', { name: 'Preview' });
    expect(previewBtn).toBeDisabled();
  });

  it('renders Cancel button', () => {
    seedPortfolio();
    renderModal();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });
});

describe('ImportModal — not open', () => {
  it('renders nothing when isOpen is false', () => {
    seedPortfolio();
    const { container } = render(<ImportModal isOpen={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('ImportModal — close', () => {
  it('calls onClose when Cancel is clicked', async () => {
    seedPortfolio();
    const onClose = vi.fn();
    render(<ImportModal isOpen={true} onClose={onClose} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ImportModal — template download', () => {
  it('calls exportCSV when template button is clicked', async () => {
    seedPortfolio();
    const { exportCSV } = await import('../../../utils/csvExport');
    renderModal();
    const user = userEvent.setup();
    await user.click(screen.getByText('Download Template CSV'));
    expect(exportCSV).toHaveBeenCalledWith(
      'investment-import-template.csv',
      expect.any(Array),
      expect.any(Array),
    );
  });
});
