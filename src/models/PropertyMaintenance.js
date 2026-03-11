/**
 * @fileoverview Domain model for a maintenance log entry on a property.
 *
 * Inconsistencies detected:
 * - `performedBy` stores a free-text value OR one of the PERFORMED_BY enum values.
 *   When the user selects 'Other', they type into `performedByCustom`. However,
 *   the display logic in PropertyMaintenance.jsx uses `performedBy` for display
 *   and falls back to `performedByCustom` only when `performedBy === 'Other'`.
 *   Older records with arbitrary strings will display correctly, but are no longer
 *   selectable from the dropdown (they become orphaned values).
 * - `linkedTaskId` references a PropertyTask but there is no cleanup when a task
 *   is deleted — maintenance records retain a dangling linkedTaskId.
 * - `assetId` references a PropertyAsset; same orphan risk as above.
 * - `cost` is not modelled — there is no way to record how much a maintenance
 *   event cost. This is a gap relative to typical property management tools.
 */

/**
 * @typedef {'Repair'|'Maintenance'|'Improvement'|'Inspection'|'Cleaning'|'Compliance'|'General'} MaintenanceCategory
 */

export const MAINTENANCE_CATEGORIES = /** @type {const} */ (
  ['Repair', 'Maintenance', 'Improvement', 'Inspection', 'Cleaning', 'Compliance', 'General']
);

export const PERFORMED_BY_OPTIONS = /** @type {const} */ (
  ['Self', 'Plumber', 'Electrician', 'Builder', 'Landscaper', 'Roofer', 'Painter', 'HVAC Tech', 'Other']
);

/**
 * @typedef {Object} PropertyMaintenance
 * @property {string}              id                - Unique identifier
 * @property {string}              propertyId        - Parent Property.id
 * @property {string}              date              - ISO date of the maintenance event (YYYY-MM-DD)
 * @property {string}              title             - Short description
 * @property {string}              description       - Detailed notes
 * @property {string}              areaId            - PropertyArea.id (or '')
 * @property {string}              assetId           - PropertyAsset.id if asset-related (or '')
 * @property {MaintenanceCategory} category          - Category
 * @property {string}              performedBy       - Who performed the work (enum value or custom)
 * @property {string}              performedByCustom - Free-text when performedBy === 'Other'
 * @property {string}              linkedTaskId      - PropertyTask.id this resolves (or '')
 * @property {string}              createdAt         - ISO timestamp of record creation
 */

/**
 * Factory — returns a blank PropertyMaintenance record with sensible defaults.
 * @param {Partial<PropertyMaintenance>} overrides
 * @returns {PropertyMaintenance}
 */
export function createPropertyMaintenance(overrides = {}) {
  return {
    id:                '',
    propertyId:        '',
    date:              '',
    title:             '',
    description:       '',
    areaId:            '',
    assetId:           '',
    category:          'Maintenance',
    performedBy:       'Self',
    performedByCustom: '',
    linkedTaskId:      '',
    createdAt:         '',
    ...overrides,
  };
}

/**
 * Coerce a raw maintenance record to the canonical shape.
 * @param {object} raw
 * @returns {PropertyMaintenance}
 */
export function normalizePropertyMaintenance(raw = {}) {
  return createPropertyMaintenance({
    id:                raw.id                ?? '',
    propertyId:        raw.propertyId        ?? '',
    date:              raw.date              ?? '',
    title:             raw.title             ?? '',
    description:       raw.description       ?? '',
    areaId:            raw.areaId            ?? '',
    assetId:           raw.assetId           ?? '',
    category:          raw.category          ?? 'Maintenance',
    performedBy:       raw.performedBy       ?? 'Self',
    performedByCustom: raw.performedByCustom ?? '',
    linkedTaskId:      raw.linkedTaskId      ?? '',
    createdAt:         raw.createdAt         ?? '',
  });
}
