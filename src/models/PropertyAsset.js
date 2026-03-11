/**
 * @fileoverview Domain model for a property asset (appliance, fixture, or system).
 *
 * Inconsistencies detected:
 * - `expectedLifespan` is stored as a string (user-entered number of years) but
 *   lifespan-remaining calculations in PropertyAssets.jsx parse it with `+` coercion.
 *   There is no unit label stored — it is always treated as years, but this is
 *   not communicated in the field itself.
 * - `warrantyExpiry` is an ISO date string but the UI input is a date picker that
 *   can produce empty string ''. When empty, the warranty alerts are suppressed
 *   rather than treated as "unknown / no warranty".
 * - `dateInstalled` is an ISO date string used to calculate age, but for older
 *   assets whose install date is unknown, leaving it blank silently suppresses
 *   all age-based alerts.
 * - `areaId` references a PropertyArea; dangling-reference risk if the area is deleted.
 */

/**
 * @typedef {'HVAC'|'Plumbing'|'Electrical'|'Appliance'|'Structural'|'Roofing'|'Exterior'|'Security'|'Other'} AssetType
 * @typedef {'Excellent'|'Good'|'Fair'|'Poor'|'Critical'} AssetCondition
 */

export const ASSET_TYPES = /** @type {const} */ (
  ['HVAC', 'Plumbing', 'Electrical', 'Appliance', 'Structural', 'Roofing', 'Exterior', 'Security', 'Other']
);

export const ASSET_CONDITIONS = /** @type {const} */ (
  ['Excellent', 'Good', 'Fair', 'Poor', 'Critical']
);

/** Pill colour class keyed by condition. */
export const CONDITION_PILL = /** @type {const} */ ({
  Excellent: 'green', Good: 'teal', Fair: 'amber', Poor: 'red', Critical: 'red',
});

/**
 * @typedef {Object} PropertyAsset
 * @property {string}         id               - Unique identifier
 * @property {string}         propertyId       - Parent Property.id
 * @property {string}         name             - Asset name (e.g. 'Mitsubishi Heat Pump')
 * @property {AssetType}      type             - Asset category
 * @property {string}         areaId           - PropertyArea.id where asset is located (or '')
 * @property {string}         brand            - Manufacturer/brand name
 * @property {string}         model            - Model number / identifier
 * @property {string}         dateInstalled    - ISO date of installation (YYYY-MM-DD), or ''
 * @property {string}         warrantyExpiry   - ISO date warranty expires (YYYY-MM-DD), or ''
 * @property {number|string}  expectedLifespan - Expected lifespan in years (or '')
 * @property {AssetCondition} condition        - Current condition rating
 * @property {string}         notes            - Free-text notes
 * @property {string}         createdAt        - ISO timestamp of record creation
 */

/**
 * Factory — returns a blank PropertyAsset with sensible defaults.
 * @param {Partial<PropertyAsset>} overrides
 * @returns {PropertyAsset}
 */
export function createPropertyAsset(overrides = {}) {
  return {
    id:               '',
    propertyId:       '',
    name:             '',
    type:             'Appliance',
    areaId:           '',
    brand:            '',
    model:            '',
    dateInstalled:    '',
    warrantyExpiry:   '',
    expectedLifespan: '',
    condition:        'Good',
    notes:            '',
    createdAt:        '',
    ...overrides,
  };
}

/**
 * Coerce a raw asset object to the canonical shape.
 * @param {object} raw
 * @returns {PropertyAsset}
 */
export function normalizePropertyAsset(raw = {}) {
  return createPropertyAsset({
    id:               raw.id               ?? '',
    propertyId:       raw.propertyId       ?? '',
    name:             raw.name             ?? '',
    type:             raw.type             ?? 'Appliance',
    areaId:           raw.areaId           ?? '',
    brand:            raw.brand            ?? '',
    model:            raw.model            ?? '',
    dateInstalled:    raw.dateInstalled    ?? '',
    warrantyExpiry:   raw.warrantyExpiry   ?? '',
    expectedLifespan: raw.expectedLifespan ?? '',
    condition:        raw.condition        ?? 'Good',
    notes:            raw.notes            ?? '',
    createdAt:        raw.createdAt        ?? '',
  });
}
