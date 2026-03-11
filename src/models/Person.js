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

/**
 * @typedef {Object} SecondaryIncome
 * @property {string} id        - Unique identifier
 * @property {string} name      - Display label
 * @property {number|string} amount   - Amount per `frequency` (treated as net/post-tax)
 * @property {string} frequency - Payment frequency
 */

/**
 * @typedef {Object} IncomeEvent
 * @property {string}        id          - Unique identifier
 * @property {string}        label       - Event name (e.g. 'Maternity Leave', 'Pay Rise')
 * @property {string}        startDate   - ISO date when the event starts (YYYY-MM-DD)
 * @property {string}        endDate     - ISO date when the event ends, or '' for ongoing
 * @property {number|string} grossAnnual - Override gross annual income during this event
 */

/**
 * @typedef {Object} EmploymentRole
 * @property {string}        id          - Unique identifier
 * @property {string}        employer    - Employer name
 * @property {string}        role        - Job title / role
 * @property {string}        startDate   - ISO date role started (YYYY-MM-DD)
 * @property {string}        endDate     - ISO date role ended, or '' if current
 * @property {number|string} grossAnnual - Gross annual salary for this role
 */

/**
 * @typedef {Object} AssetIncome
 * @property {string}        id        - Unique identifier
 * @property {string}        name      - Display label
 * @property {AssetIncomeType} type    - Income source type
 * @property {number|string} amount    - Amount per `frequency`
 * @property {string}        frequency - Payment frequency
 * @property {string}        notes     - Free-text notes
 */

/**
 * @typedef {Object} Person
 * @property {string}          id                - Unique identifier
 * @property {string}          name              - Full name
 * @property {number|string}   grossAnnual       - Fallback gross annual income (NZD)
 *                                                 Used when no EmploymentRole covers the date.
 * @property {TaxCode}         taxCode           - NZ tax code
 * @property {number}          kiwiSaverRate     - KiwiSaver employee rate (%). 0 = not enrolled.
 * @property {PayFrequency}    payFrequency      - How often this person is paid
 * @property {SecondaryIncome[]} secondaryIncomes  - Additional net income sources
 * @property {IncomeEvent[]}     incomeEvents      - Temporary income overrides (maternity leave, etc.)
 * @property {EmploymentRole[]}  employmentHistory - Chronological employment history
 */

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

/**
 * Coerce a raw person to the canonical shape.
 * Ensures sub-arrays are always present (migration safety).
 * @param {object} raw
 * @returns {Person}
 */
export function normalizePerson(raw = {}) {
  return createPerson({
    id:                raw.id                ?? '',
    name:              raw.name              ?? '',
    grossAnnual:       raw.grossAnnual       ?? '',
    taxCode:           raw.taxCode           ?? 'M',
    kiwiSaverRate:     raw.kiwiSaverRate     ?? 3,
    payFrequency:      raw.payFrequency      ?? 'fortnightly',
    secondaryIncomes:  (raw.secondaryIncomes  ?? []).map(s => createSecondaryIncome(s)),
    incomeEvents:      (raw.incomeEvents      ?? []).map(e => createIncomeEvent(e)),
    employmentHistory: (raw.employmentHistory ?? []).map(r => createEmploymentRole(r)),
  });
}
