/**
 * @fileoverview Domain model for a property improvement project.
 *
 * Inconsistencies detected:
 * - `areas` is an array of PropertyArea.id strings (not full area objects);
 *   deleting an area leaves dangling IDs in this array.
 * - `taskIds` references PropertyTask.id values with no cleanup on task deletion.
 * - `notes` is an array of {id, date, text} sub-objects matching the same shape
 *   used by PropertyTask notes.
 * - `actualCompletion` is only meaningful when status === 'Completed'; there is
 *   no enforcement that it is set when the project is marked complete.
 */

/**
 * @typedef {'Idea'|'Planning'|'In Progress'|'On Hold'|'Completed'|'Cancelled'} ProjectStatus
 * @typedef {'Urgent'|'High'|'Medium'|'Low'} ProjectPriority
 */

export const PROJECT_STATUSES = /** @type {const} */ (
  ['Idea', 'Planning', 'In Progress', 'On Hold', 'Completed', 'Cancelled']
);

export const PROJECT_PRIORITIES = /** @type {const} */ (['Urgent', 'High', 'Medium', 'Low']);

/** Display colours keyed by status. */
export const STATUS_DPILL = /** @type {const} */ ({
  'Idea':        '',
  'Planning':    'teal',
  'In Progress': 'amber',
  'On Hold':     'purple',
  'Completed':   'green',
  'Cancelled':   '',
});

/**
 * @typedef {Object} ProjectNote
 * @property {string} id   - Unique identifier
 * @property {string} date - ISO date (YYYY-MM-DD)
 * @property {string} text - Note content
 */

/**
 * @typedef {Object} PropertyProject
 * @property {string}          id               - Unique identifier
 * @property {string}          propertyId       - Parent Property.id
 * @property {string}          title            - Short project title
 * @property {string}          description      - Detailed description
 * @property {ProjectStatus}   status           - Current status
 * @property {ProjectPriority} priority         - Priority level
 * @property {string}          targetStart      - ISO date target start (YYYY-MM-DD), or ''
 * @property {string}          targetEnd        - ISO date target end (YYYY-MM-DD), or ''
 * @property {string}          actualCompletion - ISO date of actual completion, or ''
 * @property {string[]}        areas            - PropertyArea.id values this project covers
 * @property {string[]}        taskIds          - PropertyTask.id values linked to this project
 * @property {ProjectNote[]}   notes            - Chronological notes log
 * @property {string}          createdAt        - ISO timestamp of record creation
 */

/**
 * Factory — returns a blank PropertyProject with sensible defaults.
 * @param {Partial<PropertyProject>} overrides
 * @returns {PropertyProject}
 */
export function createPropertyProject(overrides = {}) {
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

/**
 * Coerce a raw (possibly legacy) project object to the canonical shape.
 * @param {object} raw
 * @returns {PropertyProject}
 */
export function normalizePropertyProject(raw = {}) {
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
