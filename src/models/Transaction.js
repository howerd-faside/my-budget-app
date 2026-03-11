/**
 * @fileoverview Canonical internal money-movement model.
 *
 * Transaction is a unified, read-only representation of any financial event
 * across all domains (finance, investment, property). It is never persisted —
 * domain models (Expense, Dividend, etc.) remain the source of truth.
 *
 * Adapter functions map each domain record into a Transaction. Consumers
 * (reporting helpers, summaries, projections) import only what they need.
 *
 * ## Direction conventions
 *   inflow   — money arriving in the household (dividends, asset income)
 *   outflow  — money leaving the household (expenses, contributions)
 *   transfer — money moving between internal accounts (zero net effect)
 *
 * ## Amount field
 *   Always a non-negative number representing the canonical amount for that
 *   transaction type:
 *     expense / contribution → raw amount per frequency (recurring) or total (discrete)
 *     dividend               → netAmount received (post-tax)
 *     asset_income           → amount per frequency
 *     transfer               → value moved between accounts
 *
 * ## Recurring vs. discrete
 *   Expenses and asset incomes are recurring flows; their Transaction has a
 *   `frequency` field and a `date` of null (no single event date) or the
 *   startDate for expenses. Contributions, dividends, and transfers are
 *   discrete dated events.
 */

// ── Direction constants ───────────────────────────────────────────────────────

/** @enum {string} */
export const TX_DIRECTION = /** @type {const} */ ({
  INFLOW:   'inflow',
  OUTFLOW:  'outflow',
  TRANSFER: 'transfer',
});

// ── Type constants ────────────────────────────────────────────────────────────

/** @enum {string} */
export const TX_TYPE = /** @type {const} */ ({
  EXPENSE:      'expense',
  INCOME:       'income',
  CONTRIBUTION: 'contribution',
  DIVIDEND:     'dividend',
  TRANSFER:     'transfer',
  ASSET_INCOME: 'asset_income',
});

// ── Domain constants ──────────────────────────────────────────────────────────

/** @enum {string} */
export const TX_DOMAIN = /** @type {const} */ ({
  FINANCE:    'finance',
  INVESTMENT: 'investment',
  PROPERTY:   'property',
});

// ── Typedef ───────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Transaction
 * @property {string}                       id
 * @property {string|null}                  date             - ISO date YYYY-MM-DD, or null for recurring
 * @property {number}                       amount           - Canonical positive amount
 * @property {'inflow'|'outflow'|'transfer'} direction
 * @property {'expense'|'income'|'contribution'|'dividend'|'transfer'|'asset_income'} type
 * @property {'finance'|'investment'|'property'} domain
 * @property {string|null}                  sourceEntityType - e.g. 'account', 'holding', 'portfolio'
 * @property {string|null}                  sourceEntityId   - id of the source entity
 * @property {string|null}                  targetEntityType
 * @property {string|null}                  targetEntityId
 * @property {string|null}                  category         - Domain-specific label
 * @property {string|null}                  notes
 * @property {string|null}                  createdAt        - ISO timestamp
 * @property {string|null}                  [frequency]      - For recurring flows only
 */

// ── Private helper ────────────────────────────────────────────────────────────

/**
 * Safely coerce any value to a non-negative finite number.
 * @param {*} val
 * @returns {number}
 */
function toNum(val) {
  const n = parseFloat(val);
  return isFinite(n) ? n : 0;
}

// ── Adapter functions ─────────────────────────────────────────────────────────

/**
 * Map a recurring Expense to a Transaction.
 *
 * `amount` is the raw per-frequency amount.
 * `date` is the expense's startDate (start of the active window), or null if unset.
 * `frequency` is included as a non-standard field because expenses are recurring.
 *
 * @param {import('./Expense').Expense} expense
 * @returns {Transaction}
 */
export function transactionFromExpense(expense) {
  return {
    id:               expense.id   ?? '',
    date:             expense.startDate || null,
    amount:           toNum(expense.amount),
    direction:        TX_DIRECTION.OUTFLOW,
    type:             TX_TYPE.EXPENSE,
    domain:           TX_DOMAIN.FINANCE,
    sourceEntityType: null,
    sourceEntityId:   expense.forPerson || null,
    targetEntityType: null,
    targetEntityId:   null,
    category:         expense.category ?? null,
    notes:            expense.notes    || null,
    createdAt:        null,
    frequency:        expense.frequency ?? null,
  };
}

