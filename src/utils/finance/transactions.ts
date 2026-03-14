/**
 * @fileoverview Query helpers that operate on the canonical Transaction model.
 *
 * These functions are the primary consumer of the Transaction adapters defined
 * in src/models/Transaction.ts. They provide cross-domain aggregation and
 * filtering that would otherwise be duplicated across page components.
 *
 * All functions are pure — no store access, no side effects.
 */

import type { Transaction } from '../../models/Transaction';
import type { InvestmentContribution } from '../../models/InvestmentContribution';
import type { Dividend } from '../../models/Dividend';
import type { Holding } from '../../models/Holding';
import {
  transactionFromContribution,
  transactionFromDividend,
} from '../../models/Transaction';

// ── Activity feed ─────────────────────────────────────────────────────────────

interface ActivityItem extends Transaction {
  label: string;
  holding: string;
}

/**
 * Combine investment contributions and dividends into a chronologically-sorted
 * activity feed, enriched with holding names for display.
 */
export function getPortfolioActivity(contributions: InvestmentContribution[], dividends: Dividend[], holdings: Holding[], limit = 8): ActivityItem[] {
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
    .sort((a, b) => b.date!.localeCompare(a.date!))
    .slice(0, limit);
}

// ── Filtering helpers ─────────────────────────────────────────────────────────

export function filterByYear(transactions: Transaction[], year: number | string): Transaction[] {
  const prefix = String(year);
  return (transactions || []).filter(tx => tx.date?.startsWith(prefix));
}

export function filterByDateRange(transactions: Transaction[], from: string, to: string): Transaction[] {
  return (transactions || []).filter(tx =>
    tx.date && tx.date >= from && tx.date <= to
  );
}

// ── Aggregation helpers ───────────────────────────────────────────────────────

export function sumTransactions(transactions: Transaction[]): number {
  return (transactions || []).reduce((total, tx) => total + tx.amount, 0);
}

export function sumField(transactions: any[], field: string): number {
  return (transactions || []).reduce((total: number, tx: any) => total + (parseFloat(tx[field]) || 0), 0);
}

export function groupSumByCategory(transactions: Transaction[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const tx of (transactions || [])) {
    const key = tx.category || 'Other';
    result[key] = (result[key] || 0) + tx.amount;
  }
  return result;
}

// ── Date-prefix filtering ─────────────────────────────────────────────────────

export function filterByYearMonth(transactions: Transaction[], yearMonth: string): Transaction[] {
  const prefix = String(yearMonth);
  return (transactions || []).filter(tx => tx.date?.startsWith(prefix));
}
