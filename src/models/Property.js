/**
 * @fileoverview Domain model for a real-estate property and its embedded area records.
 *
 * Inconsistencies detected:
 * - `valuation` is a nullable sub-object added by the web lookup feature
 *   (`{ rv, landValue, improvementsValue, valuationDate, estimatedValue, fetchedAt }`),
 *   but it is not present in older property records (they simply lack the key).
 *   normalizeProperty sets it to null when absent.
 * - `areas` items use an `id`-based reference system, but the `group` field only
 *   constrains to four string values — there is no validation that a saved area's
 *   group matches AREA_GROUPS.
 * - `insulation` is a nested object with three sub-fields. Early property records
 *   created before insulation was added may lack the sub-object entirely.
 */

/**
 * @typedef {'Primary Home'|'Rental'|'Bach/Holiday'|'Investment'|'Land/Section'|'Other'} PropertyType
 * @typedef {'Interior'|'Exterior'|'Grounds'|'Other'} AreaGroup
 * @typedef {'yes'|'no'|'unknown'} InsulationStatus
 */

export const PROPERTY_TYPES = /** @type {const} */ (
  ['Primary Home', 'Rental', 'Bach/Holiday', 'Investment', 'Land/Section', 'Other']
);

export const CONSTRUCTION_TYPES = /** @type {const} */ (
  ['', 'Timber Frame', 'Brick and Tile', 'Concrete Block', 'Steel Frame', 'Other']
);

export const ROOF_TYPES = /** @type {const} */ (
  ['', 'Iron/Colorsteel', 'Tile', 'Concrete Tile', 'Membrane', 'Shingle', 'Other']
);

export const CLADDING_TYPES = /** @type {const} */ (
  ['', 'Weatherboard', 'Brick Veneer', 'Stucco', 'Fibre Cement', 'Aluminium', 'Stone', 'Other']
);

export const HEATING_TYPES = /** @type {const} */ (
  ['', 'Heat pump', 'Gas central', 'Wood burner', 'Underfloor', 'Panel heaters', 'Multi', 'None']
);

export const WATER_SUPPLY_OPTIONS = /** @type {const} */ (
  ['', 'Mains', 'Tank', 'Bore', 'Mains + Tank']
);

export const WASTEWATER_OPTIONS = /** @type {const} */ (
  ['', 'Mains sewer', 'Septic']
);

export const INSULATION_OPTIONS = /** @type {const} */ (['yes', 'no', 'unknown']);

export const AREA_GROUPS = /** @type {const} */ (['Interior', 'Exterior', 'Grounds', 'Other']);

/**
 * @typedef {Object} PropertyArea
 * @property {string}     id    - Unique identifier
 * @property {string}     name  - Area name (e.g. 'Kitchen', 'Roof')
 * @property {AreaGroup}  group - Grouping for display ('Interior' | 'Exterior' | 'Grounds' | 'Other')
 */

/**
 * @typedef {Object} PropertyValuation
 * @property {number|string} rv                  - Rateable value (NZD)
 * @property {number|string} landValue           - Land component of RV (NZD)
 * @property {number|string} improvementsValue   - Improvements component of RV (NZD)
 * @property {string}        valuationDate        - Date of official valuation
 * @property {number|string} estimatedValue       - Market estimate from web lookup (NZD)
 * @property {string}        fetchedAt            - ISO timestamp of last web lookup
 */

/**
 * @typedef {Object} Property
 * @property {string}            id               - Unique identifier
 * @property {string}            name             - Display name / nickname
 * @property {PropertyType}      type             - Property type
 * @property {string}            address          - Street address
 * @property {number|string}     landArea         - Land area (m²)
 * @property {number|string}     floorArea        - Floor area (m²)
 * @property {number|string}     bedrooms         - Number of bedrooms
 * @property {number|string}     bathrooms        - Number of bathrooms
 * @property {number|string}     yearBuilt        - Year of construction
 * @property {string}            constructionType - Frame construction type
 * @property {string}            roofType         - Roof material type
 * @property {string}            cladding         - Exterior cladding type
 * @property {{ceiling:InsulationStatus, underfloor:InsulationStatus, walls:InsulationStatus}} insulation
 * @property {string}            heating          - Primary heating type
 * @property {string}            waterSupply      - Water supply type
 * @property {string}            wastewater       - Wastewater disposal type
 * @property {string}            notes            - Free-text notes
 * @property {PropertyArea[]}    areas            - Named areas within the property
 * @property {PropertyValuation|null} valuation   - Most recent valuation data (null if not fetched)
 */

/** @returns {PropertyArea} */
export function createPropertyArea(overrides = {}) {
  return { id: '', name: '', group: 'Interior', ...overrides };
}

/**
 * Factory — returns a blank Property with sensible defaults.
 * @param {Partial<Property>} overrides
 * @returns {Property}
 */
export function createProperty(overrides = {}) {
  return {
    id:               '',
    name:             '',
    type:             'Primary Home',
    address:          '',
    landArea:         '',
    floorArea:        '',
    bedrooms:         '',
    bathrooms:        '',
    yearBuilt:        '',
    constructionType: '',
    roofType:         '',
    cladding:         '',
    insulation:       { ceiling: 'unknown', underfloor: 'unknown', walls: 'unknown' },
    heating:          '',
    waterSupply:      '',
    wastewater:       '',
    notes:            '',
    areas:            [],
    valuation:        null,
    ...overrides,
  };
}

/**
 * Coerce a raw property object to the canonical shape.
 * @param {object} raw
 * @returns {Property}
 */
export function normalizeProperty(raw = {}) {
  const ins = raw.insulation ?? {};
  return createProperty({
    id:               raw.id               ?? '',
    name:             raw.name             ?? '',
    type:             raw.type             ?? 'Primary Home',
    address:          raw.address          ?? '',
    landArea:         raw.landArea         ?? '',
    floorArea:        raw.floorArea        ?? '',
    bedrooms:         raw.bedrooms         ?? '',
    bathrooms:        raw.bathrooms        ?? '',
    yearBuilt:        raw.yearBuilt        ?? '',
    constructionType: raw.constructionType ?? '',
    roofType:         raw.roofType         ?? '',
    cladding:         raw.cladding         ?? '',
    insulation: {
      ceiling:    ins.ceiling    ?? 'unknown',
      underfloor: ins.underfloor ?? 'unknown',
      walls:      ins.walls      ?? 'unknown',
    },
    heating:     raw.heating     ?? '',
    waterSupply: raw.waterSupply ?? '',
    wastewater:  raw.wastewater  ?? '',
    notes:       raw.notes       ?? '',
    areas:       (raw.areas ?? []).map(a => createPropertyArea(a)),
    valuation:   raw.valuation   ?? null,
  });
}
