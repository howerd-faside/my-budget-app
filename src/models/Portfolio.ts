/**
 * @fileoverview Domain model for an investment portfolio (container for holdings).
 *
 * Inconsistencies detected:
 * - `selectedPortfolioId` is stored in the root app state rather than being
 *   derived from the URL or a dedicated UI slice. If a portfolio is deleted while
 *   it is selected, selectedPortfolioId becomes a dangling reference with no
 *   cleanup logic in store.jsx.
 */

export interface Portfolio {
  id: string;
  name: string;
  createdAt: string;
}

/**
 * Factory — returns a blank Portfolio with sensible defaults.
 */
export function createPortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id:        '',
    name:      '',
    createdAt: '',
    ...overrides,
  };
}

/**
 * Coerce a raw portfolio object to the canonical shape.
 */
export function normalizePortfolio(raw: any = {}): Portfolio {
  return createPortfolio({
    id:        raw.id        ?? '',
    name:      raw.name      ?? '',
    createdAt: raw.createdAt ?? '',
  });
}
