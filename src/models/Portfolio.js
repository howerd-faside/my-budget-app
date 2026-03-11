/**
 * @fileoverview Domain model for an investment portfolio (container for holdings).
 *
 * Inconsistencies detected:
 * - `selectedPortfolioId` is stored in the root app state rather than being
 *   derived from the URL or a dedicated UI slice. If a portfolio is deleted while
 *   it is selected, selectedPortfolioId becomes a dangling reference with no
 *   cleanup logic in store.jsx.
 */

/**
 * @typedef {Object} Portfolio
 * @property {string} id        - Unique identifier
 * @property {string} name      - Display name shown in the portfolio switcher
 * @property {string} createdAt - ISO timestamp (YYYY-MM-DDTHH:mm:ss.sssZ)
 */

/**
 * Factory — returns a blank Portfolio with sensible defaults.
 * @param {Partial<Portfolio>} overrides
 * @returns {Portfolio}
 */
export function createPortfolio(overrides = {}) {
  return {
    id:        '',
    name:      '',
    createdAt: '',
    ...overrides,
  };
}

/**
 * Coerce a raw portfolio object to the canonical shape.
 * @param {object} raw
 * @returns {Portfolio}
 */
export function normalizePortfolio(raw = {}) {
  return createPortfolio({
    id:        raw.id        ?? '',
    name:      raw.name      ?? '',
    createdAt: raw.createdAt ?? '',
  });
}
