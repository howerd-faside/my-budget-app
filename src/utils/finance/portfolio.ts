/**
 * @fileoverview Pure calculators for the transaction-led investment model.
 *
 * All functions operate on Asset[], InvestmentTransaction[], PriceEntry[] —
 * the new domain entities. No store access, no side effects.
 *
 * Position (units held, cost basis) is derived from chronologically-sorted
 * buy/sell transactions using the average cost method — standard for NZ tax.
 *
 * Transactions with `units === null` (e.g. migrated contributions that lack
 * unit detail) are treated as cash-flow records and do NOT affect position.
 */

import type { Asset }                  from '../../models/Asset';
import type { InvestmentTransaction }  from '../../models/InvestmentTransaction';
import type { PriceEntry }             from '../../models/PriceEntry';

// ── Position ────────────────────────────────────────────────────────────────

export interface AssetPosition {
  assetId: string;
  units: number;
  totalCost: number;       // running cost basis (reduced on sells)
  avgCost: number;         // totalCost / units (0 if no units)
  realisedGL: number;      // cumulative realised gain/loss from sells
}

/**
 * Derive an asset's current position from its buy/sell history.
 *
 * Average cost method:
 *   buy  → units += tx.units, costBasis += units * price + fee
 *   sell → proceeds = units * price − fee
 *          costOfSold = avgCost * units
 *          realisedGL += proceeds − costOfSold
 *          costBasis  -= costOfSold
 *
 * Only transactions with non-null `units` affect position.
 */
export function calcAssetPosition(
  assetId: string,
  transactions: InvestmentTransaction[],
): AssetPosition {
  const txs = transactions
    .filter(tx =>
      tx.assetId === assetId &&
      (tx.type === 'buy' || tx.type === 'sell') &&
      tx.units != null
    )
    .sort((a, b) =>
      (a.date || '').localeCompare(b.date || '') ||
      (a.createdAt || '').localeCompare(b.createdAt || '')
    );

  let units = 0;
  let costBasis = 0;
  let realisedGL = 0;

  for (const tx of txs) {
    const txUnits = tx.units!;
    const txPrice = tx.price ?? 0;
    const txFee   = tx.fee   || 0;

    if (tx.type === 'buy') {
      costBasis += txUnits * txPrice + txFee;
      units     += txUnits;
    } else {
      // sell
      const avg       = units > 0 ? costBasis / units : 0;
      const proceeds  = txUnits * txPrice - txFee;
      const costSold  = avg * txUnits;

      realisedGL += proceeds - costSold;
      costBasis  -= costSold;
      units      -= txUnits;

      // Guard against floating-point dust
      if (units < 1e-8) {
        units     = 0;
        costBasis = 0;
      }
    }
  }

  return {
    assetId,
    units,
    totalCost:  costBasis,
    avgCost:    units > 0 ? costBasis / units : 0,
    realisedGL,
  };
}

/**
 * Batch-compute positions for every asset in the list.
 */
export function calcAllPositions(
  assets: Asset[],
  transactions: InvestmentTransaction[],
): AssetPosition[] {
  return assets.map(a => calcAssetPosition(a.id, transactions));
}

// ── Price lookup ────────────────────────────────────────────────────────────

/** Resolve current price for an asset from the cache (0 if absent). */
export function getAssetPrice(assetId: string, priceCache: PriceEntry[]): number {
  const entry = priceCache.find(p => p.assetId === assetId);
  return entry?.price ?? 0;
}

// ── Enriched asset (identity + position + price + derived) ──────────────────

export interface EnrichedAsset {
  asset: Asset;
  position: AssetPosition;
  currentPrice: number;
  currentValue: number;         // units × currentPrice
  unrealisedGL: number;         // currentValue − totalCost
  unrealisedGLPct: number;      // pct (0 if no cost)
  totalReturn: number;          // unrealisedGL + realisedGL
}

