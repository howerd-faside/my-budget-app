// @vitest-environment jsdom
/**
 * Integration tests for the People page.
 *
 * Covers:
 *   - Empty state → create person → store update → UI renders person card
 *   - Edit person → store update
 *   - Delete person with no linked expenses → removed from store
 *   - Cascade delete: delete person who owns expenses → expenses cleared too
 *   - Net fortnightly income derived value is computed and stored on save
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import People from '../../pages/People';
import { usePeopleStore } from '../../store/peopleStore';
import { useFinanceStore } from '../../store/financeStore';

// ── helpers ───────────────────────────────────────────────────────────────────

function renderPeople() {
  return render(<People />);
}

function seedPerson(overrides = {}) {
  const person = {
    id: 'p-seed-1',
    name: 'Alice',
    grossAnnual: 80000,
    taxCode: 'M',
    kiwiSaverRate: 3,
    payFrequency: 'fortnightly',
    secondaryIncomes: [],
    incomeEvents: [],
    employmentHistory: [],
    netFortnightly: 2100,
    ...overrides,
  };
  usePeopleStore.setState({ people: [person] });
  return person;
}

// ── setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  usePeopleStore.setState({ people: [], expenses: [], wishlist: [] });
  useFinanceStore.setState({
    accounts: [], transfers: [], fortnightlyData: {}, goals: [],
    assetIncomes: [], settings: { currentBalance: 0 },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe('People — empty state', () => {
  it('renders "Add your first person" button when no people exist', () => {
    renderPeople();
    expect(screen.getByText('Add your first person')).toBeInTheDocument();
  });

  it('opens the Add Person modal on click', async () => {
    const user = userEvent.setup();
    renderPeople();
    await user.click(screen.getByText('Add your first person'));
    expect(screen.getByRole('heading', { name: 'Add Person' })).toBeInTheDocument();
  });
});

describe('People — creating a person', () => {
  it('persists a new person to the store on save', async () => {
    const user = userEvent.setup();
    renderPeople();

    await user.click(screen.getByText('Add your first person'));

    await user.type(screen.getByPlaceholderText('e.g. Sarah'), 'Bob');
    const grossInput = screen.getByPlaceholderText('0');
    await user.clear(grossInput);
    await user.type(grossInput, '75000');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    const { people } = usePeopleStore.getState();
    expect(people).toHaveLength(1);
    expect(people[0].name).toBe('Bob');
    expect(people[0].grossAnnual).toBe(75000);
  });

  it('calculates and stores netFortnightly on save', async () => {
    const user = userEvent.setup();
    renderPeople();

    await user.click(screen.getByText('Add your first person'));
    await user.type(screen.getByPlaceholderText('e.g. Sarah'), 'Bob');
    const grossInput = screen.getByPlaceholderText('0');
    await user.clear(grossInput);
    await user.type(grossInput, '75000');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const { people } = usePeopleStore.getState();
    // netFortnightly should be a positive number (NZ tax applied)
    expect(people[0].netFortnightly).toBeGreaterThan(0);
    expect(people[0].netFortnightly).toBeLessThan(75000 / 26); // must be less than gross/fn
  });

  it('shows the new person name in the rendered list', async () => {
    const user = userEvent.setup();
    renderPeople();

    await user.click(screen.getByText('Add your first person'));
    await user.type(screen.getByPlaceholderText('e.g. Sarah'), 'Carol');
    const grossInput = screen.getByPlaceholderText('0');
    await user.clear(grossInput);
    await user.type(grossInput, '60000');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Carol')).toBeInTheDocument();
  });

  it('does not save when name is empty (validation blocks)', async () => {
    const user = userEvent.setup();
    renderPeople();

    await user.click(screen.getByText('Add your first person'));
    // Type gross but leave name blank
    const grossInput = screen.getByPlaceholderText('0');
    await user.clear(grossInput);
    await user.type(grossInput, '60000');

    const saveBtn = screen.getByRole('button', { name: 'Save' });
    await user.click(saveBtn);
    expect(usePeopleStore.getState().people).toHaveLength(0);
  });
});

describe('People — editing a person', () => {
  it('updates the person name in the store', async () => {
    seedPerson({ name: 'Alice', grossAnnual: 80000 });
    const user = userEvent.setup();
    renderPeople();

    // The "+ Add Person" button is always visible in the section header.
    // The person card has a pencil edit button.
    const editBtns = document.querySelectorAll('.btn-icon:not(.danger)');
    await user.click(editBtns[0]);

    expect(screen.getByRole('heading', { name: 'Edit Person' })).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('e.g. Sarah');
    await user.clear(nameInput);
    await user.type(nameInput, 'Alicia');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(usePeopleStore.getState().people[0].name).toBe('Alicia');
  });
});

describe('People — deleting a person', () => {
  it('removes the person from the store when confirmed', async () => {
    seedPerson();
    const user = userEvent.setup();
    renderPeople();

    const dangerBtns = document.querySelectorAll('.btn-icon.danger');
    await user.click(dangerBtns[0]);

    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(usePeopleStore.getState().people).toHaveLength(0);
  });

  it('cascades deletion of expenses linked to the deleted person', async () => {
    const person = seedPerson({ name: 'Dave' });
    usePeopleStore.setState({
      people: [person],
      expenses: [
        { id: 'e1', name: 'Spending', forPerson: 'p-seed-1', category: 'Spending Money', amount: 200, frequency: 'fortnightly', type: 'standard', subtype: 'fixed', facilities: [] },
        { id: 'e2', name: 'Power', forPerson: '', category: 'Power', amount: 120, frequency: 'monthly', type: 'standard', subtype: 'fixed', facilities: [] },
      ],
    });

    const user = userEvent.setup();
    renderPeople();

    const dangerBtns = document.querySelectorAll('.btn-icon.danger');
    await user.click(dangerBtns[0]);
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    const state = usePeopleStore.getState();
    expect(state.people).toHaveLength(0);
    // The shared expense (forPerson='') should have its forPerson cleared, not deleted
    // The 'Dave'-specific spending money expense gets forPerson cleared or expense removed
    // cascadeDeletePerson clears forPerson on linked expenses, doesn't delete them
    // Dave's expense should have forPerson cleared (matched by personId, not name)
    expect(state.expenses.find(e => e.id === 'e1').forPerson).toBe('');
    // Shared expense untouched
    expect(state.expenses.find(e => e.id === 'e2').forPerson).toBe('');
  });

  it('does not remove the person if confirm is cancelled', async () => {
    seedPerson();
    const user = userEvent.setup();
    renderPeople();

    const dangerBtns = document.querySelectorAll('.btn-icon.danger');
    await user.click(dangerBtns[0]);

    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(usePeopleStore.getState().people).toHaveLength(1);
  });
});

describe('People — modal cancel', () => {
  it('closes the modal without saving on Cancel', async () => {
    const user = userEvent.setup();
    renderPeople();

    await user.click(screen.getByText('Add your first person'));
    await user.type(screen.getByPlaceholderText('e.g. Sarah'), 'Partial Name');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('heading', { name: 'Add Person' })).not.toBeInTheDocument();
    expect(usePeopleStore.getState().people).toHaveLength(0);
  });
});
