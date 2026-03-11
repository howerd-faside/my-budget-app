// @vitest-environment jsdom
/**
 * Integration tests for the PropertyRegister page.
 *
 * Covers:
 *   - Empty state → Add Property button → modal → form submission → store update
 *   - Property appears in the rendered list after creation
 *   - Edit property → store update
 *   - Delete property with no dependents → removed from store
 *   - Cascade delete: delete property with tasks/maintenance → all cleared
 *   - selectedPropertyId is set to the first property created
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PropertyRegister from '../../pages/property/PropertyRegister';
import { usePropertyStore } from '../../store/propertyStore';

// ── helpers ───────────────────────────────────────────────────────────────────

function renderRegister() {
  return render(<PropertyRegister />);
}

function seedProperty(overrides = {}) {
  const prop = {
    id: 'prop-seed-1',
    name: 'Our Place',
    type: 'Primary Home',
    address: '1 Main St',
    areas: [],
    bedrooms: '', bathrooms: '', yearBuilt: '',
    constructionType: '', roofType: '', cladding: '',
    landArea: '', floorArea: '',
    insulation: { ceiling: '', underfloor: '', walls: '' },
    heating: '', waterSupply: '', wastewater: '',
    notes: '',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
  usePropertyStore.setState({
    properties: [prop],
    selectedPropertyId: prop.id,
  });
  return prop;
}

// ── setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  usePropertyStore.setState({
    properties: [], propertyTasks: [], propertyMaintenance: [],
    propertyProjects: [], propertyAssets: [], selectedPropertyId: null,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe('PropertyRegister — empty state', () => {
  it('shows an "Add Property" button when no properties exist', () => {
    renderRegister();
    // Multiple "Add Property" buttons may appear (header + empty state)
    const addBtns = screen.getAllByText(/Add Property/i);
    expect(addBtns.length).toBeGreaterThan(0);
  });

  it('opens the Add Property modal on click', async () => {
    const user = userEvent.setup();
    renderRegister();
    const addBtns = screen.getAllByText(/Add Property/i);
    await user.click(addBtns[0]);
    expect(screen.getByRole('heading', { name: 'Add Property' })).toBeInTheDocument();
  });
});

describe('PropertyRegister — creating a property', () => {
  it('persists a new property to the store on save', async () => {
    const user = userEvent.setup();
    renderRegister();

    const addBtns = screen.getAllByText(/Add Property/i);
    await user.click(addBtns[0]);

    const nameInput = screen.getByPlaceholderText(/Our Place/i);
    await user.type(nameInput, 'Beach Bach');

    // Modal has no role=dialog; scope to modal footer to find the submit button
    const modalFooter = document.querySelector('.modal-footer');
    await user.click(within(modalFooter).getByRole('button', { name: 'Add Property' }));

    const { properties } = usePropertyStore.getState();
    expect(properties).toHaveLength(1);
    expect(properties[0].name).toBe('Beach Bach');
  });

  it('sets selectedPropertyId to the first property created', async () => {
    const user = userEvent.setup();
    renderRegister();

    const addBtns = screen.getAllByText(/Add Property/i);
    await user.click(addBtns[0]);
    await user.type(screen.getByPlaceholderText(/Our Place/i), 'Home');
    await user.click(within(document.querySelector('.modal-footer')).getByRole('button', { name: 'Add Property' }));

    const state = usePropertyStore.getState();
    expect(state.selectedPropertyId).toBe(state.properties[0].id);
  });

  it('shows the property name in the property list after creation', async () => {
    const user = userEvent.setup();
    renderRegister();

    const addBtns = screen.getAllByText(/Add Property/i);
    await user.click(addBtns[0]);
    await user.type(screen.getByPlaceholderText(/Our Place/i), 'Lake House');
    await user.click(within(document.querySelector('.modal-footer')).getByRole('button', { name: 'Add Property' }));

    expect(screen.getAllByText('Lake House').length).toBeGreaterThan(0);
  });

  it('does not save when name is empty (Save button is disabled)', async () => {
    const user = userEvent.setup();
    renderRegister();

    const addBtns = screen.getAllByText(/Add Property/i);
    await user.click(addBtns[0]);
    // Leave name blank

    const saveBtn = within(document.querySelector('.modal-footer')).getByRole('button', { name: 'Add Property' });
    expect(saveBtn).toBeDisabled();
    expect(usePropertyStore.getState().properties).toHaveLength(0);
  });
});

describe('PropertyRegister — editing a property', () => {
  it('updates the property name in the store', async () => {
    seedProperty({ name: 'Our Place' });
    const user = userEvent.setup();
    renderRegister();

    // Edit button on the prop detail panel
    const editBtns = screen.getAllByRole('button', { name: /Edit/i });
    await user.click(editBtns[0]);

    const nameInput = screen.getByPlaceholderText(/Our Place/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Renamed Place');

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(usePropertyStore.getState().properties[0].name).toBe('Renamed Place');
  });
});

describe('PropertyRegister — deleting a property', () => {
  it('removes a property with no dependents when confirmed', async () => {
    seedProperty();
    const user = userEvent.setup();
    renderRegister();

    const dangerBtns = document.querySelectorAll('.btn-icon.danger');
    await user.click(dangerBtns[0]);

    expect(window.confirm).toHaveBeenCalled();
    expect(usePropertyStore.getState().properties).toHaveLength(0);
  });

  it('cascade-deletes tasks and maintenance linked to the property', () => {
    const prop = seedProperty();
    usePropertyStore.setState({
      properties: [prop],
      selectedPropertyId: prop.id,
      propertyTasks: [
        { id: 't1', propertyId: prop.id, title: 'Fix roof', status: 'Open', priority: 'Medium', notes: [], createdAt: '' },
      ],
      propertyMaintenance: [
        { id: 'm1', propertyId: prop.id, title: 'Replaced gutters', date: '2026-01-01', createdAt: '' },
      ],
      propertyProjects: [],
      propertyAssets: [],
    });

    renderRegister();

    const dangerBtns = document.querySelectorAll('.btn-icon.danger');
    fireEvent.click(dangerBtns[0]);

    const state = usePropertyStore.getState();
    expect(state.properties).toHaveLength(0);
    expect(state.propertyTasks).toHaveLength(0);
    expect(state.propertyMaintenance).toHaveLength(0);
  });

  it('does not delete when confirm returns false', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    seedProperty();
    renderRegister();

    const dangerBtns = document.querySelectorAll('.btn-icon.danger');
    fireEvent.click(dangerBtns[0]);

    expect(usePropertyStore.getState().properties).toHaveLength(1);
  });
});

describe('PropertyRegister — modal cancel', () => {
  it('closes the modal without saving on Cancel', async () => {
    const user = userEvent.setup();
    renderRegister();

    const addBtns = screen.getAllByText(/Add Property/i);
    await user.click(addBtns[0]);
    await user.type(screen.getByPlaceholderText(/Our Place/i), 'Draft');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('heading', { name: 'Add Property' })).not.toBeInTheDocument();
    expect(usePropertyStore.getState().properties).toHaveLength(0);
  });
});