export function enrichAsset(
  asset: Asset,
  position: AssetPosition,
  currentPrice: number,
): EnrichedAsset {
  const currentValue   = position.units * currentPrice;
  const unrealisedGL   = currentValue - position.totalCost;
  const unrealisedGLPct = position.totalCost > 0
    ? (unrealisedGL / position.totalCost) * 100
    : 0;
  const totalReturn = unrealisedGL + position.realisedGL;

  return {
    asset,
    position,
    currentPrice,
    currentValue,
    unrealisedGL,
    unrealisedGLPct,
    totalReturn,
  };
}

/**
 * Build the full enriched-asset list for a set of assets.
 */
export function enrichAllAssets(
  assets: Asset[],
  transactions: InvestmentTransaction[],
  priceCache: PriceEntry[],
): EnrichedAsset[] {
  return assets.map(asset => {
    const pos   = calcAssetPosition(asset.id, transactions);
    const price = getAssetPrice(asset.id, priceCache);
    return enrichAsset(asset, pos, price);
  });
}

// ── Income totals ───────────────────────────────────────────────────────────

export interface IncomeTotals {
  dividendGross: number;
  dividendTax: number;
  dividendNet: number;
  feesPaid: number;
}

/**
 * Aggregate income and fee totals from transactions.
 *
 * Dividends: amount is net, grossAmount/taxAmount carry the breakdown.
 * Fees: amount is the cost (stored as positive in tx.amount or tx.fee).
 */
export function calcIncomeTotals(transactions: InvestmentTransaction[]): IncomeTotals {
  let dividendGross = 0;
  let dividendTax   = 0;
  let dividendNet   = 0;
  let feesPaid      = 0;

  for (const tx of transactions) {
    if (tx.type === 'dividend') {
      dividendGross += tx.grossAmount ?? 0;
      dividendTax   += tx.taxAmount   ?? 0;
      dividendNet   += tx.amount;
    } else if (tx.type === 'fee') {
      feesPaid += tx.amount;
    }
  }

  return { dividendGross, dividendTax, dividendNet, feesPaid };
}

// ── Portfolio-level overview ────────────────────────────────────────────────

export interface AllocationEntry {
  cat: string;
  val: number;
  pct: number;
}

export type AllocGroupBy = 'category' | 'platform' | 'asset';

/**
 * Group enriched assets by a dimension and compute allocation percentages.
 */
export function getAllocation(
  enrichedAssets: EnrichedAsset[],
  groupBy: AllocGroupBy = 'category',
): AllocationEntry[] {
  const buckets: Record<string, number> = {};
  let total = 0;

  for (const ea of enrichedAssets) {
    let key: string;
    switch (groupBy) {
      case 'platform': key = ea.asset.platform || 'Unknown'; break;
      case 'asset':    key = ea.asset.name     || 'Unknown'; break;
      default:         key = ea.asset.category  || 'Other';
    }
    buckets[key] = (buckets[key] || 0) + ea.currentValue;
    total += ea.currentValue;
  }

  return Object.entries(buckets)
    .map(([cat, val]) => ({ cat, val, pct: total > 0 ? val / total : 0 }))
    .sort((a, b) => b.val - a.val);
}

export interface PortfolioOverview {
  totalValue: number;
  totalCost: number;
  unrealisedGL: number;
  realisedGL: number;
  totalReturn: number;
  returnPct: number;          // (totalReturn / totalCost) × 100
  income: IncomeTotals;
  allocation: AllocationEntry[];
}

/**
 * Compute aggregate portfolio-level statistics.
 */
export function calcPortfolioOverview(
  assets: Asset[],
  transactions: InvestmentTransaction[],
  priceCache: PriceEntry[],
): PortfolioOverview {
  const enriched = enrichAllAssets(assets, transactions, priceCache);

  let totalValue    = 0;
  let totalCost     = 0;
  let unrealisedGL  = 0;
  let realisedGL    = 0;

  for (const ea of enriched) {
    totalValue   += ea.currentValue;
    totalCost    += ea.position.totalCost;
    unrealisedGL += ea.unrealisedGL;
    realisedGL   += ea.position.realisedGL;
  }

  const totalReturn = unrealisedGL + realisedGL;
  const returnPct   = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;
  const income      = calcIncomeTotals(transactions);
  const allocation  = getAllocation(enriched);

  return {
    totalValue,
    totalCost,
    unrealisedGL,
    realisedGL,
    totalReturn,
    returnPct,
    income,
    allocation,
  };
}

