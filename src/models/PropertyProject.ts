/**
 * @fileoverview Domain model for a property improvement project.
 */

export const PROJECT_STATUSES = ['Idea', 'Planning', 'In Progress', 'On Hold', 'Completed', 'Cancelled'] as const;
export type ProjectStatus = typeof PROJECT_STATUSES[number];

export const PROJECT_PRIORITIES = ['Urgent', 'High', 'Medium', 'Low'] as const;
export type ProjectPriority = typeof PROJECT_PRIORITIES[number];

/** Display colours keyed by status. */
export const STATUS_DPILL = {
  'Idea':        '',
  'Planning':    'teal',
  'In Progress': 'amber',
  'On Hold':     'purple',
  'Completed':   'green',
  'Cancelled':   '',
} as const;

export interface ProjectNote {
  id: string;
  date: string;
  text: string;
}

export interface PropertyProject {
  id: string;
  propertyId: string;
  title: string;
  description: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  targetStart: string;
  targetEnd: string;
  actualCompletion: string;
  areas: string[];
  taskIds: string[];
  notes: ProjectNote[];
  createdAt: string;
}

export function createPropertyProject(overrides: any = {}) {
  return {
    id:               '',
    propertyId:       '',
    title:            '',
    description:      '',
    status:           'Planning',
    priority:         'Medium',
    targetStart:      '',
    targetEnd:        '',
    actualCompletion: '',
    areas:            [],
    taskIds:          [],
    notes:            [],
    createdAt:        '',
    ...overrides,
  };
}

export function normalizePropertyProject(raw: any = {}): PropertyProject {
  return createPropertyProject({
    id:               raw.id               ?? '',
    propertyId:       raw.propertyId       ?? '',
    title:            raw.title            ?? '',
    description:      raw.description      ?? '',
    status:           raw.status           ?? 'Planning',
    priority:         raw.priority         ?? 'Medium',
    targetStart:      raw.targetStart      ?? '',
    targetEnd:        raw.targetEnd        ?? '',
    actualCompletion: raw.actualCompletion ?? '',
    areas:            Array.isArray(raw.areas)   ? raw.areas   : [],
    taskIds:          Array.isArray(raw.taskIds) ? raw.taskIds : [],
    notes:            Array.isArray(raw.notes)   ? raw.notes   : [],
    createdAt:        raw.createdAt        ?? '',
  });
}