/**
 * Map an internal account Transfer to a Transaction.
 *
 * A transfer is zero-sum for the household; direction is 'transfer'.
 * sourceEntityId = fromId (account being debited).
 * targetEntityId = toId  (account being credited).
 *
 * @param {object} transfer  - { id, date, fromId, toId, amount, note }
 * @returns {Transaction}
 */
export function transactionFromTransfer(transfer) {
  return {
    id:               transfer.id   ?? '',
    date:             transfer.date ?? null,
    amount:           toNum(transfer.amount),
    direction:        TX_DIRECTION.TRANSFER,
    type:             TX_TYPE.TRANSFER,
    domain:           TX_DOMAIN.FINANCE,
    sourceEntityType: 'account',
    sourceEntityId:   transfer.fromId ?? null,
    targetEntityType: 'account',
    targetEntityId:   transfer.toId   ?? null,
    category:         null,
    notes:            transfer.note  || null,
    createdAt:        null,
  };
}

/**
 * Map an InvestmentContribution to a Transaction.
 *
 * `amount`          = contribution.amount (cash deployed into the portfolio).
 * `direction`       = outflow  (household cash → investment).
 * `sourceEntityId`  = portfolioId.
 * `targetEntityId`  = holdingId (or null for portfolio-level contributions).
 * `category`        = contribution.type ('Regular', 'Lump Sum', 'KiwiSaver', …).
 *
 * @param {import('./InvestmentContribution').InvestmentContribution} contribution
 * @returns {Transaction}
 */
export function transactionFromContribution(contribution) {
  return {
    id:               contribution.id          ?? '',
    date:             contribution.date         || null,
    amount:           toNum(contribution.amount),
    direction:        TX_DIRECTION.OUTFLOW,
    type:             TX_TYPE.CONTRIBUTION,
    domain:           TX_DOMAIN.INVESTMENT,
    sourceEntityType: 'portfolio',
    sourceEntityId:   contribution.portfolioId  || null,
    targetEntityType: 'holding',
    targetEntityId:   contribution.holdingId    || null,
    category:         contribution.type         || null,
    notes:            contribution.notes        || null,
    createdAt:        contribution.createdAt    || null,
  };
}

/**
 * Map a Dividend to a Transaction.
 *
 * `amount`          = dividend.netAmount — the cash actually received post-tax.
 *                     This is the canonical inflow amount.
 * `direction`       = inflow.
 * `sourceEntityId`  = holdingId (the holding that paid the dividend).
 * `targetEntityId`  = portfolioId.
 * `grossAmount`     = pre-tax dividend (supplemental, not part of base Transaction shape).
 * `taxAmount`       = RWT / NRWT withheld  (supplemental).
 *
 * @param {import('./Dividend').Dividend} dividend
 * @returns {Transaction & { grossAmount: number, taxAmount: number }}
 */
export function transactionFromDividend(dividend) {
  return {
    id:               dividend.id          ?? '',
    date:             dividend.date         || null,
    amount:           toNum(dividend.netAmount),
    direction:        TX_DIRECTION.INFLOW,
    type:             TX_TYPE.DIVIDEND,
    domain:           TX_DOMAIN.INVESTMENT,
    sourceEntityType: 'holding',
    sourceEntityId:   dividend.holdingId    || null,
    targetEntityType: 'portfolio',
    targetEntityId:   dividend.portfolioId  || null,
    category:         'dividend',
    notes:            dividend.notes        || null,
    createdAt:        dividend.createdAt    || null,
    // Dividend-specific supplemental fields (tax reporting).
    grossAmount:      toNum(dividend.grossAmount),
    taxAmount:        toNum(dividend.taxAmount),
  };
}

/**
 * Map a recurring AssetIncome to a Transaction.
 *
 * `amount`    = per-frequency amount.
 * `date`      = null (recurring flow, no single event date).
 * `category`  = assetIncome.type ('rental', 'dividend', 'business', …).
 * `frequency` = payment frequency.
 *
 * @param {import('./Person').AssetIncome} assetIncome
 * @returns {Transaction}
 */
export function transactionFromAssetIncome(assetIncome) {
  return {
    id:               assetIncome.id        ?? '',
    date:             null,
    amount:           toNum(assetIncome.amount),
    direction:        TX_DIRECTION.INFLOW,
    type:             TX_TYPE.ASSET_INCOME,
    domain:           TX_DOMAIN.FINANCE,
    sourceEntityType: null,
    sourceEntityId:   null,
    targetEntityType: null,
    targetEntityId:   null,
    category:         assetIncome.type      || null,
    notes:            assetIncome.notes     || null,
    createdAt:        null,
    frequency:        assetIncome.frequency || null,
  };
}