// ── Recent activity feed ────────────────────────────────────────────────────

export interface ActivityEntry {
  tx: InvestmentTransaction;
  assetName: string;
}

/**
 * Most-recent transactions, enriched with asset names for display.
 */
export function getRecentActivity(
  transactions: InvestmentTransaction[],
  assets: Asset[],
  limit = 10,
): ActivityEntry[] {
  const nameMap: Record<string, string> = {};
  for (const a of assets) nameMap[a.id] = a.name;

  return [...transactions]
    .filter(tx => tx.date)
    .sort((a, b) => b.date!.localeCompare(a.date!))
    .slice(0, limit)
    .map(tx => ({
      tx,
      assetName: nameMap[tx.assetId] || '',
    }));
}

// ── Period returns ──────────────────────────────────────────────────────────

export interface PeriodReturns {
  invested: number;       // sum of buy amounts in period
  disposed: number;       // sum of sell amounts in period
  realisedGL: number;     // realised G/L from sells in period (avg cost method)
  dividendNet: number;
  dividendGross: number;
  dividendTax: number;
  feesPaid: number;
  txCount: number;
}

/**
 * Compute return-related aggregates for transactions within a date range.
 * Pure function — filters then accumulates by type.
 */
export function calcPeriodReturns(
  transactions: InvestmentTransaction[],
  from: string,
  to: string,
): PeriodReturns {
  const txs = filterTxByDateRange(transactions, from, to);

  let invested = 0, disposed = 0, realisedGL = 0;
  let dividendNet = 0, dividendGross = 0, dividendTax = 0, feesPaid = 0;

  for (const tx of txs) {
    switch (tx.type) {
      case 'buy':      invested  += tx.amount; break;
      case 'sell':     disposed  += tx.amount; break;
      case 'dividend':
        dividendNet   += tx.amount;
        dividendGross += tx.grossAmount ?? 0;
        dividendTax   += tx.taxAmount   ?? 0;
        break;
      case 'fee': feesPaid += tx.amount; break;
    }
  }

  // Realised GL from sells in the period: need asset-level avg cost at sell time.
  // Approximate by filtering all buy/sell txs up to `to`, then only counting
  // sells within [from, to].
  const allTradeTxs = transactions.filter(
    tx => (tx.type === 'buy' || tx.type === 'sell') && tx.units != null && tx.date && tx.date <= to,
  );
  const sortedTrades = [...allTradeTxs].sort(
    (a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || '').localeCompare(b.createdAt || ''),
  );

  // Group by asset and replay
  const byAsset: Record<string, typeof sortedTrades> = {};
  for (const tx of sortedTrades) {
    (byAsset[tx.assetId] ??= []).push(tx);
  }

  for (const assetTxs of Object.values(byAsset)) {
    let units = 0, costBasis = 0;
    for (const tx of assetTxs) {
      const u = tx.units!, p = tx.price ?? 0, f = tx.fee || 0;
      if (tx.type === 'buy') {
        costBasis += u * p + f;
        units     += u;
      } else {
        const avg = units > 0 ? costBasis / units : 0;
        if (tx.date! >= from) {
          // This sell is within the period
          realisedGL += (u * p - f) - avg * u;
        }
        costBasis -= avg * u;
        units     -= u;
        if (units < 1e-8) { units = 0; costBasis = 0; }
      }
    }
  }

  return { invested, disposed, realisedGL, dividendNet, dividendGross, dividendTax, feesPaid, txCount: txs.length };
}

// ── Per-sell realised detail ─────────────────────────────────────────────

export interface RealisedSellEntry {
  tx: InvestmentTransaction;
  assetName: string;
  proceeds: number;
  costBasis: number;
  gainLoss: number;
}

