/**
 * @fileoverview Domain model for a maintenance/improvement task on a property.
 *
 * Inconsistencies detected:
 * - `notes` is an array of `{id, date, text}` sub-objects, but the field is
 *   typed as `any[]` in older code and initialised to `[]`; older task records
 *   from before the notes log was introduced may have `notes: []` but that is
 *   fine as it is the empty case.
 * - `recurring` is `null` for non-recurring tasks or `{interval, unit}` for
 *   recurring ones. There is no maximum interval validation; a user could enter
 *   a very large interval without error.
 * - `effort` is a free-pick from EFFORTS but is stored as a string, so it is
 *   not validated against the enum on load.
 * - `areaId` references a PropertyArea within the same property; no referential-
 *   integrity check — deleting an area leaves tasks with dangling areaId values.
 */

/**
 * @typedef {'Repair'|'Maintenance'|'Improvement'|'Inspection'|'Cleaning'|'Compliance'|'General'} TaskCategory
 * @typedef {'Urgent'|'High'|'Medium'|'Low'} TaskPriority
 * @typedef {'To Do'|'In Progress'|'Waiting'|'Done'|'Cancelled'} TaskStatus
 * @typedef {'Small'|'Medium'|'Large'|'Multi-Day'} TaskEffort
 * @typedef {'days'|'weeks'|'fortnights'|'months'|'years'} RecurUnit
 */

export const TASK_CATEGORIES = /** @type {const} */ (
  ['Repair', 'Maintenance', 'Improvement', 'Inspection', 'Cleaning', 'Compliance', 'General']
);

export const TASK_PRIORITIES = /** @type {const} */ (['Urgent', 'High', 'Medium', 'Low']);

export const TASK_STATUSES = /** @type {const} */ (
  ['To Do', 'In Progress', 'Waiting', 'Done', 'Cancelled']
);

export const TASK_EFFORTS = /** @type {const} */ (['Small', 'Medium', 'Large', 'Multi-Day']);

export const RECUR_UNITS = /** @type {const} */ (
  ['days', 'weeks', 'fortnights', 'months', 'years']
);

/** Pill colour class keyed by priority. */
export const PRIORITY_PILL = /** @type {const} */ ({
  Urgent: 'red', High: 'amber', Medium: 'teal', Low: '',
});

/** Next status in the cycle when clicking the status badge. */
export const STATUS_NEXT = /** @type {const} */ ({
  'To Do': 'In Progress', 'In Progress': 'Waiting',
  'Waiting': 'Done', 'Done': 'To Do', 'Cancelled': 'To Do',
});

/**
 * @typedef {Object} TaskNote
 * @property {string} id   - Unique identifier
 * @property {string} date - ISO date (YYYY-MM-DD)
 * @property {string} text - Note content
 */

/**
 * @typedef {Object} RecurringConfig
 * @property {number}    interval - Numeric interval (e.g. 3)
 * @property {RecurUnit} unit     - Time unit (e.g. 'months')
 */

/**
 * @typedef {Object} PropertyTask
 * @property {string}              id          - Unique identifier
 * @property {string}              propertyId  - Parent Property.id
 * @property {string}              title       - Short task title
 * @property {string}              description - Detailed description
 * @property {string}              areaId      - PropertyArea.id within the property (or '')
 * @property {TaskCategory}        category    - Task category
 * @property {TaskPriority}        priority    - Priority level
 * @property {TaskStatus}          status      - Current status
 * @property {string}              dueDate     - ISO date (YYYY-MM-DD), or ''
 * @property {TaskEffort}          effort      - Effort estimate
 * @property {TaskNote[]}          notes       - Chronological notes log
 * @property {RecurringConfig|null} recurring  - Recurrence settings, or null if not recurring
 * @property {string}              createdAt   - ISO timestamp of record creation
 */

/**
 * Factory — returns a blank PropertyTask with sensible defaults.
 * @param {Partial<PropertyTask>} overrides
 * @returns {PropertyTask}
 */
export function createPropertyTask(overrides = {}) {
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

/**
 * Coerce a raw task object to the canonical shape.
 * @param {object} raw
 * @returns {PropertyTask}
 */
export function normalizePropertyTask(raw = {}) {
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
