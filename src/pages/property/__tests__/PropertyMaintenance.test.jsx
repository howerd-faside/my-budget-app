// @vitest-environment jsdom
/**
 * Unit tests for the PropertyMaintenance page component.
 *
 * Covers: empty state, populated rendering, snapshot tiles, filtering,
 * add/edit/delete records, month grouping.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PropertyMaintenance from '../PropertyMaintenance';
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

function seedMaintenance(overrides = {}) {
  const rec = {
    id: 'maint-1',
    propertyId: PROP_ID,
    date: '2026-03-10',
    title: 'Gutter Clean',
    description: '',
    areaId: '',
    assetId: '',
    category: 'Maintenance',
    performedBy: 'Self',
    performedByCustom: '',
    linkedTaskId: '',
    createdAt: '2026-03-10',
    ...overrides,
  };
  const current = usePropertyStore.getState().propertyMaintenance;
  usePropertyStore.setState({ propertyMaintenance: [...current, rec] });
  return rec;
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

describe('PropertyMaintenance — empty state', () => {
  it('renders empty state when no properties exist', () => {
    render(<PropertyMaintenance />);
    expect(screen.getByText(/No properties yet/)).toBeInTheDocument();
  });

  it('renders empty log when property selected but no records', () => {
    seedProperty();
    render(<PropertyMaintenance />);
    expect(screen.getByText(/No maintenance records yet/)).toBeInTheDocument();
  });
});

describe('PropertyMaintenance — populated state', () => {
  it('renders maintenance snapshot tiles', () => {
    seedProperty();
    seedMaintenance();
    render(<PropertyMaintenance />);
    expect(screen.getByText('Maintenance Snapshot')).toBeInTheDocument();
    expect(screen.getByText('Total Records')).toBeInTheDocument();
    expect(screen.getByText('Last 30 Days')).toBeInTheDocument();
    expect(screen.getByText('This Month')).toBeInTheDocument();
  });

  it('renders maintenance record title', () => {
    seedProperty();
    seedMaintenance({ title: 'Roof Repair Work' });
    render(<PropertyMaintenance />);
    expect(screen.getByText('Roof Repair Work')).toBeInTheDocument();
  });

  it('renders month group header', () => {
    seedProperty();
    seedMaintenance({ date: '2026-03-10' });
    render(<PropertyMaintenance />);
    expect(screen.getByText('March 2026')).toBeInTheDocument();
  });

  it('renders filter section with search input', () => {
    seedProperty();
    seedMaintenance();
    render(<PropertyMaintenance />);
    expect(screen.getByPlaceholderText('Search title or description…')).toBeInTheDocument();
  });
});

describe('PropertyMaintenance — add record', () => {
  it('opens add modal and saves a new record', async () => {
    seedProperty();
    const user = userEvent.setup();
    render(<PropertyMaintenance />);

    // "Log Work" appears in both section header and empty-state action
    const logBtns = screen.getAllByText('Log Work');
    await user.click(logBtns[0]);
    expect(screen.getByRole('heading', { name: 'Log Maintenance Work' })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('What was done?'), 'Fixed Tap');

    await user.click(screen.getByRole('button', { name: 'Log Record' }));

    const { propertyMaintenance } = usePropertyStore.getState();
    expect(propertyMaintenance.some(r => r.title === 'Fixed Tap')).toBe(true);
  });
});

describe('PropertyMaintenance — edit record', () => {
  it('opens edit modal with existing data', async () => {
    seedProperty();
    seedMaintenance({ title: 'Original Work' });
    const user = userEvent.setup();
    render(<PropertyMaintenance />);

    await user.click(screen.getByLabelText('Edit maintenance record'));
    expect(screen.getByRole('heading', { name: 'Edit Record' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Original Work')).toBeInTheDocument();
  });
});

describe('PropertyMaintenance — delete record', () => {
  it('removes record from store when confirmed', async () => {
    seedProperty();
    seedMaintenance({ id: 'maint-del' });
    const user = userEvent.setup();
    render(<PropertyMaintenance />);

    await user.click(screen.getByLabelText('Delete maintenance record'));

    // Confirm in the ConfirmDialog
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(usePropertyStore.getState().propertyMaintenance.find(r => r.id === 'maint-del')).toBeUndefined();
  });
});

describe('PropertyMaintenance — filtering', () => {
  it('filters records by search text', async () => {
    seedProperty();
    seedMaintenance({ id: 'm1', title: 'Gutter Clean' });
    seedMaintenance({ id: 'm2', title: 'Roof Patch' });
    const user = userEvent.setup();
    render(<PropertyMaintenance />);

    await user.type(screen.getByPlaceholderText('Search title or description…'), 'Roof');

    expect(screen.getByText('Roof Patch')).toBeInTheDocument();
    expect(screen.queryByText('Gutter Clean')).not.toBeInTheDocument();
  });
});