/**
 * Return per-sell rows with avg-cost-at-time-of-sale detail.
 * Replays full buy/sell history per asset up to `to`, emitting a row
 * for each sell within [from, to].
 */
export function calcRealisedSells(
  transactions: InvestmentTransaction[],
  assets: Asset[],
  from: string,
  to: string,
): RealisedSellEntry[] {
  const nameMap: Record<string, string> = {};
  for (const a of assets) nameMap[a.id] = a.name;

  const allTradeTxs = transactions.filter(
    tx => (tx.type === 'buy' || tx.type === 'sell') && tx.units != null && tx.date && tx.date <= to,
  );
  const sorted = [...allTradeTxs].sort(
    (a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || '').localeCompare(b.createdAt || ''),
  );

  const byAsset: Record<string, typeof sorted> = {};
  for (const tx of sorted) {
    (byAsset[tx.assetId] ??= []).push(tx);
  }

  const rows: RealisedSellEntry[] = [];

  for (const assetTxs of Object.values(byAsset)) {
    let units = 0, costBasis = 0;
    for (const tx of assetTxs) {
      const u = tx.units!, p = tx.price ?? 0, f = tx.fee || 0;
      if (tx.type === 'buy') {
        costBasis += u * p + f;
        units     += u;
      } else {
        const avg      = units > 0 ? costBasis / units : 0;
        const proceeds = u * p - f;
        const cost     = avg * u;
        if (tx.date! >= from) {
          rows.push({ tx, assetName: nameMap[tx.assetId] || '', proceeds, costBasis: cost, gainLoss: proceeds - cost });
        }
        costBasis -= cost;
        units     -= u;
        if (units < 1e-8) { units = 0; costBasis = 0; }
      }
    }
  }

  return rows.sort((a, b) => (b.tx.date || '').localeCompare(a.tx.date || ''));
}

// ── Units timeline (for chart) ─────────────────────────────────────────────

export interface UnitsSnapshot {
  date: string;
  units: number;
}

/**
 * Build a chronological timeline of cumulative units for an asset.
 * Used for efficient historical position lookup in chart building.
 */
export function buildUnitsTimeline(
  assetId: string,
  transactions: InvestmentTransaction[],
): UnitsSnapshot[] {
  const trades = transactions
    .filter(tx => tx.assetId === assetId && (tx.type === 'buy' || tx.type === 'sell') && tx.units != null && tx.date)
    .sort((a, b) => a.date!.localeCompare(b.date!) || (a.createdAt || '').localeCompare(b.createdAt || ''));

  const timeline: UnitsSnapshot[] = [];
  let cumulative = 0;

  for (const tx of trades) {
    cumulative += tx.type === 'buy' ? tx.units! : -tx.units!;
    if (cumulative < 1e-8) cumulative = 0;
    timeline.push({ date: tx.date!, units: cumulative });
  }

  return timeline;
}

/**
 * Binary search: find cumulative units at `dateStr` from a sorted timeline.
 * Returns 0 if the date is before the first trade.
 */
export function getUnitsAtDate(timeline: UnitsSnapshot[], dateStr: string): number {
  if (timeline.length === 0) return 0;
  let lo = 0, hi = timeline.length - 1, result = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (timeline[mid].date <= dateStr) { result = timeline[mid].units; lo = mid + 1; }
    else                               { hi = mid - 1; }
  }
  return result;
}

// ── Filtering helpers ───────────────────────────────────────────────────────

export function filterTxByYear(
  transactions: InvestmentTransaction[],
  year: number | string,
): InvestmentTransaction[] {
  const prefix = String(year);
  return transactions.filter(tx => tx.date?.startsWith(prefix));
}

export function filterTxByDateRange(
  transactions: InvestmentTransaction[],
  from: string,
  to: string,
): InvestmentTransaction[] {
  return transactions.filter(tx =>
    tx.date && tx.date >= from && tx.date <= to
  );
}

export function filterTxByType(
  transactions: InvestmentTransaction[],
  type: InvestmentTransaction['type'],
): InvestmentTransaction[] {
  return transactions.filter(tx => tx.type === type);
}
