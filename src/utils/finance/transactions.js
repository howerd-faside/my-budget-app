/**
 * @fileoverview Query helpers that operate on the canonical Transaction model.
 *
 * These functions are the primary consumer of the Transaction adapters defined
 * in src/models/Transaction.js. They provide cross-domain aggregation and
 * filtering that would otherwise be duplicated across page components.
 *
 * All functions are pure — no store access, no side effects.
 *
 * ## Currently used by
 *   - InvestmentDashboard  → getPortfolioActivity
 *   - savings.js           → calcPortfolioStats (contribution/dividend totals)
 *
 * ## Future use
 *   - Cross-domain cash-flow report
 *   - Unified transaction search / export
 */

import {
  transactionFromContribution,
  transactionFromDividend,
} from '../../models/Transaction';

// ── Activity feed ─────────────────────────────────────────────────────────────

/**
 * Combine investment contributions and dividends into a chronologically-sorted
 * activity feed, enriched with holding names for display.
 *
 * Returns Transaction objects augmented with two view-model fields:
 *   `label`   — human-readable event label (e.g. 'Regular', 'Lump Sum', 'Dividend')
 *   `holding` — resolved holding display name, falling back to platform or '—'
 *
 * @param {object[]} contributions  - Raw InvestmentContribution records
 * @param {object[]} dividends      - Raw Dividend records
 * @param {object[]} holdings       - Raw Holding records (for name lookup)
 * @param {number}   [limit=8]      - Maximum number of items to return
 * @returns {Array<import('../../models/Transaction').Transaction & { label: string, holding: string }>}
 */
export function getPortfolioActivity(contributions, dividends, holdings, limit = 8) {
  const holdingsList = holdings || [];

  const contribItems = (contributions || []).map(c => {
    const tx      = transactionFromContribution(c);
    const matched = holdingsList.find(h => h.id === tx.targetEntityId);
    return {
      ...tx,
      label:   tx.category || 'Contribution',
      holding: matched?.name || c.platform || '—',
    };
  });

  const dividendItems = (dividends || []).map(d => {
    const tx      = transactionFromDividend(d);
    const matched = holdingsList.find(h => h.id === tx.sourceEntityId);
    return {
      ...tx,
      label:   'Dividend',
      holding: matched?.name || d.platform || '—',
    };
  });

  return [...contribItems, ...dividendItems]
    .filter(tx => tx.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

// ── Filtering helpers ─────────────────────────────────────────────────────────

/**
 * Filter transactions to those whose date starts with the given year string.
 *
 * @param {import('../../models/Transaction').Transaction[]} transactions
 * @param {number|string} year  - e.g. 2026
 * @returns {import('../../models/Transaction').Transaction[]}
 */
export function filterByYear(transactions, year) {
  const prefix = String(year);
  return (transactions || []).filter(tx => tx.date?.startsWith(prefix));
}

/**
 * Filter transactions whose date falls within [from, to] inclusive.
 * Transactions with a null date are excluded.
 *
 * @param {import('../../models/Transaction').Transaction[]} transactions
 * @param {string} from  - ISO date YYYY-MM-DD (inclusive)
 * @param {string} to    - ISO date YYYY-MM-DD (inclusive)
 * @returns {import('../../models/Transaction').Transaction[]}
 */
export function filterByDateRange(transactions, from, to) {
  return (transactions || []).filter(tx =>
    tx.date && tx.date >= from && tx.date <= to
  );
}

// ── Aggregation helpers ───────────────────────────────────────────────────────

/**
 * Sum the `amount` field across an array of Transactions.
 *
 * @param {import('../../models/Transaction').Transaction[]} transactions
 * @returns {number}
 */
export function sumTransactions(transactions) {
  return (transactions || []).reduce((total, tx) => total + tx.amount, 0);
}

/**
 * Sum a named supplemental field across an array of Transactions.
 * Used for dividend-specific fields like `grossAmount` and `taxAmount`
 * that are not part of the base Transaction shape.
 * Fields that are absent or non-numeric on a transaction contribute 0.
 *
 * @param {object[]} transactions
 * @param {string}   field  - e.g. 'grossAmount', 'taxAmount'
 * @returns {number}
 */
export function sumField(transactions, field) {
  return (transactions || []).reduce((total, tx) => total + (parseFloat(tx[field]) || 0), 0);
}

/**
 * Group transactions by their `category` field and sum amounts per group.
 * Transactions whose category is null or undefined are grouped under 'Other'.
 * Returns a plain object { [category]: totalAmount }.
 *
 * @param {import('../../models/Transaction').Transaction[]} transactions
 * @returns {Record<string, number>}
 */
export function groupSumByCategory(transactions) {
  const result = {};
  for (const tx of (transactions || [])) {
    const key = tx.category || 'Other';
    result[key] = (result[key] || 0) + tx.amount;
  }
  return result;
}

// ── Date-prefix filtering ─────────────────────────────────────────────────────

/**
 * Filter transactions to those whose date starts with the given YYYY-MM string.
 * Transactions with a null date are excluded.
 *
 * @param {import('../../models/Transaction').Transaction[]} transactions
 * @param {string} yearMonth  - e.g. '2026-03'
 * @returns {import('../../models/Transaction').Transaction[]}
 */
export function filterByYearMonth(transactions, yearMonth) {
  const prefix = String(yearMonth);
  return (transactions || []).filter(tx => tx.date?.startsWith(prefix));
}
