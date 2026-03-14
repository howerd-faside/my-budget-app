// @vitest-environment jsdom
/**
 * Unit tests for the Dashboard page component.
 *
 * Covers: empty state, accounts section, income section, savings trajectory,
 * expense summary, goals, transfer modal.
 *
 * Recharts is mocked to avoid SVG rendering issues in jsdom.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dashboard from '../Dashboard';
import { usePeopleStore } from '../../store/peopleStore';
import { useFinanceStore } from '../../store/financeStore';

// ── Recharts mock ────────────────────────────────────────────────────────────
vi.mock('recharts', () => {
  const Passthrough = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Passthrough,
    AreaChart: Passthrough,
    Area: () => null,
    BarChart: Passthrough,
    Bar: () => null,
    LineChart: Passthrough,
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    ReferenceLine: () => null,
  };
});

// ── helpers ──────────────────────────────────────────────────────────────────

function seedAccounts() {
  useFinanceStore.setState({
    accounts: [
      { id: 'main', name: 'Savings', balance: 10000 },
      { id: 'emergency', name: 'Emergency', balance: 5000 },
      { id: 'travel', name: 'Travel', balance: 2000 },
    ],
  });
}

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
  const current = usePeopleStore.getState().people;
  usePeopleStore.setState({ people: [...current, person] });
  return person;
}

function seedExpense(overrides = {}) {
  const expense = {
    id: 'exp-1',
    name: 'Power',
    amount: 120,
    frequency: 'monthly',
    category: 'Power',
    type: 'standard',
    subtype: 'fixed',
    paymentMethod: 'Direct Debit',
    ddDay: null,
    lender: '',
    facilities: [],
    notes: '',
    history: [],
    startDate: '',
    endDate: '',
    forPerson: '',
    ...overrides,
  };
  const current = usePeopleStore.getState().expenses;
  usePeopleStore.setState({ expenses: [...current, expense] });
  return expense;
}

// ── setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  usePeopleStore.setState({ people: [], expenses: [], wishlist: [] });
  useFinanceStore.setState({
    accounts: [
      { id: 'main', name: 'Savings', balance: 0 },
      { id: 'emergency', name: 'Emergency', balance: 0 },
    ],
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

describe('Dashboard — empty state', () => {
  it('renders welcome empty state when no people or expenses', () => {
    render(<Dashboard />);
    expect(screen.getByText(/Welcome! Start by adding/)).toBeInTheDocument();
  });
});

describe('Dashboard — accounts section', () => {
  it('renders account cards with names', () => {
    seedAccounts();
    render(<Dashboard />);
    expect(screen.getByText('Savings')).toBeInTheDocument();
    expect(screen.getByText('Emergency')).toBeInTheDocument();
    expect(screen.getByText('Travel')).toBeInTheDocument();
  });

  it('shows Transfer button when multiple accounts exist', () => {
    seedAccounts();
    render(<Dashboard />);
    expect(screen.getByText('Transfer')).toBeInTheDocument();
  });

  it('opens TransferModal when Transfer button is clicked', async () => {
    seedAccounts();
    const user = userEvent.setup();
    render(<Dashboard />);

    await user.click(screen.getByText('Transfer'));
    expect(screen.getByText('Transfer Between Accounts')).toBeInTheDocument();
  });
});

describe('Dashboard — income section', () => {
  it('renders income section when people exist', () => {
    seedAccounts();
    seedPerson({ name: 'Alice', grossAnnual: 75000 });
    render(<Dashboard />);
    expect(screen.getByText('Employment /fn')).toBeInTheDocument();
    expect(screen.getAllByText('Annual Gross').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Avg Tax Rate')).toBeInTheDocument();
  });

  it('shows earner count', () => {
    seedAccounts();
    seedPerson({ id: 'p-1', name: 'Alice', grossAnnual: 75000 });
    seedPerson({ id: 'p-2', name: 'Bob', grossAnnual: 60000 });
    render(<Dashboard />);
    expect(screen.getByText('2 earners')).toBeInTheDocument();
  });

  it('does not render income section when no people exist', () => {
    seedAccounts();
    render(<Dashboard />);
    expect(screen.queryByText('Employment /fn')).not.toBeInTheDocument();
  });
});

describe('Dashboard — savings trajectory', () => {
  it('renders savings trajectory section with current balance tile', () => {
    seedAccounts();
    render(<Dashboard />);
    expect(screen.getByText('Current Balance')).toBeInTheDocument();
    expect(screen.getByText('Goals Set')).toBeInTheDocument();
  });

  it('renders view range buttons', () => {
    seedAccounts();
    render(<Dashboard />);
    expect(screen.getByText('1y')).toBeInTheDocument();
    expect(screen.getByText('3y')).toBeInTheDocument();
    expect(screen.getByText('5y')).toBeInTheDocument();
  });

  it('changes view range when button is clicked', async () => {
    seedAccounts();
    const user = userEvent.setup();
    render(<Dashboard />);

    const btn1y = screen.getByText('1y');
    await user.click(btn1y);
    expect(btn1y.classList.contains('active')).toBe(true);
  });
});

describe('Dashboard — expenses section', () => {
  it('renders expense summary when expenses exist', () => {
    seedAccounts();
    seedExpense({ name: 'Power', amount: 120, frequency: 'monthly' });
    render(<Dashboard />);
    // Expense section shows Fortnightly/Monthly/Annual
    const fnLabels = screen.getAllByText('Fortnightly');
    expect(fnLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('does not render expense section when no expenses', () => {
    seedAccounts();
    render(<Dashboard />);
    // No expense-related proportion bar
    expect(document.querySelector('.cat-proportion')).not.toBeInTheDocument();
  });
});

describe('Dashboard — goals section', () => {
  it('renders goals section within trajectory card', () => {
    useFinanceStore.setState({
      accounts: [{ id: 'main', name: 'Savings', balance: 5000 }],
      goals: [{ id: 'g-1', name: 'Holiday', amount: 10000 }],
    });
    render(<Dashboard />);
    expect(screen.getByText('Goals Set')).toBeInTheDocument();
  });
});

describe('Dashboard — transfer modal', () => {
  it('opens and closes transfer modal', async () => {
    seedAccounts();
    const user = userEvent.setup();
    render(<Dashboard />);

    await user.click(screen.getByText('Transfer'));
    expect(screen.getByText('Transfer Between Accounts')).toBeInTheDocument();

    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Transfer Between Accounts')).not.toBeInTheDocument();
  });
});

describe('Dashboard — recent transfers', () => {
  it('renders recent transfers when they exist', () => {
    seedAccounts();
    useFinanceStore.setState({
      accounts: [
        { id: 'main', name: 'Savings', balance: 10000 },
        { id: 'emergency', name: 'Emergency', balance: 5000 },
      ],
      transfers: [
        { id: 'tx-1', date: '2026-03-10', fromId: 'main', toId: 'emergency', amount: 500, note: 'Buffer' },
      ],
    });
    render(<Dashboard />);
    expect(screen.getByText('Recent Transfers')).toBeInTheDocument();
    expect(screen.getByText(/Buffer/)).toBeInTheDocument();
  });
});
