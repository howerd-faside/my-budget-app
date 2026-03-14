/**
 * @fileoverview Domain model for a household income earner and their sub-entities.
 *
 * Inconsistencies detected:
 * - `assetIncomes` (rental, dividends, business income) is stored at the top level
 *   of the app state rather than nested under the person it belongs to. This means
 *   the link between an asset income source and a specific person is not enforced
 *   structurally — it relies on the UI convention that only one pool of asset incomes
 *   exists for the whole household.
 * - `SecondaryIncome` amounts are treated as net (post-tax) in all calculations,
 *   but there is no `isTaxed` field to make this intent explicit.
 * - `IncomeEvent.endDate` being empty string means "ongoing" throughout the code
 *   but the field is typed as string, not `string | null`.
 * - `EmploymentRole` was added later than `incomeEvents`; older Person records may
 *   lack `employmentHistory: []` entirely. normalizeEmployee handles this via migrate.
 * - `grossAnnual` on Person is a fallback when no EmploymentRole covers the date;
 *   it is never explicitly removed when employmentHistory is populated, which can
 *   cause subtle inconsistencies if the two diverge.
 *
 * Numeric normalization:
 *   All financial amounts and rates are stored as numbers after normalization.
 *   `create*` factories retain `''` defaults so form inputs bind to empty strings.
 *   `normalize*` functions are the single coercion boundary for storage data.
 */

/**
 * @typedef {'M'|'M SL'|'ME'|'ME SL'|'S'|'SH'|'ST'|'SA'|'CAE'|'EDW'|'NSW'|'WT'} TaxCode
 * @typedef {'weekly'|'fortnightly'|'monthly'|'annual'} PayFrequency
 * @typedef {'rental'|'dividend'|'business'|'trust'|'other'} AssetIncomeType
 */

/** Valid NZ tax codes. */
export const TAX_CODES = /** @type {const} */ (
  ['M', 'M SL', 'ME', 'ME SL', 'S', 'SH', 'ST', 'SA', 'CAE', 'EDW', 'NSW', 'WT']
);

/** Valid KiwiSaver contribution rates (%). 0 = not enrolled. */
export const KIWISAVER_RATES = /** @type {const} */ ([0, 3, 4, 6, 8, 10]);

/** Valid pay frequencies for the person's primary income. */
export const PAY_FREQUENCIES = /** @type {const} */ (
  ['weekly', 'fortnightly', 'monthly', 'annual']
);

/** Valid income frequencies for secondary / asset income. */
export const INCOME_FREQUENCIES = /** @type {const} */ (
  ['weekly', 'fortnightly', 'monthly', 'quarterly', 'annual']
);

/** Valid asset income types. */
export const ASSET_INCOME_TYPES = /** @type {const} */ (
  ['rental', 'dividend', 'business', 'trust', 'other']
);

// ── Private helpers ──────────────────────────────────────────────────────────

/**
 * Parse a numeric value from storage; returns `fallback` (default 0) for
 * empty strings, null, undefined, or non-finite values.
 * @param {*} val
 * @param {number} [fallback=0]
 * @returns {number}
 */
function toNum(val, fallback = 0) {
  const n = parseFloat(val);
  return isFinite(n) ? n : fallback;
}

// ── Typedefs ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SecondaryIncome
 * @property {string} id        - Unique identifier
 * @property {string} name      - Display label
 * @property {number} amount    - Amount per `frequency` (treated as net/post-tax)
 * @property {string} frequency - Payment frequency
 */

/**
 * @typedef {Object} IncomeEvent
 * @property {string} id          - Unique identifier
 * @property {string} label       - Event name (e.g. 'Maternity Leave', 'Pay Rise')
 * @property {string} startDate   - ISO date when the event starts (YYYY-MM-DD)
 * @property {string|null} endDate - ISO date when the event ends, or null for ongoing
 * @property {number} grossAnnual - Override gross annual income during this event
 */

/**
 * @typedef {Object} EmploymentRole
 * @property {string} id          - Unique identifier
 * @property {string} employer    - Employer name
 * @property {string} role        - Job title / role
 * @property {string} startDate   - ISO date role started (YYYY-MM-DD)
 * @property {string|null} endDate - ISO date role ended, or null if current
 * @property {number} grossAnnual - Gross annual salary for this role
 */

/**
 * @typedef {Object} AssetIncome
 * @property {string}          id        - Unique identifier
 * @property {string}          name      - Display label
 * @property {AssetIncomeType} type      - Income source type
 * @property {number}          amount    - Amount per `frequency`
 * @property {string}          frequency - Payment frequency
 * @property {string}          notes     - Free-text notes
 */

