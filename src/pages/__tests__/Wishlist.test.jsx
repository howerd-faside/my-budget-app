// @vitest-environment jsdom
/**
 * Unit tests for the Wishlist page component.
 *
 * Covers: empty state, populated rendering, add/edit/delete items,
 * toggle purchased, affordability status, purchase simulator.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Wishlist from '../Wishlist';
import { usePeopleStore } from '../../store/peopleStore';
import { useFinanceStore } from '../../store/financeStore';

// ── helpers ──────────────────────────────────────────────────────────────────

function seedWishlistItem(overrides = {}) {
  const item = {
    id: 'wl-1',
    name: 'New TV',
    estimatedCost: 2000,
    notes: '',
    purchased: false,
    ...overrides,
  };
  const current = usePeopleStore.getState().wishlist || [];
  usePeopleStore.setState({ wishlist: [...current, item] });
  return item;
}

function seedFinanceState() {
  useFinanceStore.setState({
    accounts: [
      { id: 'main', name: 'Savings', balance: 5000 },
      { id: 'emergency', name: 'Emergency', balance: 2000 },
    ],
    fortnightlyData: {},
    goals: [],
    assetIncomes: [],
  });
}

// ── setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  usePeopleStore.setState({ people: [], expenses: [], wishlist: [] });
  seedFinanceState();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── tests ────────────────────────────────────────────────────────────────────

describe('Wishlist — empty state', () => {
  it('renders empty state message when no items exist', () => {
    render(<Wishlist />);
    expect(screen.getByText(/Nothing on your wishlist yet/)).toBeInTheDocument();
  });

  it('renders "Add your first item" button', () => {
    render(<Wishlist />);
    expect(screen.getByText('Add your first item')).toBeInTheDocument();
  });
});

describe('Wishlist — populated state', () => {
  it('renders item name and cost', () => {
    seedWishlistItem({ name: 'New TV', estimatedCost: 2000 });
    render(<Wishlist />);
    expect(screen.getByText('New TV')).toBeInTheDocument();
  });

  it('renders summary tiles', () => {
    seedWishlistItem({ name: 'Laptop', estimatedCost: 3000 });
    render(<Wishlist />);
    expect(screen.getByText('Total Pending')).toBeInTheDocument();
    // "Can Buy Now" appears both as stat tile label and as badge text
    expect(screen.getAllByText('Can Buy Now').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Next Affordable')).toBeInTheDocument();
  });

  it('shows affordability badge for affordable items', () => {
    // Balance is 7000, item costs 500
    seedWishlistItem({ name: 'Cheap Item', estimatedCost: 500 });
    render(<Wishlist />);
    // The "Can Buy Now" badge appears on the card + the stat tile
    expect(screen.getAllByText('Can Buy Now').length).toBeGreaterThanOrEqual(2);
  });

  it('renders pending and purchased sections separately', () => {
    seedWishlistItem({ id: 'wl-1', name: 'Pending Item', purchased: false });
    seedWishlistItem({ id: 'wl-2', name: 'Bought Item', purchased: true });
    render(<Wishlist />);
    expect(screen.getByText('Pending Item')).toBeInTheDocument();
    expect(screen.getByText('Bought Item')).toBeInTheDocument();
  });

  it('shows item notes when present', () => {
    seedWishlistItem({ name: 'TV', notes: 'Samsung 65 inch' });
    render(<Wishlist />);
    expect(screen.getByText('Samsung 65 inch')).toBeInTheDocument();
  });
});

describe('Wishlist — add item', () => {
  it('opens add modal and saves a new item', async () => {
    const user = userEvent.setup();
    render(<Wishlist />);

    await user.click(screen.getByText('Add your first item'));
    expect(screen.getByRole('heading', { name: 'Add Item' })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('e.g. New TV'), 'Gaming Console');
    const costInput = screen.getByPlaceholderText('0');
    await user.clear(costInput);
    await user.type(costInput, '800');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    const wishlist = usePeopleStore.getState().wishlist;
    expect(wishlist).toHaveLength(1);
    expect(wishlist[0].name).toBe('Gaming Console');
    expect(wishlist[0].estimatedCost).toBe(800);
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    render(<Wishlist />);

    await user.click(screen.getByText('Add your first item'));
    // Leave name empty, click save
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Modal stays open
    expect(screen.getByRole('heading', { name: 'Add Item' })).toBeInTheDocument();
    expect(usePeopleStore.getState().wishlist).toHaveLength(0);
  });

  it('closes modal on Cancel without saving', async () => {
    const user = userEvent.setup();
    render(<Wishlist />);

    await user.click(screen.getByText('Add your first item'));
    await user.type(screen.getByPlaceholderText('e.g. New TV'), 'Temp');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('heading', { name: 'Add Item' })).not.toBeInTheDocument();
    expect(usePeopleStore.getState().wishlist).toHaveLength(0);
  });
});

describe('Wishlist — edit item', () => {
  it('opens edit modal and updates item', async () => {
    seedWishlistItem({ name: 'Old Name', estimatedCost: 1000 });
    const user = userEvent.setup();
    render(<Wishlist />);

    const editBtn = screen.getByLabelText('Edit item');
    await user.click(editBtn);

    expect(screen.getByRole('heading', { name: 'Edit Item' })).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('e.g. New TV');
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Name');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const wishlist = usePeopleStore.getState().wishlist;
    expect(wishlist[0].name).toBe('Updated Name');
  });
});

describe('Wishlist — delete item', () => {
  it('removes item from store when confirmed', async () => {
    seedWishlistItem({ name: 'To Delete' });
    const user = userEvent.setup();
    render(<Wishlist />);

    const deleteBtn = screen.getByLabelText('Delete item');
    await user.click(deleteBtn);

    // Confirm in the ConfirmDialog
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(usePeopleStore.getState().wishlist).toHaveLength(0);
  });
});

describe('Wishlist — toggle purchased', () => {
  it('marks item as purchased when toggle button is clicked', async () => {
    seedWishlistItem({ id: 'wl-1', name: 'Gadget', purchased: false });
    const user = userEvent.setup();
    render(<Wishlist />);

    // Find the "Purchased" button inside a .wl-actions element (not the stat tile)
    const purchasedBtns = screen.getAllByText('Purchased');
    const actionBtn = purchasedBtns.find(el => el.closest('.wl-actions'));
    await user.click(actionBtn);

    const wishlist = usePeopleStore.getState().wishlist;
    expect(wishlist[0].purchased).toBe(true);
  });

  it('marks item as unpurchased when Undo is clicked', async () => {
    seedWishlistItem({ id: 'wl-1', name: 'Gadget', purchased: true });
    const user = userEvent.setup();
    render(<Wishlist />);

    await user.click(screen.getByText('Undo'));

    const wishlist = usePeopleStore.getState().wishlist;
    expect(wishlist[0].purchased).toBe(false);
  });
});

describe('Wishlist — purchase simulator', () => {
  it('opens purchase simulator when Simulate button is clicked', async () => {
    seedWishlistItem({ name: 'Big Purchase', estimatedCost: 3000 });
    const user = userEvent.setup();
    render(<Wishlist />);

    await user.click(screen.getByText('Simulate'));
    expect(screen.getByText('Buy Now Simulator')).toBeInTheDocument();
    // Item name appears in both the card and the simulator modal
    expect(screen.getAllByText('Big Purchase').length).toBeGreaterThanOrEqual(2);
  });
});
