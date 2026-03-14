// @vitest-environment jsdom
/**
 * Unit tests for the People page component.
 *
 * Covers: empty state, populated rendering, add/edit/delete person,
 * tax breakdown expand, employment history, income events.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import People from '../People';
import { usePeopleStore } from '../../store/peopleStore';
import { useFinanceStore } from '../../store/financeStore';

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
  const current = usePeopleStore.getState().people;
  usePeopleStore.setState({ people: [...current, person] });
  return person;
}

// ── setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  usePeopleStore.setState({ people: [], expenses: [], wishlist: [] });
  useFinanceStore.setState({ assetIncomes: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── tests ────────────────────────────────────────────────────────────────────

describe('People — empty state', () => {
  it('renders empty state message when no people exist', () => {
    render(<People />);
    expect(screen.getByText('No income profiles yet')).toBeInTheDocument();
  });

  it('renders "Add your first person" button', () => {
    render(<People />);
    expect(screen.getByText('Add your first person')).toBeInTheDocument();
  });
});

describe('People — populated state', () => {
  it('renders person name and tax code', () => {
    seedPerson({ name: 'Alice', taxCode: 'M' });
    render(<People />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText(/M/)).toBeInTheDocument();
  });

  it('renders income summary section with combined net', () => {
    seedPerson({ name: 'Bob', grossAnnual: 80000 });
    render(<People />);
    expect(screen.getByText('Combined Net /fn')).toBeInTheDocument();
    expect(screen.getByText('Combined Annual')).toBeInTheDocument();
  });

  it('renders multiple people', () => {
    seedPerson({ id: 'p-1', name: 'Alice' });
    seedPerson({ id: 'p-2', name: 'Bob' });
    render(<People />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows deduction pills (Tax, ACC, KS)', () => {
    seedPerson({ name: 'Alice', kiwiSaverRate: 3 });
    render(<People />);
    const pills = document.querySelectorAll('.dpill');
    expect(pills.length).toBeGreaterThanOrEqual(2); // Tax + ACC at minimum
  });
});

describe('People — tax breakdown', () => {
  it('expands tax breakdown when toggle button is clicked', async () => {
    seedPerson({ name: 'Alice', grossAnnual: 75000 });
    const user = userEvent.setup();
    render(<People />);

    await user.click(screen.getByText('Tax breakdown'));
    expect(screen.getByText('Income Tax')).toBeInTheDocument();
    expect(screen.getByText('ACC Levy')).toBeInTheDocument();
    expect(screen.getByText('Net Annual')).toBeInTheDocument();
  });

  it('collapses tax breakdown when clicked again', async () => {
    seedPerson({ name: 'Alice', grossAnnual: 75000 });
    const user = userEvent.setup();
    render(<People />);

    await user.click(screen.getByText('Tax breakdown'));
    expect(screen.getByText('Income Tax')).toBeInTheDocument();

    await user.click(screen.getByText('Hide breakdown'));
    expect(screen.queryByText('Income Tax')).not.toBeInTheDocument();
  });
});

describe('People — add person', () => {
  it('opens add modal and saves a new person', async () => {
    const user = userEvent.setup();
    render(<People />);

    await user.click(screen.getByText('Add your first person'));
    expect(screen.getByRole('heading', { name: 'Add Person' })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('e.g. Sarah'), 'Charlie');
    const grossInput = screen.getByPlaceholderText('0');
    await user.clear(grossInput);
    await user.type(grossInput, '60000');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    const { people } = usePeopleStore.getState();
    expect(people).toHaveLength(1);
    expect(people[0].name).toBe('Charlie');
    expect(people[0].grossAnnual).toBe(60000);
  });

  it('closes modal on Cancel without saving', async () => {
    const user = userEvent.setup();
    render(<People />);

    await user.click(screen.getByText('Add your first person'));
    await user.type(screen.getByPlaceholderText('e.g. Sarah'), 'Temp');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('heading', { name: 'Add Person' })).not.toBeInTheDocument();
    expect(usePeopleStore.getState().people).toHaveLength(0);
  });
});

describe('People — edit person', () => {
  it('opens edit modal with existing data and updates on save', async () => {
    seedPerson({ name: 'Alice', grossAnnual: 75000 });
    const user = userEvent.setup();
    render(<People />);

    const editBtn = screen.getByLabelText('Edit person');
    await user.click(editBtn);

    expect(screen.getByRole('heading', { name: 'Edit Person' })).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('e.g. Sarah');
    await user.clear(nameInput);
    await user.type(nameInput, 'Alice Updated');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const { people } = usePeopleStore.getState();
    expect(people[0].name).toBe('Alice Updated');
  });
});

describe('People — delete person', () => {
  it('removes person from store when delete is confirmed', async () => {
    seedPerson({ name: 'Alice' });
    const user = userEvent.setup();
    render(<People />);

    const deleteBtn = screen.getByLabelText('Delete person');
    await user.click(deleteBtn);

    // ConfirmDialog appears — default confirmLabel is "Delete"
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(usePeopleStore.getState().people).toHaveLength(0);
  });

  it('does not remove person when delete is cancelled', async () => {
    seedPerson({ name: 'Alice' });
    const user = userEvent.setup();
    render(<People />);

    const deleteBtn = screen.getByLabelText('Delete person');
    await user.click(deleteBtn);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(usePeopleStore.getState().people).toHaveLength(1);
  });
});

describe('People — employment history in modal', () => {
  it('shows employment history section in modal and can add a role', async () => {
    const user = userEvent.setup();
    render(<People />);

    await user.click(screen.getByText('Add your first person'));
    expect(screen.getByText('Employment History')).toBeInTheDocument();

    await user.click(screen.getByText('+ Add Role'));
    expect(screen.getByPlaceholderText('Employer')).toBeInTheDocument();
  });
});

describe('People — asset income section', () => {
  it('renders asset income section', () => {
    render(<People />);
    expect(screen.getByText(/Asset Income/)).toBeInTheDocument();
  });

  it('renders empty state for asset income', () => {
    render(<People />);
    expect(screen.getByText(/No asset income yet/)).toBeInTheDocument();
  });
});