/**
 * @typedef {Object} Person
 * @property {string}          id                - Unique identifier
 * @property {string}          name              - Full name
 * @property {number}          grossAnnual       - Fallback gross annual income (NZD).
 *                                                 Used when no EmploymentRole covers the date.
 * @property {TaxCode}         taxCode           - NZ tax code
 * @property {number}          kiwiSaverRate     - KiwiSaver employee rate (%). 0 = not enrolled.
 * @property {PayFrequency}    payFrequency      - How often this person is paid
 * @property {SecondaryIncome[]} secondaryIncomes  - Additional net income sources
 * @property {IncomeEvent[]}     incomeEvents      - Temporary income overrides (maternity leave, etc.)
 * @property {EmploymentRole[]}  employmentHistory - Chronological employment history
 */

// ── Factories (form defaults — numeric fields intentionally '' for input binding) ──

/** @returns {SecondaryIncome} */
export function createSecondaryIncome(overrides = {}) {
  return { id: '', name: '', amount: '', frequency: 'monthly', ...overrides };
}

/** @returns {IncomeEvent} */
export function createIncomeEvent(overrides = {}) {
  return { id: '', label: '', startDate: '', endDate: '', grossAnnual: '', ...overrides };
}

/** @returns {EmploymentRole} */
export function createEmploymentRole(overrides = {}) {
  return { id: '', employer: '', role: '', startDate: '', endDate: '', grossAnnual: '', ...overrides };
}

/** @returns {AssetIncome} */
export function createAssetIncome(overrides = {}) {
  return { id: '', name: '', type: 'rental', amount: '', frequency: 'monthly', notes: '', ...overrides };
}

/**
 * Factory — returns a blank Person with sensible defaults.
 * @param {Partial<Person>} overrides
 * @returns {Person}
 */
export function createPerson(overrides = {}) {
  return {
    id:                '',
    name:              '',
    grossAnnual:       '',
    taxCode:           'M',
    kiwiSaverRate:     3,
    payFrequency:      'fortnightly',
    secondaryIncomes:  [],
    incomeEvents:      [],
    employmentHistory: [],
    ...overrides,
  };
}

// ── Normalizers (storage boundary — all numeric fields coerced to number) ────

/**
 * Coerce a raw secondary income to the canonical shape.
 * @param {object} raw
 * @returns {SecondaryIncome}
 */
export function normalizeSecondaryIncome(raw = {}) {
  return createSecondaryIncome({
    id:        raw.id        ?? '',
    name:      raw.name      ?? '',
    amount:    toNum(raw.amount),
    frequency: raw.frequency ?? 'monthly',
  });
}

/**
 * Coerce a raw income event to the canonical shape.
 * @param {object} raw
 * @returns {IncomeEvent}
 */
export function normalizeIncomeEvent(raw = {}) {
  return createIncomeEvent({
    id:          raw.id          ?? '',
    label:       raw.label       ?? '',
    startDate:   raw.startDate   ?? '',
    endDate:     raw.endDate     || null,
    grossAnnual: toNum(raw.grossAnnual),
  });
}

/**
 * Coerce a raw employment role to the canonical shape.
 * @param {object} raw
 * @returns {EmploymentRole}
 */
export function normalizeEmploymentRole(raw = {}) {
  return createEmploymentRole({
    id:          raw.id          ?? '',
    employer:    raw.employer    ?? '',
    role:        raw.role        ?? '',
    startDate:   raw.startDate   ?? '',
    endDate:     raw.endDate     || null,
    grossAnnual: toNum(raw.grossAnnual),
  });
}

/**
 * Coerce a raw asset income to the canonical shape.
 * @param {object} raw
 * @returns {AssetIncome}
 */
export function normalizeAssetIncome(raw = {}) {
  return createAssetIncome({
    id:        raw.id        ?? '',
    name:      raw.name      ?? '',
    type:      raw.type      ?? 'rental',
    amount:    toNum(raw.amount),
    frequency: raw.frequency ?? 'monthly',
    notes:     raw.notes     ?? '',
  });
}

/**
 * Coerce a raw person to the canonical shape.
 * Ensures sub-arrays are always present and all numeric fields are numbers.
 * @param {object} raw
 * @returns {Person}
 */
export function normalizePerson(raw = {}) {
  return createPerson({
    id:           raw.id       ?? '',
    name:         raw.name     ?? '',
    grossAnnual:  toNum(raw.grossAnnual),
    taxCode:      raw.taxCode  ?? 'M',
    // kiwiSaverRate: coerce to number; preserve 0 (not enrolled); default to 3 if absent.
    kiwiSaverRate:     raw.kiwiSaverRate != null ? toNum(raw.kiwiSaverRate) : 3,
    payFrequency:      raw.payFrequency ?? 'fortnightly',
    secondaryIncomes:  (raw.secondaryIncomes  ?? []).map(normalizeSecondaryIncome),
    incomeEvents:      (raw.incomeEvents      ?? []).map(normalizeIncomeEvent),
    employmentHistory: (raw.employmentHistory ?? []).map(normalizeEmploymentRole),
  });
}
