/**
 * @fileoverview Domain model for recurring expenses and embedded loan facilities.
 *
 * Inconsistencies detected:
 * - `history: []` field is present in the EMPTY template and therefore persisted
 *   to localStorage, but is never written to or read from anywhere in the UI.
 *   It appears to be dead data from an earlier design. Field is kept for
 *   backward compatibility but marked as legacy below.
 * - `startDate` is backfilled to '2025-11-10' in store.jsx migrate() for expenses
 *   created before the field was introduced, rather than using the actual creation
 *   date. This means pre-migration expenses show an incorrect effective start date.
 * - `Facility` objects have optional `frequency` and `amount` fields (for repayment
 *   amount), but older facilities may be missing these entirely. normalizeExpense
 *   backfills them to safe defaults.
 * - `forPerson` links to a Person.id but there is no referential-integrity check;
 *   deleted people leave dangling forPerson values.
 */

/**
 * @typedef {'standard'|'loan'} ExpenseType
 * @typedef {'fixed'|'variable'} ExpenseSubtype
 * @typedef {'weekly'|'fortnightly'|'monthly'|'quarterly'|'annual'} Frequency
 * @typedef {'Direct Debit'|'Credit Card'|'Bank Transfer'|'Auto-Pay'|'Cash'} PaymentMethod
 * @typedef {'fixed'|'floating'|'revolving'} RateType
 * @typedef {'P&I'|'IO'} RepaymentType
 */

/** Valid payment frequencies. */
export const FREQUENCIES = /** @type {const} */ (
  ['weekly', 'fortnightly', 'monthly', 'quarterly', 'annual']
);

/** Valid payment method labels. */
export const PAYMENT_METHODS = /** @type {const} */ (
  ['Direct Debit', 'Credit Card', 'Bank Transfer', 'Auto-Pay', 'Cash']
);

/** Valid interest rate type labels for loan facilities. */
export const RATE_TYPES = /** @type {const} */ (['fixed', 'floating', 'revolving']);

/** Valid repayment structure labels for loan facilities. */
export const REPAYMENT_TYPES = /** @type {const} */ (['P&I', 'IO']);

/**
 * @typedef {Object} Facility
 * @property {string}        id              - Unique identifier
 * @property {string}        label           - Display label (e.g. 'Fixed 5yr', 'Revolving')
 * @property {number|string} balance         - Outstanding loan balance in NZD
 * @property {number|string} rate            - Annual interest rate (%)
 * @property {RateType}      rateType        - 'fixed' | 'floating' | 'revolving'
 * @property {RepaymentType} repaymentType   - 'P&I' (principal & interest) | 'IO' (interest only)
 * @property {string}        fixedTermExpiry - ISO 'YYYY-MM' when fixed term expires (or '')
 * @property {number|string} amount          - Scheduled repayment amount per `frequency`
 * @property {Frequency}     [frequency]     - Repayment frequency (defaults to 'fortnightly')
 */

/**
 * @typedef {Object} Expense
 * @property {string}        id            - Unique identifier
 * @property {string}        name          - Display name
 * @property {string}        category      - Category key from utils/categories.js
 * @property {ExpenseType}   type          - 'standard' | 'loan'
 * @property {ExpenseSubtype} subtype      - 'fixed' | 'variable'
 * @property {number|string} amount        - Amount per `frequency`
 * @property {Frequency}     frequency     - Payment frequency
 * @property {PaymentMethod} paymentMethod - How the expense is paid
 * @property {number|string} ddDay         - Day of month for direct debit (1–28, or '')
 * @property {string}        lender        - Lender name for loan expenses
 * @property {Facility[]}    facilities    - Loan facilities / splits (type === 'loan' only)
 * @property {string}        notes         - Free-text notes
 * @property {any[]}         history       - @deprecated Legacy field, never populated
 * @property {string}        startDate     - ISO date when expense becomes active
 * @property {string}        endDate       - ISO date when expense stops ('' = ongoing)
 * @property {string}        forPerson     - Person.id this expense is assigned to (or '')
 */

/**
 * Factory — returns a blank Facility with sensible defaults.
 * @param {Partial<Facility>} overrides
 * @returns {Facility}
 */
export function createFacility(overrides = {}) {
  return {
    id:              '',
    label:           '',
    balance:         '',
    rate:            '',
    rateType:        'fixed',
    repaymentType:   'P&I',
    fixedTermExpiry: '',
    amount:          '',
    frequency:       'fortnightly',
    ...overrides,
  };
}

/**
 * Factory — returns a blank Expense with sensible defaults.
 * @param {Partial<Expense>} overrides
 * @returns {Expense}
 */
export function createExpense(overrides = {}) {
  return {
    id:            '',
    name:          '',
    category:      'Groceries',
    type:          'standard',
    subtype:       'fixed',
    amount:        '',
    frequency:     'monthly',
    paymentMethod: 'Direct Debit',
    ddDay:         '',
    lender:        '',
    facilities:    [],
    notes:         '',
    history:       [], // legacy — never populated
    startDate:     '',
    endDate:       '',
    forPerson:     '',
    ...overrides,
  };
}

/**
 * Coerce a raw (possibly legacy) facility object to the canonical shape.
 * @param {object} raw
 * @returns {Facility}
 */
export function normalizeFacility(raw = {}) {
  return createFacility({
    id:              raw.id              ?? '',
    label:           raw.label           ?? '',
    balance:         raw.balance         ?? '',
    rate:            raw.rate            ?? '',
    rateType:        raw.rateType        ?? 'fixed',
    repaymentType:   raw.repaymentType   ?? 'P&I',
    fixedTermExpiry: raw.fixedTermExpiry ?? '',
    amount:          raw.amount          ?? '',
    frequency:       raw.frequency       ?? 'fortnightly',
  });
}

/**
 * Coerce a raw (possibly legacy) expense object to the canonical shape.
 * Handles the old type='fixed'|'variable' → type='standard', subtype=... migration.
 * @param {object} raw
 * @returns {Expense}
 */
export function normalizeExpense(raw = {}) {
  // Legacy type migration (pre-v1 data stored type as 'fixed' or 'variable')
  let type    = raw.type    ?? 'standard';
  let subtype = raw.subtype ?? 'fixed';
  if (type === 'fixed' || type === 'variable') {
    subtype = type;
    type    = 'standard';
  }

  return createExpense({
    id:            raw.id            ?? '',
    name:          raw.name          ?? '',
    category:      raw.category      ?? 'Groceries',
    type,
    subtype,
    amount:        raw.amount        ?? '',
    frequency:     raw.frequency     ?? 'monthly',
    paymentMethod: raw.paymentMethod ?? 'Direct Debit',
    ddDay:         raw.ddDay         ?? '',
    lender:        raw.lender        ?? '',
    facilities:    (raw.facilities   ?? []).map(normalizeFacility),
    notes:         raw.notes         ?? '',
    history:       raw.history       ?? [],
    startDate:     raw.startDate     ?? '',
    endDate:       raw.endDate       ?? '',
    forPerson:     raw.forPerson     ?? '',
  });
}
