/**
 * Derived helpers — pure functions used across multiple pages.
 *
 * These are not store-coupled. They live here as a stable shared home
 * until a dedicated utils module is created.
 *
 * For state access, import from domain hooks:
 *   import { useFinance }    from './store/hooks';
 *   import { usePeople }     from './store/hooks';
 *   import { useProperty }   from './store/hooks';
 *   import { useInvestment } from './store/hooks';
 */

import { calcNetPay } from './utils/tax';
import { toFortnightly } from './utils/finance/frequency';
import { getFortnight as _getFortnight } from './utils/finance/dates';

// ── Derived helpers ──────────────────────────────────────────────────────────

export function totalBalance(accounts) {
  return (accounts || []).reduce((s, a) => s + (a.balance || 0), 0);
}

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
    // grossAnnual is guaranteed numeric after normalization — no + coercion needed.
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

export const getFortnight = _getFortnight;

export function buildSavingsTrajectory(state) {
  const { people, expenses, fortnightlyData, accounts, assetIncomes } = state;
  const fnAssetIncome = calcFortnightlyAssetIncome(assetIncomes);

  const allYears = [2025, 2026, 2027, 2028, 2029, 2030];
  const now = new Date();

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
