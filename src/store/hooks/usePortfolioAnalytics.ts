/**
 * usePortfolioAnalytics — derived hook for the new transaction-led model.
 *
 * Computes positions, enriched assets, portfolio overview, income totals,
 * and recent activity for the currently-selected portfolio. All calculations
 * are memoized and sourced from the new entity arrays (investmentAssets,
 * investmentTransactions, priceCache).
 *
 * Usage:
 *   const { enrichedAssets, overview, activity } = usePortfolioAnalytics();
 */
import { useMemo } from 'react';
import { useInvestment } from './useInvestment';
import {
  enrichAllAssets,
  calcPortfolioOverview,
  calcIncomeTotals,
  getRecentActivity,
  getAllocation,
} from '../../utils/finance/portfolio';

import type { EnrichedAsset, PortfolioOverview, IncomeTotals, AllocationEntry, ActivityEntry, AllocGroupBy } from '../../utils/finance/portfolio';
import type { Asset }                 from '../../models/Asset';
import type { InvestmentTransaction } from '../../models/InvestmentTransaction';
import type { PriceEntry }            from '../../models/PriceEntry';

export interface UsePortfolioAnalyticsReturn {
  // Filtered to current portfolio
  assets:        Asset[];
  transactions:  InvestmentTransaction[];
  prices:        PriceEntry[];

  // Derived
  enrichedAssets: EnrichedAsset[];
  overview:       PortfolioOverview;
  income:         IncomeTotals;
  activity:       ActivityEntry[];

  // On-demand allocation (call with groupBy arg)
  allocationBy: (groupBy: AllocGroupBy) => AllocationEntry[];
}

export function usePortfolioAnalytics(): UsePortfolioAnalyticsReturn {
  const {
    investmentAssets,
    investmentTransactions,
    priceCache,
    selectedPortfolioId: pid,
  } = useInvestment();

  // ── Filter to selected portfolio ──────────────────────────────────────────

  const assets = useMemo(
    () => (investmentAssets || []).filter(a => a.portfolioId === pid),
    [investmentAssets, pid],
  );

  const transactions = useMemo(
    () => (investmentTransactions || []).filter(t => t.portfolioId === pid),
    [investmentTransactions, pid],
  );

  const prices = useMemo(() => {
    const ids = new Set(assets.map(a => a.id));
    return (priceCache || []).filter(p => ids.has(p.assetId));
  }, [priceCache, assets]);

  // ── Derived calculations ──────────────────────────────────────────────────

  const enrichedAssets = useMemo(
    () => enrichAllAssets(assets, transactions, prices),
    [assets, transactions, prices],
  );

  const overview = useMemo(
    () => calcPortfolioOverview(assets, transactions, prices),
    [assets, transactions, prices],
  );

  const income = useMemo(
    () => calcIncomeTotals(transactions),
    [transactions],
  );

  const activity = useMemo(
    () => getRecentActivity(transactions, assets),
    [transactions, assets],
  );

  // Allocation by any dimension — returns a stable fn reference via useMemo
  const allocationBy = useMemo(
    () => (groupBy: AllocGroupBy) => getAllocation(enrichedAssets, groupBy),
    [enrichedAssets],
  );

  return {
    assets,
    transactions,
    prices,
    enrichedAssets,
    overview,
    income,
    activity,
    allocationBy,
  };
}
