import { monthsBetween, getFortnight } from './dates';
import { calcNetPay } from './tax';
import { toFortnightly } from './frequency';
import {
  transactionFromContribution,
  transactionFromDividend,
} from '../../models/Transaction';

// ── Account helpers ──────────────────────────────────────────────────────────

export function totalBalance(accounts) {
  return (accounts || []).reduce((s, a) => s + (a.balance || 0), 0);
}

// ── Income / expense helpers ─────────────────────────────────────────────────

function secondaryIncomeFn(secondaryIncomes) {
  return (secondaryIncomes || []).reduce((s, si) => s + toFortnightly(si.amount, si.frequency), 0);
}

export function calcFortnightlyIncome(people) {
  return (people || []).reduce((sum, p) => {
    const net = calcNetPay(p).netFortnightly;
    return sum + net + secondaryIncomeFn(p.secondaryIncomes);
  }, 0);
}

/**
 * Returns the applicable grossAnnual for a person at a given date.
 * Priority: income events > employment history > person.grossAnnual fallback.
 */
export function getPersonIncomeAt(person, date) {
  const d = typeof date === 'string' ? new Date(date) : date;

  // 1. Income events
  const activeEvents = (person.incomeEvents || [])
    .filter(e => e.startDate && new Date(e.startDate) <= d && (!e.endDate || new Date(e.endDate) > d))
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  if (activeEvents.length > 0) {
    const activeRoles = (person.employmentHistory || [])
      .filter(r => r.startDate && new Date(r.startDate) <= d && (!r.endDate || new Date(r.endDate) > d))
      .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    const employer = activeRoles.length > 0 ? (activeRoles[0].employer || null) : null;
    return { grossAnnual: activeEvents[0].grossAnnual, eventLabel: activeEvents[0].label, employer };
  }

  // 2. Employment history
  const activeRoles = (person.employmentHistory || [])
    .filter(r => r.startDate && new Date(r.startDate) <= d && (!r.endDate || new Date(r.endDate) > d))
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  if (activeRoles.length > 0)
    return { grossAnnual: activeRoles[0].grossAnnual, eventLabel: null, employer: activeRoles[0].employer || null };

  // 3. Fallback — if employment history exists but date is before any role started
  const allRoles = person.employmentHistory || [];
  if (allRoles.length > 0) {
    const dateStr       = d.toISOString().slice(0, 10);
    const earliestStart = allRoles.reduce((min, r) => r.startDate && r.startDate < min ? r.startDate : min, '9999-99-99');
    if (dateStr < earliestStart) return { grossAnnual: 0, eventLabel: null, employer: null };
  }
  return { grossAnnual: person.grossAnnual, eventLabel: null, employer: null };
}

export function calcFortnightlyIncomeAt(people, date) {
  return (people || []).reduce((sum, p) => {
    const { grossAnnual } = getPersonIncomeAt(p, date);
    const net = calcNetPay({ ...p, grossAnnual }).netFortnightly;
    return sum + net + secondaryIncomeFn(p.secondaryIncomes);
  }, 0);
}

export function calcFortnightlyAssetIncome(assetIncomes) {
  return (assetIncomes || []).reduce((sum, a) => sum + toFortnightly(a.amount, a.frequency), 0);
}

export function calcFortnightlyExpenses(expenses) {
  return (expenses || []).reduce((sum, e) => sum + toFortnightly(e.amount, e.frequency), 0);
}

export function calcFortnightlyExpensesAt(expenses, date) {
  const dateStr = typeof date === 'string' ? date : date.toISOString().slice(0, 10);
  return (expenses || []).reduce((sum, e) => {
    if (e.startDate && e.startDate > dateStr) return sum;
    if (e.endDate   && e.endDate   < dateStr) return sum;
    return sum + toFortnightly(e.amount, e.frequency);
  }, 0);
}

// ── Savings trajectory ───────────────────────────────────────────────────────

export function buildSavingsTrajectory(state) {
  const { people, expenses, fortnightlyData, accounts, assetIncomes } = state;
  const fnAssetIncome = calcFortnightlyAssetIncome(assetIncomes);

  const now = new Date();
  const currentYear = now.getFullYear();
  const allYears = Array.from({ length: 6 }, (_, i) => currentYear - 1 + i);

  const rows = [];
  for (const year of allYears) {
    const yd = fortnightlyData[year] || { fortnights: {} };
    for (let i = 0; i < 26; i++) {
      const ft = (yd.fortnights || {})[i] || { adhocTransactions: [] };
      const adhoc = (ft.adhocTransactions || []).reduce((s, t) => s + (t.amount || 0), 0);
      const { start, end } = getFortnight(year, i);
      const midDate = new Date((start.getTime() + end.getTime()) / 2);
      const fnIncomeAt   = calcFortnightlyIncomeAt(people, midDate) + fnAssetIncome;
      const fnExpensesAt = calcFortnightlyExpensesAt(expenses, midDate);
      rows.push({ date: start.toISOString().slice(0, 10), actual: fnIncomeAt - fnExpensesAt + adhoc, balance: 0, year, idx: i, start, end });
    }
  }

  let anchorIdx = rows.findIndex(r => now >= r.start && now <= r.end);
  if (anchorIdx < 0) {
    anchorIdx = rows.findIndex(r => r.start > now);
    if (anchorIdx < 0) anchorIdx = rows.length - 1;
  }

  const currentBal = totalBalance(accounts);
  rows[anchorIdx].balance = currentBal;
  for (let i = anchorIdx + 1; i < rows.length; i++)
    rows[i].balance = rows[i - 1].balance + rows[i].actual;
  for (let i = anchorIdx - 1; i >= 0; i--)
    rows[i].balance = rows[i + 1].balance - rows[i + 1].actual;

  return rows.map(r => ({ date: r.date, balance: Math.round(r.balance * 100) / 100, year: r.year, idx: r.idx }));
}

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
