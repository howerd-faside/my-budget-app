// @vitest-environment jsdom
/**
 * Unit tests for the PropertyProjects page component.
 *
 * Covers: empty state, populated rendering, snapshot tiles, filtering,
 * add/edit/delete project, status cycling, status grouping.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PropertyProjects from '../PropertyProjects';
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

function seedProject(overrides = {}) {
  const proj = {
    id: 'proj-1',
    propertyId: PROP_ID,
    title: 'Bathroom Reno',
    description: '',
    status: 'In Progress',
    priority: 'Medium',
    targetStart: '',
    targetEnd: '',
    actualCompletion: '',
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

describe('PropertyProjects — empty state', () => {
  it('renders empty state when no properties exist', () => {
    render(<PropertyProjects />);
    expect(screen.getByText(/No properties yet/)).toBeInTheDocument();
  });

  it('renders empty project list when property selected but no projects', () => {
    seedProperty();
    render(<PropertyProjects />);
    expect(screen.getByText(/No projects yet/)).toBeInTheDocument();
  });
});

describe('PropertyProjects — populated state', () => {
  it('renders project snapshot tiles', () => {
    seedProperty();
    seedProject();
    render(<PropertyProjects />);
    expect(screen.getByText('Project Snapshot')).toBeInTheDocument();
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1);
  });

  it('renders project title in list', () => {
    seedProperty();
    seedProject({ title: 'Deck Extension' });
    render(<PropertyProjects />);
    expect(screen.getByText('Deck Extension')).toBeInTheDocument();
  });

  it('groups projects by status', () => {
    seedProperty();
    seedProject({ id: 'p1', title: 'Active Proj', status: 'In Progress' });
    seedProject({ id: 'p2', title: 'Done Proj', status: 'Completed' });
    render(<PropertyProjects />);
    expect(screen.getByText('Active Proj')).toBeInTheDocument();
    expect(screen.getByText('Done Proj')).toBeInTheDocument();
  });

  it('shows filter section with search input', () => {
    seedProperty();
    seedProject();
    render(<PropertyProjects />);
    expect(screen.getByPlaceholderText('Search projects…')).toBeInTheDocument();
  });
});

describe('PropertyProjects — add project', () => {
  it('opens add modal and saves a new project', async () => {
    seedProperty();
    const user = userEvent.setup();
    render(<PropertyProjects />);

    // "Add Project" appears in section header button and modal submit
    const addBtns = screen.getAllByText('Add Project');
    await user.click(addBtns[0]);
    expect(screen.getByRole('heading', { name: 'Add Project' })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('e.g. Bathroom Renovation'), 'New Project');

    const submitBtns = screen.getAllByRole('button', { name: 'Add Project' });
    await user.click(submitBtns[submitBtns.length - 1]);

    const { propertyProjects } = usePropertyStore.getState();
    expect(propertyProjects.some(p => p.title === 'New Project')).toBe(true);
  });
});

describe('PropertyProjects — edit project', () => {
  it('opens edit modal with existing data', async () => {
    seedProperty();
    seedProject({ title: 'Original Project' });
    const user = userEvent.setup();
    render(<PropertyProjects />);

    await user.click(screen.getByLabelText('Edit project'));
    expect(screen.getByRole('heading', { name: 'Edit Project' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Original Project')).toBeInTheDocument();
  });
});

describe('PropertyProjects — delete project', () => {
  it('removes project from store when confirmed', async () => {
    seedProperty();
    seedProject({ id: 'proj-del' });
    const user = userEvent.setup();
    render(<PropertyProjects />);

    await user.click(screen.getByLabelText('Delete project'));

    // Confirm in the ConfirmDialog
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(usePropertyStore.getState().propertyProjects.find(p => p.id === 'proj-del')).toBeUndefined();
  });
});

describe('PropertyProjects — status cycling', () => {
  it('advances project status when cycle button is clicked', async () => {
    seedProperty();
    seedProject({ id: 'proj-cycle', status: 'Idea' });
    const user = userEvent.setup();
    render(<PropertyProjects />);

    await user.click(screen.getByLabelText('Advance status'));

    const proj = usePropertyStore.getState().propertyProjects.find(p => p.id === 'proj-cycle');
    expect(proj.status).toBe('Planning');
  });
});

describe('PropertyProjects — filtering', () => {
  it('filters projects by search text', async () => {
    seedProperty();
    seedProject({ id: 'p1', title: 'Bathroom Reno' });
    seedProject({ id: 'p2', title: 'Deck Build' });
    const user = userEvent.setup();
    render(<PropertyProjects />);

    await user.type(screen.getByPlaceholderText('Search projects…'), 'Deck');

    expect(screen.getByText('Deck Build')).toBeInTheDocument();
    expect(screen.queryByText('Bathroom Reno')).not.toBeInTheDocument();
  });
});
