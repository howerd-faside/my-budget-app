/**
 * @fileoverview Domain model for an investment portfolio (container for assets).
 *
 * `currency` is the portfolio's base reporting currency. Defaults to 'NZD'.
 * `costBasisMethod` controls gain calculations — 'average' is standard for NZ
 * tax purposes; 'fifo' available for future use.
 *
 * Backward-compatible: old portfolios created without currency/costBasisMethod
 * receive defaults via normalizePortfolio.
 */

export const COST_BASIS_METHODS = ['average', 'fifo'] as const;
export type CostBasisMethod = typeof COST_BASIS_METHODS[number];

export interface Portfolio {
  id: string;
  name: string;
  currency: string;           // base reporting currency
  costBasisMethod: CostBasisMethod;
  archived: boolean;          // hidden from switcher, visible in management screen
  createdAt: string;
}

/**
 * Factory — returns a blank Portfolio with sensible defaults.
 */
export function createPortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id:              '',
    name:            '',
    currency:        'NZD',
    costBasisMethod: 'average',
    archived:        false,
    createdAt:       '',
    ...overrides,
  };
}

/**
 * Coerce a raw portfolio object to the canonical shape.
 * Handles legacy portfolios that lack currency/costBasisMethod.
 */
export function normalizePortfolio(raw: any = {}): Portfolio {
  return createPortfolio({
    id:              raw.id              ?? '',
    name:            raw.name            ?? '',
    currency:        raw.currency        ?? 'NZD',
    costBasisMethod: raw.costBasisMethod ?? 'average',
    archived:        raw.archived        ?? false,
    createdAt:       raw.createdAt       ?? '',
  });
}
