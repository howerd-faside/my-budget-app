import { monthsBetween } from './dates';
import {
  transactionFromContribution,
  transactionFromDividend,
} from '../../models/Transaction';

// ── Wishlist affordability ────────────────────────────────────────────────────

/**
 * Returns an affordability category for a wishlist item given the savings trajectory.
 * One of: 'now' | 'soon' | 'later' | 'far' | 'beyond' | 'unknown'
 */
export function affordabilityStatus(cost, currentBalance, trajectory) {
  if (!cost || cost <= 0) return 'unknown';
  if (currentBalance >= cost) return 'now';
  const hit = trajectory.find(p => p.balance >= cost);
  if (!hit) return 'beyond';
  const months = monthsBetween(new Date(), new Date(hit.date));
  if (months <= 6)  return 'soon';
  if (months <= 18) return 'later';
  return 'far';
}

/**
 * Human-readable time until an item becomes affordable based on the trajectory.
 * Returns null when already affordable or no cost is set.
 */
export function affordabilityDate(cost, currentBalance, trajectory) {
  if (!cost || cost <= 0 || currentBalance >= cost) return null;
  const hit = trajectory.find(p => p.balance >= cost);
  if (!hit) return null;
  const months = monthsBetween(new Date(), new Date(hit.date));
  if (months < 1)  return 'This month';
  if (months < 12) return `~${months} month${months !== 1 ? 's' : ''}`;
  const yrs  = Math.floor(months / 12);
  const mths = months % 12;
  return `~${yrs}y${mths > 0 ? ` ${mths}m` : ''}`;
}

/**
 * Returns the YYYY-MM string of the first trajectory point that meets or
 * exceeds the goal amount, or null if never reached.
 */
export function findGoalHit(trajectory, goal) {
  const hit = trajectory.find(p => p.balance >= (goal.amount || 0));
  return hit?.date.slice(0, 7) || null;
}

// ── Investment portfolio calculations ─────────────────────────────────────────

/**
 * Compute aggregate portfolio stats from holdings, contributions, and dividends.
 * Returns { totalValue, totalCost, totalContrib, totalDivNet, unrealised, returnPct, allocation }
 *
 * Contribution and dividend totals are computed via Transaction adapters so
 * that all numeric coercion is handled by the canonical model boundary.
 */
export function calcPortfolioStats(holdings, contributions, dividends) {
  const totalValue   = holdings.reduce((s, h) => s + (+h.units || 0) * (+h.currentPrice || 0), 0);
  const totalCost    = holdings.reduce((s, h) => s + (+h.units || 0) * (+h.avgCost || 0), 0);
  const totalContrib = (contributions || [])
    .map(transactionFromContribution)
    .reduce((s, tx) => s + tx.amount, 0);
  const totalDivNet  = (dividends || [])
    .map(transactionFromDividend)
    .reduce((s, tx) => s + tx.amount, 0);
  const unrealised   = totalValue - totalCost;
  const returnPct    = totalCost > 0 ? (unrealised / totalCost * 100) : 0;

  const byCat = {};
  for (const h of holdings) {
    const val = (+h.units || 0) * (+h.currentPrice || 0);
    byCat[h.category] = (byCat[h.category] || 0) + val;
  }
  const allocation = Object.entries(byCat)
    .map(([cat, val]) => ({ cat, val, pct: totalValue > 0 ? val / totalValue : 0 }))
    .sort((a, b) => b.val - a.val);

  return { totalValue, totalCost, totalContrib, totalDivNet, unrealised, returnPct, allocation };
}

/**
 * Enrich each holding with derived fields: value, cost, gl (gain/loss), glPct.
 */
export function enrichHoldings(holdings) {
  return (holdings || []).map(h => {
    const value = (+h.units || 0) * (+h.currentPrice || 0);
    const cost  = (+h.units || 0) * (+h.avgCost      || 0);
    const gl    = value - cost;
    const glPct = cost > 0 ? (gl / cost * 100) : 0;
    return { ...h, value, cost, gl, glPct };
  });
}
