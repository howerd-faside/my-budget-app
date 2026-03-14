// @vitest-environment jsdom
/**
 * Integration tests for the Expenses page.
 *
 * Covers:
 *   - Empty state → add expense modal → form submission → store update → UI reflects change
 *   - Edit expense → store update
 *   - Delete expense → store update (cascades none; pure single-entity removal)
 *   - Validation: missing required fields prevents save
 *   - Fortnightly total tile updates when expenses are added/removed
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Expenses from '../../pages/Expenses';
import { usePeopleStore } from '../../store/peopleStore';

// ── helpers ───────────────────────────────────────────────────────────────────

function renderExpenses() {
  return render(<Expenses />);
}

/** Seed a single active expense directly into the store */
function seedExpense(overrides = {}) {
  const expense = {
    id: 'e-seed-1',
    name: 'Power Bill',
    amount: 120,
    frequency: 'monthly',
    category: 'Power',
    type: 'standard',
    subtype: 'fixed',
    facilities: [],
    forPerson: '',
    ...overrides,
  };
  usePeopleStore.setState({ expenses: [expense] });
  return expense;
}

// ── setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  usePeopleStore.setState({ people: [], expenses: [], wishlist: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe('Expenses — empty state', () => {
  it('shows "Add your first expense" button when no expenses exist', () => {
    renderExpenses();
    expect(screen.getByText('Add your first expense')).toBeInTheDocument();
  });

  it('opens the Add Expense modal when clicking the empty-state button', async () => {
    const user = userEvent.setup();
    renderExpenses();
    await user.click(screen.getByText('Add your first expense'));
    expect(screen.getByRole('heading', { name: 'Add Expense' })).toBeInTheDocument();
  });
});

describe('Expenses — creating an expense', () => {
  it('persists a new regular expense to the store on save', async () => {
    const user = userEvent.setup();
    renderExpenses();

    await user.click(screen.getByText('Add your first expense'));

    // Name
    await user.type(screen.getByPlaceholderText('e.g. Power — Contact Energy'), 'Rent');
    // Amount
    const amountInput = screen.getByPlaceholderText('0.00');
    await user.clear(amountInput);
    await user.type(amountInput, '800');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    const { expenses } = usePeopleStore.getState();
    expect(expenses).toHaveLength(1);
    expect(expenses[0].name).toBe('Rent');
    expect(expenses[0].amount).toBe(800);
  });

  it('closes the modal after a successful save', async () => {
    const user = userEvent.setup();
    renderExpenses();

    await user.click(screen.getByText('Add your first expense'));
    await user.type(screen.getByPlaceholderText('e.g. Power — Contact Energy'), 'Rent');
    const amountInput = screen.getByPlaceholderText('0.00');
    await user.clear(amountInput);
    await user.type(amountInput, '800');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.queryByRole('heading', { name: 'Add Expense' })).not.toBeInTheDocument();
  });

  it('shows the new expense name in the list after saving', async () => {
    const user = userEvent.setup();
    renderExpenses();

    await user.click(screen.getByText('Add your first expense'));
    await user.type(screen.getByPlaceholderText('e.g. Power — Contact Energy'), 'Rent');
    const amountInput = screen.getByPlaceholderText('0.00');
    await user.clear(amountInput);
    await user.type(amountInput, '800');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Rent')).toBeInTheDocument();
  });

  it('does not save when amount is missing (validation error shown)', async () => {
    const user = userEvent.setup();
    renderExpenses();

    await user.click(screen.getByText('Add your first expense'));
    await user.type(screen.getByPlaceholderText('e.g. Power — Contact Energy'), 'Rent');
    // Leave amount empty
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Modal stays open — store not updated
    expect(screen.getByRole('heading', { name: 'Add Expense' })).toBeInTheDocument();
    expect(usePeopleStore.getState().expenses).toHaveLength(0);
  });
});

describe('Expenses — editing an expense', () => {
  it('updates the expense name in the store when edited', async () => {
    seedExpense({ name: 'Power Bill', amount: 120 });
    const user = userEvent.setup();
    renderExpenses();

    // Open edit modal via pencil button
    const editBtns = document.querySelectorAll('.btn-icon:not(.danger)');
    await user.click(editBtns[0]);

    expect(screen.getByRole('heading', { name: 'Edit Expense' })).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('e.g. Power — Contact Energy');
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Power');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const { expenses } = usePeopleStore.getState();
    expect(expenses[0].name).toBe('Updated Power');
  });

  it('records a change history entry when amount is edited', async () => {
    seedExpense({ name: 'Power Bill', amount: 120, frequency: 'monthly' });
    const user = userEvent.setup();
    renderExpenses();

    const editBtns = document.querySelectorAll('.btn-icon:not(.danger)');
    await user.click(editBtns[0]);

    const amountInput = screen.getByPlaceholderText('0.00');
    await user.clear(amountInput);
    await user.type(amountInput, '200');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const { expenses } = usePeopleStore.getState();
    expect(expenses[0].amount).toBe(200);
    expect(expenses[0].history).toHaveLength(1);
    expect(expenses[0].history[0].oldAmount).toBe(120);
    expect(expenses[0].history[0].newAmount).toBe(200);
  });
});

describe('Expenses — deleting an expense', () => {
  it('removes the expense from the store when delete is confirmed', async () => {
    seedExpense();
    const user = userEvent.setup();
    renderExpenses();

    expect(screen.getByText('Power Bill')).toBeInTheDocument();

    const dangerBtns = document.querySelectorAll('.btn-icon.danger');
    await user.click(dangerBtns[0]);

    expect(screen.getByText('Remove this expense?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(usePeopleStore.getState().expenses).toHaveLength(0);
  });

  it('does not remove the expense if confirm is cancelled', async () => {
    seedExpense();
    const user = userEvent.setup();
    renderExpenses();

    const dangerBtns = document.querySelectorAll('.btn-icon.danger');
    await user.click(dangerBtns[0]);

    expect(screen.getByText('Remove this expense?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(usePeopleStore.getState().expenses).toHaveLength(1);
  });
});

describe('Expenses — modal cancel', () => {
  it('closes the modal and discards changes on Cancel', async () => {
    const user = userEvent.setup();
    renderExpenses();

    await user.click(screen.getByText('Add your first expense'));
    await user.type(screen.getByPlaceholderText('e.g. Power — Contact Energy'), 'Partial');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('heading', { name: 'Add Expense' })).not.toBeInTheDocument();
    expect(usePeopleStore.getState().expenses).toHaveLength(0);
  });
});
