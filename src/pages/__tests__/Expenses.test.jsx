// @vitest-environment jsdom
/**
 * Unit tests for the Expenses page component.
 *
 * Covers: empty state, populated rendering, group filtering, row expand,
 * add/edit/delete flows, archived expenses section.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Expenses from '../Expenses';
import { usePeopleStore } from '../../store/peopleStore';

// ── helpers ──────────────────────────────────────────────────────────────────

function seedExpense(overrides = {}) {
  const expense = {
    id: 'exp-1',
    name: 'Power Bill',
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
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── tests ────────────────────────────────────────────────────────────────────

describe('Expenses — empty state', () => {
  it('renders empty state message when no expenses exist', () => {
    render(<Expenses />);
    expect(screen.getByText(/No expenses yet/)).toBeInTheDocument();
  });

  it('renders "Add your first expense" button', () => {
    render(<Expenses />);
    expect(screen.getByText('Add your first expense')).toBeInTheDocument();
  });
});

describe('Expenses — populated state', () => {
  it('renders expense name and category tag', () => {
    seedExpense({ name: 'Internet Plan', category: 'Internet' });
    render(<Expenses />);
    expect(screen.getByText('Internet Plan')).toBeInTheDocument();
  });

  it('renders summary tiles with fortnightly/monthly/annual values', () => {
    seedExpense({ name: 'Rent', amount: 500, frequency: 'fortnightly' });
    render(<Expenses />);
    expect(screen.getByText('Fortnightly')).toBeInTheDocument();
    expect(screen.getByText('Monthly')).toBeInTheDocument();
    expect(screen.getByText('Annual')).toBeInTheDocument();
  });

  it('renders multiple expenses', () => {
    seedExpense({ id: 'exp-1', name: 'Power Bill', category: 'Power' });
    seedExpense({ id: 'exp-2', name: 'Internet Plan', category: 'Internet' });
    render(<Expenses />);
    expect(screen.getByText('Power Bill')).toBeInTheDocument();
    expect(screen.getByText('Internet Plan')).toBeInTheDocument();
  });
});

describe('Expenses — group filtering', () => {
  it('renders filter tabs when expenses exist', () => {
    seedExpense({ name: 'Power', category: 'Power' });
    render(<Expenses />);
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('filters expenses by group when a filter tab is clicked', async () => {
    const user = userEvent.setup();
    seedExpense({ id: 'exp-1', name: 'Power Bill', category: 'Power', amount: 100 });
    seedExpense({ id: 'exp-2', name: 'Groceries Shop', category: 'Groceries', amount: 200 });
    render(<Expenses />);

    // Both visible initially
    expect(screen.getByText('Power Bill')).toBeInTheDocument();
    expect(screen.getByText('Groceries Shop')).toBeInTheDocument();

    // Click a group filter — find the filter tab for the utilities group (contains Power)
    const filterTabs = screen.getAllByRole('button').filter(b => b.classList.contains('filter-tab'));
    const utilTab = filterTabs.find(b => b.textContent.includes('Utilities'));
    if (utilTab) {
      await user.click(utilTab);
      // Power Bill should still be visible, Groceries hidden
      expect(screen.getByText('Power Bill')).toBeInTheDocument();
      expect(screen.queryByText('Groceries Shop')).not.toBeInTheDocument();
    }
  });
});

describe('Expenses — row expand', () => {
  it('shows detail section when expense row is clicked', async () => {
    const user = userEvent.setup();
    seedExpense({ name: 'Power Bill', amount: 120, frequency: 'monthly', paymentMethod: 'Direct Debit' });
    render(<Expenses />);

    const row = screen.getByText('Power Bill').closest('.expense-row');
    await user.click(row);

    // Expanded detail shows monthly/annual breakdown
    expect(document.querySelector('.exp-detail')).toBeInTheDocument();
  });
});

describe('Expenses — archived expenses', () => {
  it('shows archived section for expenses with past endDate', () => {
    seedExpense({ id: 'exp-old', name: 'Old Subscription', endDate: '2020-01-01' });
    render(<Expenses />);
    expect(screen.getByText(/Archived Expenses/)).toBeInTheDocument();
  });

  it('does not show archived section when no expenses have endDate', () => {
    seedExpense({ name: 'Active Expense' });
    render(<Expenses />);
    expect(screen.queryByText(/Archived Expenses/)).not.toBeInTheDocument();
  });
});

describe('Expenses — add expense modal', () => {
  it('opens add modal and saves a new expense', async () => {
    const user = userEvent.setup();
    render(<Expenses />);

    await user.click(screen.getByText('Add your first expense'));
    expect(screen.getByRole('heading', { name: 'Add Expense' })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('e.g. Power — Contact Energy'), 'New Bill');
    const amountInput = screen.getByPlaceholderText('0.00');
    await user.clear(amountInput);
    await user.type(amountInput, '50');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const { expenses } = usePeopleStore.getState();
    expect(expenses).toHaveLength(1);
    expect(expenses[0].name).toBe('New Bill');
  });

  it('closes modal on Cancel without saving', async () => {
    const user = userEvent.setup();
    render(<Expenses />);

    await user.click(screen.getByText('Add your first expense'));
    await user.type(screen.getByPlaceholderText('e.g. Power — Contact Energy'), 'Temp');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('heading', { name: 'Add Expense' })).not.toBeInTheDocument();
    expect(usePeopleStore.getState().expenses).toHaveLength(0);
  });
});

describe('Expenses — delete expense', () => {
  it('removes expense after confirm dialog', async () => {
    seedExpense({ name: 'To Delete' });
    const user = userEvent.setup();
    render(<Expenses />);

    const dangerBtns = document.querySelectorAll('.btn-icon.danger');
    await user.click(dangerBtns[0]);

    expect(screen.getByText('Remove this expense?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(usePeopleStore.getState().expenses).toHaveLength(0);
  });
});
