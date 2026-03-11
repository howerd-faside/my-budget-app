/**
 * @fileoverview Domain model for a contribution made to an investment holding.
 *
 * Inconsistencies detected:
 * - The EMPTY template in InvestmentContributions.jsx does not include `portfolioId`;
 *   it is injected at save-time from `state.selectedPortfolioId`. If the portfolio
 *   switcher changes between opening the form and saving, the contribution could be
 *   assigned to the wrong portfolio.
 * - `holdingId` defaults to '' in the form but the contribution can be saved without
 *   selecting a holding (it becomes a portfolio-level contribution). However, the
 *   field is used for linking in the UI — a missing holdingId renders as '—' silently.
 *
 * Numeric normalization:
 *   `normalizeInvestmentContribution` coerces `amount` to a number (0 if absent).
 *   `createInvestmentContribution` retains `''` default for form binding.
 */

/**
 * @typedef {'Regular'|'Lump Sum'|'KiwiSaver'|'Dividend Reinvestment'|'Other'} ContributionType
 */

/** Valid contribution types. */
export const CONTRIBUTION_TYPES = /** @type {const} */ (
  ['Regular', 'Lump Sum', 'KiwiSaver', 'Dividend Reinvestment', 'Other']
);

/** Pill colour class keyed by contribution type. */
export const CONTRIBUTION_TYPE_PILL = /** @type {const} */ ({
  'Regular':               'teal',
  'Lump Sum':              'amber',
  'KiwiSaver':             'purple',
  'Dividend Reinvestment': 'green',
  'Other':                 '',
});

/**
 * @typedef {Object} InvestmentContribution
 * @property {string}           id          - Unique identifier
 * @property {string}           portfolioId - Parent Portfolio.id
 * @property {string}           date        - ISO date (YYYY-MM-DD)
 * @property {string}           holdingId   - Target Holding.id, or '' for portfolio-level
 * @property {string}           platform    - Brokerage/platform name
 * @property {number}           amount      - Amount contributed (NZD)
 * @property {ContributionType} type        - Contribution type
 * @property {string}           notes       - Free-text notes
 * @property {string}           createdAt   - ISO timestamp of record creation
 */

/**
 * Factory — returns a blank InvestmentContribution with sensible defaults.
 * @param {Partial<InvestmentContribution>} overrides
 * @returns {InvestmentContribution}
 */
export function createInvestmentContribution(overrides = {}) {
  return {
    id:          '',
    portfolioId: '',
    date:        '',
    holdingId:   '',
    platform:    '',
    amount:      '',
    type:        'Regular',
    notes:       '',
    createdAt:   '',
    ...overrides,
  };
}

/**
 * Parse a numeric value from storage; returns 0 for empty/invalid.
 * @param {*} val
 * @returns {number}
 */
function toNum(val) {
  const n = parseFloat(val);
  return isFinite(n) ? n : 0;
}

/**
 * Coerce a raw contribution record to the canonical shape.
 * `amount` is coerced to a number (0 if absent/invalid).
 * @param {object} raw
 * @returns {InvestmentContribution}
 */
export function normalizeInvestmentContribution(raw = {}) {
  return createInvestmentContribution({
    id:          raw.id          ?? '',
    portfolioId: raw.portfolioId ?? '',
    date:        raw.date        ?? '',
    holdingId:   raw.holdingId   ?? '',
    platform:    raw.platform    ?? '',
    amount:      toNum(raw.amount),
    type:        raw.type        ?? 'Regular',
    notes:       raw.notes       ?? '',
    createdAt:   raw.createdAt   ?? '',
  });
}
