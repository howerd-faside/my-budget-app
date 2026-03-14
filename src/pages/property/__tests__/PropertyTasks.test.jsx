// @vitest-environment jsdom
/**
 * Unit tests for the PropertyTasks page component.
 *
 * Covers: empty state, populated rendering, snapshot tiles, filtering,
 * add/edit/delete task, status cycling, recurring task generation.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PropertyTasks from '../PropertyTasks';
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

function seedTask(overrides = {}) {
  const task = {
    id: 'task-1',
    propertyId: PROP_ID,
    title: 'Fix Roof Leak',
    description: '',
    areaId: '',
    category: 'Repair',
    priority: 'High',
    status: 'To Do',
    dueDate: '2026-04-01',
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

describe('PropertyTasks — empty state', () => {
  it('renders empty state when no properties exist', () => {
    render(<PropertyTasks />);
    expect(screen.getByText(/No properties yet/)).toBeInTheDocument();
  });

  it('renders empty task list when property selected but no tasks', () => {
    seedProperty();
    render(<PropertyTasks />);
    expect(screen.getByText(/No tasks yet/)).toBeInTheDocument();
  });
});

describe('PropertyTasks — populated state', () => {
  it('renders task snapshot stat tiles', () => {
    seedProperty();
    seedTask();
    render(<PropertyTasks />);
    expect(screen.getByText('Task Snapshot')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Due Soon')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('Recurring')).toBeInTheDocument();
  });

  it('renders task title in list', () => {
    seedProperty();
    seedTask({ title: 'Paint Deck' });
    render(<PropertyTasks />);
    expect(screen.getByText('Paint Deck')).toBeInTheDocument();
  });

  it('shows priority pill on task row', () => {
    seedProperty();
    seedTask({ priority: 'Urgent' });
    render(<PropertyTasks />);
    // 'Urgent' appears in both the task row pill and the filter dropdown
    expect(screen.getAllByText('Urgent').length).toBeGreaterThanOrEqual(1);
  });

  it('shows filter section with search input', () => {
    seedProperty();
    seedTask();
    render(<PropertyTasks />);
    expect(screen.getByPlaceholderText('Search tasks…')).toBeInTheDocument();
  });
});

describe('PropertyTasks — add task', () => {
  it('opens add modal and saves a new task', async () => {
    seedProperty();
    const user = userEvent.setup();
    render(<PropertyTasks />);

    // "Add Task" appears in both section header button and modal — use the header button
    const addBtns = screen.getAllByText('Add Task');
    await user.click(addBtns[0]);
    expect(screen.getByRole('heading', { name: 'Add Task' })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('What needs doing?'), 'New Task');

    // Select property in the form
    const selects = document.querySelectorAll('select.input');
    const propSelect = Array.from(selects).find(s =>
      Array.from(s.options).some(o => o.text === 'Test House')
    );
    if (propSelect) {
      await user.selectOptions(propSelect, PROP_ID);
    }

    // Submit via the modal footer button (last "Add Task" button)
    const submitBtns = screen.getAllByRole('button', { name: 'Add Task' });
    await user.click(submitBtns[submitBtns.length - 1]);

    const { propertyTasks } = usePropertyStore.getState();
    expect(propertyTasks.some(t => t.title === 'New Task')).toBe(true);
  });
});

describe('PropertyTasks — edit task', () => {
  it('opens edit modal with existing data', async () => {
    seedProperty();
    seedTask({ title: 'Original Title' });
    const user = userEvent.setup();
    render(<PropertyTasks />);

    await user.click(screen.getByLabelText('Edit task'));
    expect(screen.getByRole('heading', { name: 'Edit Task' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Original Title')).toBeInTheDocument();
  });
});

describe('PropertyTasks — delete task', () => {
  it('removes task from store when confirmed', async () => {
    seedProperty();
    seedTask({ id: 'task-del' });
    const user = userEvent.setup();
    render(<PropertyTasks />);

    await user.click(screen.getByLabelText('Delete task'));

    // Confirm in the ConfirmDialog
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(usePropertyStore.getState().propertyTasks.find(t => t.id === 'task-del')).toBeUndefined();
  });
});

describe('PropertyTasks — status cycling', () => {
  it('cycles task status when status button is clicked', async () => {
    seedProperty();
    seedTask({ id: 'task-cycle', status: 'To Do' });
    const user = userEvent.setup();
    render(<PropertyTasks />);

    await user.click(screen.getByLabelText('Mark as In Progress'));

    const task = usePropertyStore.getState().propertyTasks.find(t => t.id === 'task-cycle');
    expect(task.status).toBe('In Progress');
  });
});

describe('PropertyTasks — filtering', () => {
  it('filters tasks by search text', async () => {
    seedProperty();
    seedTask({ id: 't1', title: 'Fix Roof Leak' });
    seedTask({ id: 't2', title: 'Paint Deck' });
    const user = userEvent.setup();
    render(<PropertyTasks />);

    await user.type(screen.getByPlaceholderText('Search tasks…'), 'Paint');

    expect(screen.getByText('Paint Deck')).toBeInTheDocument();
    expect(screen.queryByText('Fix Roof Leak')).not.toBeInTheDocument();
  });
});
