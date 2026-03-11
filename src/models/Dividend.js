/**
 * @fileoverview Domain model for a dividend payment received from a holding.
 *
 * Inconsistencies detected:
 * - `grossAmount`, `taxAmount`, and `netAmount` are all stored as user-entered
 *   strings, meaning there is no enforced relationship (netAmount === grossAmount −
 *   taxAmount). The UI displays all three but never cross-validates them.
 * - Like InvestmentContribution, `portfolioId` is injected at save-time and the
 *   form's EMPTY template omits it.
 * - RWT (Resident Withholding Tax) on dividends is stored per-record but there
 *   is no `rwtRate` field; the rate must be inferred from grossAmount and taxAmount,
 *   which is fragile.
 */

/**
 * @typedef {Object} Dividend
 * @property {string}        id          - Unique identifier
 * @property {string}        portfolioId - Parent Portfolio.id
 * @property {string}        date        - ISO date (YYYY-MM-DD)
 * @property {string}        holdingId   - Source Holding.id, or '' if unlinked
 * @property {string}        platform    - Brokerage/platform name
 * @property {number|string} grossAmount - Gross dividend before tax (NZD)
 * @property {number|string} taxAmount   - RWT / withholding tax deducted (NZD)
 * @property {number|string} netAmount   - Net dividend received (NZD). No auto-calculation.
 * @property {string}        notes       - Free-text notes
 * @property {string}        createdAt   - ISO timestamp of record creation
 */

/**
 * Factory — returns a blank Dividend with sensible defaults.
 * @param {Partial<Dividend>} overrides
 * @returns {Dividend}
 */
export function createDividend(overrides = {}) {
  return {
    id:          '',
    portfolioId: '',
    date:        '',
    holdingId:   '',
    platform:    '',
    grossAmount: '',
    taxAmount:   '',
    netAmount:   '',
    notes:       '',
    createdAt:   '',
    ...overrides,
  };
}

/**
 * Coerce a raw dividend record to the canonical shape.
 * @param {object} raw
 * @returns {Dividend}
 */
export function normalizeDividend(raw = {}) {
  return createDividend({
    id:          raw.id          ?? '',
    portfolioId: raw.portfolioId ?? '',
    date:        raw.date        ?? '',
    holdingId:   raw.holdingId   ?? '',
    platform:    raw.platform    ?? '',
    grossAmount: raw.grossAmount ?? '',
    taxAmount:   raw.taxAmount   ?? '',
    netAmount:   raw.netAmount   ?? '',
    notes:       raw.notes       ?? '',
    createdAt:   raw.createdAt   ?? '',
  });
}
