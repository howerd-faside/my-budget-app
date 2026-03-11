/**
 * @fileoverview Domain model for an investment holding within a portfolio.
 *
 * Inconsistencies detected:
 * - The EMPTY template in InvestmentHoldings.jsx does not include `units` or
 *   `avgCost` fields; they are only filled in when a purchase is logged. This
 *   means newly-created holdings have no cost basis until manually entered,
 *   causing division-by-zero guards to be scattered across the codebase.
 * - `priceUpdatedAt` is set by the price-fetch service but has no field in the
 *   EMPTY template, so older holdings lack it entirely.
 * - `ticker` is optional — holdings like KiwiSaver managed funds often have no
 *   ticker, which causes the price-fetch service to skip them silently.
 */

/**
 * @typedef {'Shares'|'ETF'|'Managed Fund'|'Bonds'|'Term Deposit'|'Crypto'|'Other'} HoldingCategory
 */

/** Valid holding categories. */
export const HOLDING_CATEGORIES = /** @type {const} */ (
  ['Shares', 'ETF', 'Managed Fund', 'Bonds', 'Term Deposit', 'Crypto', 'Other']
);

/** Display colours keyed by category (used in allocation charts). */
export const CATEGORY_COLORS = /** @type {const} */ ({
  'Shares':       '#0071E3',
  'ETF':          '#34C759',
  'Managed Fund': '#AF52DE',
  'Bonds':        '#FF9F0A',
  'Term Deposit': '#FF6B2B',
  'Crypto':       '#32ADE6',
  'Other':        '#86868B',
});

/**
 * @typedef {Object} Holding
 * @property {string}          id             - Unique identifier
 * @property {string}          portfolioId    - Parent Portfolio.id
 * @property {string}          name           - Full name (e.g. 'Apple Inc.')
 * @property {string}          ticker         - Exchange ticker (e.g. 'AAPL'), or '' for untickered holdings
 * @property {string}          platform       - Brokerage/platform name (e.g. 'Sharesies')
 * @property {HoldingCategory} category       - Asset class
 * @property {number|string}   units          - Number of units/shares held
 * @property {number|string}   avgCost        - Average cost per unit (NZD)
 * @property {number|string}   currentPrice   - Latest price per unit (NZD)
 * @property {string}          [priceUpdatedAt] - ISO timestamp of last price fetch
 * @property {string}          notes          - Free-text notes
 * @property {string}          createdAt      - ISO timestamp of record creation
 */

/**
 * Factory — returns a blank Holding with sensible defaults.
 * @param {Partial<Holding>} overrides
 * @returns {Holding}
 */
export function createHolding(overrides = {}) {
  return {
    id:           '',
    portfolioId:  '',
    name:         '',
    ticker:       '',
    platform:     '',
    category:     'Shares',
    units:        '',
    avgCost:      '',
    currentPrice: '',
    notes:        '',
    createdAt:    '',
    ...overrides,
  };
}

/**
 * Coerce a raw holding to the canonical shape.
 * @param {object} raw
 * @returns {Holding}
 */
export function normalizeHolding(raw = {}) {
  return createHolding({
    id:             raw.id             ?? '',
    portfolioId:    raw.portfolioId    ?? '',
    name:           raw.name           ?? '',
    ticker:         raw.ticker         ?? '',
    platform:       raw.platform       ?? '',
    category:       raw.category       ?? 'Shares',
    units:          raw.units          ?? '',
    avgCost:        raw.avgCost        ?? '',
    currentPrice:   raw.currentPrice   ?? '',
    priceUpdatedAt: raw.priceUpdatedAt ?? undefined,
    notes:          raw.notes          ?? '',
    createdAt:      raw.createdAt      ?? '',
  });
}
