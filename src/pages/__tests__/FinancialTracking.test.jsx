// @vitest-environment jsdom
/**
 * Unit tests for the FinancialTracking page component.
 *
 * Covers: year navigation, summary tiles, fortnight list, ad-hoc transaction
 * modal, transaction add/remove.
 *
 * Recharts is mocked to avoid SVG rendering issues in jsdom.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FinancialTracking from '../FinancialTracking';
import { usePeopleStore } from '../../store/peopleStore';
import { useFinanceStore } from '../../store/financeStore';

// ── Recharts mock ────────────────────────────────────────────────────────────
vi.mock('recharts', () => {
  const Passthrough = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Passthrough,
    AreaChart: Passthrough,
    Area: () => null,
    CartesianGrid: () => null,
    ReferenceLine: () => null,
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null,
  };
});

// ── helpers ──────────────────────────────────────────────────────────────────

function seedPerson(overrides = {}) {
  const person = {
    id: 'p-1',
    name: 'Alice',
    grossAnnual: 75000,
    taxCode: 'M',
    kiwiSaverRate: 3,
    payFrequency: 'fortnightly',
    secondaryIncomes: [],
    incomeEvents: [],
    employmentHistory: [],
    ...overrides,
  };
  usePeopleStore.setState({ people: [person] });
  return person;
}

// ── setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  usePeopleStore.setState({ people: [], expenses: [], wishlist: [] });
  useFinanceStore.setState({
    accounts: [{ id: 'main', name: 'Savings', balance: 5000 }],
    transfers: [],
    fortnightlyData: {},
    goals: [],
    assetIncomes: [],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── tests ────────────────────────────────────────────────────────────────────

describe('FinancialTracking — renders without crashing', () => {
  it('renders the page with year bar and overview section', () => {
    render(<FinancialTracking />);
    const thisYear = new Date().getFullYear();
    expect(screen.getByText(String(thisYear))).toBeInTheDocument();
    expect(screen.getByText('Current Balance')).toBeInTheDocument();
  });
});

describe('FinancialTracking — year navigation', () => {
  it('renders year pill buttons', () => {
    render(<FinancialTracking />);
    const thisYear = new Date().getFullYear();
    expect(screen.getByText(String(thisYear))).toBeInTheDocument();
    expect(screen.getByText(String(thisYear + 1))).toBeInTheDocument();
  });

  it('changes selected year when a pill is clicked', async () => {
    const user = userEvent.setup();
    render(<FinancialTracking />);
    const thisYear = new Date().getFullYear();
    const nextYearBtn = screen.getByText(String(thisYear + 1));

    await user.click(nextYearBtn);
    expect(nextYearBtn.classList.contains('active')).toBe(true);
  });

  it('shifts window when nav arrows are clicked', async () => {
    const user = userEvent.setup();
    render(<FinancialTracking />);
    const thisYear = new Date().getFullYear();

    // Click right arrow to shift window forward
    const navBtns = document.querySelectorAll('.year-nav-btn');
    await user.click(navBtns[1]); // right arrow

    // Next years should now be visible
    expect(screen.getByText(String(thisYear + 7))).toBeInTheDocument();
  });
});

describe('FinancialTracking — summary tiles', () => {
  it('renders summary tiles (Current Balance, Net /fn, etc.)', () => {
    seedPerson();
    render(<FinancialTracking />);
    expect(screen.getByText('Current Balance')).toBeInTheDocument();
    expect(screen.getByText('Net /fn')).toBeInTheDocument();
  });

  it('shows warning banner when no income is set', () => {
    render(<FinancialTracking />);
    expect(screen.getByText(/No income set/)).toBeInTheDocument();
  });
});

describe('FinancialTracking — fortnight list', () => {
  it('renders 26 fortnight rows', () => {
    render(<FinancialTracking />);
    const rows = document.querySelectorAll('.fn-row');
    expect(rows.length).toBe(26);
  });

  it('renders fortnight numbers #1 through #26', () => {
    render(<FinancialTracking />);
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#26')).toBeInTheDocument();
  });

  it('highlights current fortnight with "Now" badge', () => {
    render(<FinancialTracking />);
    // Current year should have a "Now" badge on one row
    const badge = document.querySelector('.current-badge');
    expect(badge).toBeInTheDocument();
  });
});

describe('FinancialTracking — ad-hoc transaction modal', () => {
  it('opens transaction modal when plus button is clicked', async () => {
    const user = userEvent.setup();
    render(<FinancialTracking />);

    const addBtns = document.querySelectorAll('.fn-add-btn');
    await user.click(addBtns[0]);

    expect(screen.getByText('Log Ad-hoc Transaction')).toBeInTheDocument();
  });

  it('has expense/income type toggle', async () => {
    const user = userEvent.setup();
    render(<FinancialTracking />);

    const addBtns = document.querySelectorAll('.fn-add-btn');
    await user.click(addBtns[0]);

    // Both toggle buttons are inside the modal's .tx-type-toggle
    const toggleBtns = document.querySelectorAll('.ttog-btn');
    expect(toggleBtns.length).toBe(2);
    expect(toggleBtns[0].textContent).toContain('Expense');
    expect(toggleBtns[1].textContent).toContain('Income');
  });

  it('renders the add transaction form fields', async () => {
    const user = userEvent.setup();
    render(<FinancialTracking />);

    const addBtns = document.querySelectorAll('.fn-add-btn');
    await user.click(addBtns[0]);

    // Form fields present
    expect(screen.getByPlaceholderText('e.g. Petrol')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Expense' })).toBeInTheDocument();
  });

  it('switches to income mode and shows income form', async () => {
    const user = userEvent.setup();
    render(<FinancialTracking />);

    const addBtns = document.querySelectorAll('.fn-add-btn');
    await user.click(addBtns[0]);

    // Switch to income via toggle button
    const toggleBtns = document.querySelectorAll('.ttog-btn');
    await user.click(toggleBtns[1]); // Income toggle

    expect(screen.getByPlaceholderText('e.g. Year-end bonus')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Income' })).toBeInTheDocument();
  });

  it('closes modal on Cancel without adding', async () => {
    const user = userEvent.setup();
    render(<FinancialTracking />);

    const addBtns = document.querySelectorAll('.fn-add-btn');
    await user.click(addBtns[0]);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Log Ad-hoc Transaction')).not.toBeInTheDocument();
  });
});

describe('FinancialTracking — remove transaction', () => {
  it('removes a transaction when delete button is clicked', async () => {
    // Seed a transaction directly
    const year = new Date().getFullYear();
    useFinanceStore.setState({
      accounts: [{ id: 'main', name: 'Savings', balance: 5000 }],
      fortnightlyData: {
        [year]: {
          fortnights: {
            0: {
              adhocTransactions: [
                { id: 'tx-1', date: '2026-03-10', description: 'Petrol', amount: -50, category: 'Other', note: '', type: 'expense' },
              ],
            },
          },
        },
      },
    });
    const user = userEvent.setup();
    render(<FinancialTracking />);

    expect(screen.getByText('Petrol')).toBeInTheDocument();

    const deleteBtns = document.querySelectorAll('.fn-tx-row .btn-icon.danger');
    await user.click(deleteBtns[0]);

    const { fortnightlyData } = useFinanceStore.getState();
    expect(fortnightlyData[year].fortnights[0].adhocTransactions).toHaveLength(0);
  });
});
