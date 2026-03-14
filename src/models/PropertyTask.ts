/**
 * @fileoverview Domain model for a maintenance/improvement task on a property.
 */

export const TASK_CATEGORIES = ['Repair', 'Maintenance', 'Improvement', 'Inspection', 'Cleaning', 'Compliance', 'General'] as const;
export type TaskCategory = typeof TASK_CATEGORIES[number];

export const TASK_PRIORITIES = ['Urgent', 'High', 'Medium', 'Low'] as const;
export type TaskPriority = typeof TASK_PRIORITIES[number];

export const TASK_STATUSES = ['To Do', 'In Progress', 'Waiting', 'Done', 'Cancelled'] as const;
export type TaskStatus = typeof TASK_STATUSES[number];

export const TASK_EFFORTS = ['Small', 'Medium', 'Large', 'Multi-Day'] as const;
export type TaskEffort = typeof TASK_EFFORTS[number];

export const RECUR_UNITS = ['days', 'weeks', 'fortnights', 'months', 'years'] as const;
export type RecurUnit = typeof RECUR_UNITS[number];

/** Pill colour class keyed by priority. */
export const PRIORITY_PILL = {
  Urgent: 'red', High: 'amber', Medium: 'teal', Low: '',
} as const;

/** Next status in the cycle when clicking the status badge. */
export const STATUS_NEXT = {
  'To Do': 'In Progress', 'In Progress': 'Waiting',
  'Waiting': 'Done', 'Done': 'To Do', 'Cancelled': 'To Do',
} as const;

export interface TaskNote {
  id: string;
  date: string;
  text: string;
}

export interface RecurringConfig {
  interval: number;
  unit: RecurUnit;
}

export interface PropertyTask {
  id: string;
  propertyId: string;
  title: string;
  description: string;
  areaId: string;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  effort: string;
  notes: TaskNote[];
  recurring: RecurringConfig | null;
  createdAt: string;
}

export function createPropertyTask(overrides: any = {}) {
  return {
    id:          '',
    propertyId:  '',
    title:       '',
    description: '',
    areaId:      '',
    category:    'Maintenance',
    priority:    'Medium',
    status:      'To Do',
    dueDate:     '',
    effort:      '',
    notes:       [],
    recurring:   null,
    createdAt:   '',
    ...overrides,
  };
}

export function normalizePropertyTask(raw: any = {}): PropertyTask {
  return createPropertyTask({
    id:          raw.id          ?? '',
    propertyId:  raw.propertyId  ?? '',
    title:       raw.title       ?? '',
    description: raw.description ?? '',
    areaId:      raw.areaId      ?? '',
    category:    raw.category    ?? 'Maintenance',
    priority:    raw.priority    ?? 'Medium',
    status:      raw.status      ?? 'To Do',
    dueDate:     raw.dueDate     ?? '',
    effort:      raw.effort      ?? '',
    notes:       Array.isArray(raw.notes) ? raw.notes : [],
    recurring:   raw.recurring   ?? null,
    createdAt:   raw.createdAt   ?? '',
  });
}
