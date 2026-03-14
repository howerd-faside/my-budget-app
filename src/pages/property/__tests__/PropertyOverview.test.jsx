// @vitest-environment jsdom
/**
 * Unit tests for the PropertyOverview page component.
 *
 * Covers: empty state, no property selected, populated snapshot,
 * task breakdown, upcoming/overdue tasks, recent maintenance,
 * active projects, asset alerts.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PropertyOverview from '../PropertyOverview';
import { usePropertyStore } from '../../../store/propertyStore';
import { NavigationProvider } from '../../../contexts/NavigationContext';

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

function seedTask(overrides = {}) {
  const task = {
    id: 'task-1',
    propertyId: PROP_ID,
    title: 'Fix Roof',
    category: 'Repair',
    priority: 'High',
    status: 'To Do',
    dueDate: '2026-03-10',
    effort: '',
    notes: [],
    recurring: null,
    createdAt: '2026-03-01',
    ...overrides,
  };
  const current = usePropertyStore.getState().propertyTasks;
  usePropertyStore.setState({ propertyTasks: [...current, task] });
  return task;
}

function seedMaintenance(overrides = {}) {
  const rec = {
    id: 'maint-1',
    propertyId: PROP_ID,
    date: '2026-03-12',
    title: 'Gutter Clean',
    category: 'Maintenance',
    performedBy: 'Self',
    performedByCustom: '',
    ...overrides,
  };
  const current = usePropertyStore.getState().propertyMaintenance;
  usePropertyStore.setState({ propertyMaintenance: [...current, rec] });
  return rec;
}

function seedProject(overrides = {}) {
  const proj = {
    id: 'proj-1',
    propertyId: PROP_ID,
    title: 'Bathroom Reno',
    status: 'In Progress',
    priority: 'Medium',
    targetEnd: '2026-06-01',
    areas: [],
    taskIds: [],
    notes: [],
    createdAt: '2026-02-01',
    ...overrides,
  };
  const current = usePropertyStore.getState().propertyProjects;
  usePropertyStore.setState({ propertyProjects: [...current, proj] });
  return proj;
}

function seedAsset(overrides = {}) {
  const asset = {
    id: 'asset-1',
    propertyId: PROP_ID,
    name: 'Heat Pump',
    type: 'HVAC',
    condition: 'Poor',
    areaId: '',
    brand: '',
    model: '',
    dateInstalled: '',
    warrantyExpiry: '',
    expectedLifespan: '',
    notes: '',
    createdAt: '2026-01-01',
    ...overrides,
  };
  const current = usePropertyStore.getState().propertyAssets;
  usePropertyStore.setState({ propertyAssets: [...current, asset] });
  return asset;
}

function renderOverview() {
  return render(
    <NavigationProvider value={() => {}}>
      <PropertyOverview />
    </NavigationProvider>
  );
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

describe('PropertyOverview — empty state', () => {
  it('renders empty state when no properties exist', () => {
    renderOverview();
    expect(screen.getByText(/No properties yet/)).toBeInTheDocument();
  });

  it('renders select-property prompt when properties exist but none selected', () => {
    usePropertyStore.setState({
      properties: [{ id: 'p1', name: 'House', areas: [] }],
      selectedPropertyId: null,
    });
    renderOverview();
    expect(screen.getByText(/Select a property above/)).toBeInTheDocument();
  });
});

describe('PropertyOverview — populated state', () => {
  it('renders property snapshot stat tiles', () => {
    seedProperty();
    renderOverview();
    expect(screen.getByText('Property Snapshot')).toBeInTheDocument();
    expect(screen.getByText('Open Tasks')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getAllByText('Active Projects').length).toBeGreaterThanOrEqual(1);
  });

  it('renders task breakdown section', () => {
    seedProperty();
    seedTask({ priority: 'High' });
    renderOverview();
    expect(screen.getByText('Task Breakdown')).toBeInTheDocument();
  });

  it('shows "all clear" when no open tasks', () => {
    seedProperty();
    renderOverview();
    expect(screen.getByText(/No open tasks/)).toBeInTheDocument();
  });

  it('shows upcoming tasks section', () => {
    seedProperty();
    seedTask({ title: 'Upcoming Work', dueDate: '2026-03-20', status: 'To Do' });
    renderOverview();
    expect(screen.getByText('Upcoming Work')).toBeInTheDocument();
  });

  it('shows recent maintenance records', () => {
    seedProperty();
    seedMaintenance({ title: 'Painted Fence' });
    renderOverview();
    expect(screen.getByText('Painted Fence')).toBeInTheDocument();
  });

  it('shows "no maintenance records" when empty', () => {
    seedProperty();
    renderOverview();
    expect(screen.getByText(/No maintenance records yet/)).toBeInTheDocument();
  });

  it('shows active projects', () => {
    seedProperty();
    seedProject({ title: 'Kitchen Upgrade' });
    renderOverview();
    expect(screen.getByText('Kitchen Upgrade')).toBeInTheDocument();
  });

  it('shows "no active projects" when empty', () => {
    seedProperty();
    renderOverview();
    expect(screen.getByText(/No active projects/)).toBeInTheDocument();
  });

  it('shows asset alerts for poor condition assets', () => {
    seedProperty();
    seedAsset({ name: 'Old Boiler', condition: 'Poor' });
    renderOverview();
    expect(screen.getByText('Old Boiler')).toBeInTheDocument();
    expect(screen.getByText('Poor condition')).toBeInTheDocument();
  });
});
