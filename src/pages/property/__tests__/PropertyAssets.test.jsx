// @vitest-environment jsdom
/**
 * Unit tests for the PropertyAssets page component.
 *
 * Covers: empty state, populated rendering, snapshot tiles, filtering,
 * add/edit/delete asset, condition pills, type grouping.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PropertyAssets from '../PropertyAssets';
import { usePropertyStore } from '../../../store/propertyStore';

// ── helpers ──────────────────────────────────────────────────────────────────

const PROP_ID = 'prop-1';

function seedProperty(overrides = {}) {
  const prop = {
    id: PROP_ID,
    name: 'Test House',
    type: 'House',
    address: '1 Test St',
    areas: [{ id: 'area-1', name: 'Kitchen', group: 'Interior' }],
    ...overrides,
  };
  usePropertyStore.setState({ properties: [prop], selectedPropertyId: prop.id });
  return prop;
}

function seedAsset(overrides = {}) {
  const asset = {
    id: 'asset-1',
    propertyId: PROP_ID,
    name: 'Heat Pump',
    type: 'HVAC',
    areaId: '',
    brand: 'Mitsubishi',
    model: 'MSZ-AP25VG',
    condition: 'Good',
    dateInstalled: '2022-01-15',
    warrantyExpiry: '',
    expectedLifespan: '15',
    notes: '',
    createdAt: '2026-01-01',
    ...overrides,
  };
  const current = usePropertyStore.getState().propertyAssets;
  usePropertyStore.setState({ propertyAssets: [...current, asset] });
  return asset;
}

// ── setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  usePropertyStore.setState({
    properties: [],
    propertyTasks: [],
    propertyMaintenance: [],
    propertyProjects: [],
    propertyAssets: [],
    selectedPropertyId: null,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── tests ────────────────────────────────────────────────────────────────────

describe('PropertyAssets — empty state', () => {
  it('renders empty state when no properties exist', () => {
    render(<PropertyAssets />);
    expect(screen.getByText(/No properties yet/)).toBeInTheDocument();
  });

  it('renders empty asset list when property selected but no assets', () => {
    seedProperty();
    render(<PropertyAssets />);
    expect(screen.getByText(/No assets registered yet/)).toBeInTheDocument();
  });
});

describe('PropertyAssets — populated state', () => {
  it('renders asset snapshot tiles', () => {
    seedProperty();
    seedAsset();
    render(<PropertyAssets />);
    expect(screen.getByText('Asset Snapshot')).toBeInTheDocument();
    // 'Excellent' appears in stat tile and condition filter dropdown
    expect(screen.getAllByText('Excellent').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Poor / Critical')).toBeInTheDocument();
  });

  it('renders asset name in list', () => {
    seedProperty();
    seedAsset({ name: 'Dishwasher' });
    render(<PropertyAssets />);
    expect(screen.getByText('Dishwasher')).toBeInTheDocument();
  });

  it('renders condition pill', () => {
    seedProperty();
    seedAsset({ condition: 'Good' });
    render(<PropertyAssets />);
    // 'Good' appears both as stat tile label and as condition pill
    expect(screen.getAllByText('Good').length).toBeGreaterThanOrEqual(1);
  });

  it('renders brand and model', () => {
    seedProperty();
    seedAsset({ brand: 'Samsung', model: 'DW60R7040' });
    render(<PropertyAssets />);
    expect(screen.getByText(/Samsung/)).toBeInTheDocument();
  });

  it('shows filter section with search input', () => {
    seedProperty();
    seedAsset();
    render(<PropertyAssets />);
    expect(screen.getByPlaceholderText('Search assets…')).toBeInTheDocument();
  });

  it('groups assets by type', () => {
    seedProperty();
    seedAsset({ id: 'a1', name: 'Heat Pump', type: 'HVAC' });
    seedAsset({ id: 'a2', name: 'Oven', type: 'Appliance' });
    render(<PropertyAssets />);
    // Type names appear in both group headers and filter dropdown
    expect(screen.getAllByText('HVAC').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Appliance').length).toBeGreaterThanOrEqual(2);
  });
});

describe('PropertyAssets — add asset', () => {
  it('opens add modal and saves a new asset', async () => {
    seedProperty();
    const user = userEvent.setup();
    render(<PropertyAssets />);

    // "Add Asset" appears in section header and modal submit
    const addBtns = screen.getAllByText('Add Asset');
    await user.click(addBtns[0]);
    expect(screen.getByRole('heading', { name: 'Add Asset / Appliance' })).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/Lounge Heat Pump/);
    await user.type(nameInput, 'New Appliance');

    // Select property
    const propSelect = Array.from(document.querySelectorAll('select.input')).find(s =>
      Array.from(s.options).some(o => o.text === 'Test House')
    );
    if (propSelect) await user.selectOptions(propSelect, PROP_ID);

    // Fill expected lifespan (required by validation)
    const lifespanInput = screen.getByPlaceholderText('e.g. 15');
    await user.type(lifespanInput, '10');

    const submitBtns = screen.getAllByRole('button', { name: 'Add Asset' });
    await user.click(submitBtns[submitBtns.length - 1]);

    const { propertyAssets } = usePropertyStore.getState();
    expect(propertyAssets.some(a => a.name === 'New Appliance')).toBe(true);
  });
});

describe('PropertyAssets — edit asset', () => {
  it('opens edit modal with existing data', async () => {
    seedProperty();
    seedAsset({ name: 'Old Heat Pump' });
    const user = userEvent.setup();
    render(<PropertyAssets />);

    await user.click(screen.getByLabelText('Edit asset'));
    expect(screen.getByRole('heading', { name: 'Edit Asset' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Old Heat Pump')).toBeInTheDocument();
  });
});

describe('PropertyAssets — delete asset', () => {
  it('removes asset from store when confirmed', async () => {
    seedProperty();
    seedAsset({ id: 'asset-del' });
    const user = userEvent.setup();
    render(<PropertyAssets />);

    await user.click(screen.getByLabelText('Delete asset'));

    // Confirm in the ConfirmDialog
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(usePropertyStore.getState().propertyAssets.find(a => a.id === 'asset-del')).toBeUndefined();
  });
});

describe('PropertyAssets — filtering', () => {
  it('filters assets by search text', async () => {
    seedProperty();
    seedAsset({ id: 'a1', name: 'Heat Pump' });
    seedAsset({ id: 'a2', name: 'Dishwasher' });
    const user = userEvent.setup();
    render(<PropertyAssets />);

    await user.type(screen.getByPlaceholderText('Search assets…'), 'Dish');

    expect(screen.getByText('Dishwasher')).toBeInTheDocument();
    expect(screen.queryByText('Heat Pump')).not.toBeInTheDocument();
  });
});
