import { monthsBetween, getFortnight } from './dates';
import { calcNetPay } from './tax';
import { toFortnightly } from './frequency';

import type { Account }               from '../../models/Account';
import type { Person, AssetIncome }    from '../../models/Person';
import type { Expense }                from '../../models/Expense';
import type { FortnightlyData }        from '../../models/FortnightlyData';
import type { Goal }                   from '../../models/Goal';

// ── Account helpers ──────────────────────────────────────────────────────────

export function totalBalance(accounts: Account[]): number {
  return (accounts || []).reduce((s, a) => s + (a.balance || 0), 0);
}

// ── Income / expense helpers ─────────────────────────────────────────────────

function secondaryIncomeFn(secondaryIncomes: Person['secondaryIncomes']): number {
  return (secondaryIncomes || []).reduce((s, si) => s + toFortnightly(si.amount, si.frequency), 0);
}

export function calcFortnightlyIncome(people: Person[]): number {
  return (people || []).reduce((sum, p) => {
    const net = calcNetPay(p).netFortnightly;
    return sum + net + secondaryIncomeFn(p.secondaryIncomes);
  }, 0);
}

export interface PersonIncomeSnapshot {
  grossAnnual: number;
  eventLabel: string | null;
  employer: string | null;
}

/**
 * Returns the applicable grossAnnual for a person at a given date.
 * Priority: income events > employment history > person.grossAnnual fallback.
 */
export function getPersonIncomeAt(person: Person, date: Date | string): PersonIncomeSnapshot {
  const d = typeof date === 'string' ? new Date(date) : date;

  // 1. Income events
  const activeEvents = (person.incomeEvents || [])
    .filter(e => e.startDate && new Date(e.startDate) <= d && (!e.endDate || new Date(e.endDate) > d))
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  if (activeEvents.length > 0) {
    const activeRoles = (person.employmentHistory || [])
      .filter((r: any) => r.startDate && new Date(r.startDate) <= d && (!r.endDate || new Date(r.endDate) > d))
      .sort((a: any, b: any) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    const employer = activeRoles.length > 0 ? (activeRoles[0].employer || null) : null;
    return { grossAnnual: activeEvents[0].grossAnnual, eventLabel: activeEvents[0].label, employer };
  }

  // 2. Employment history
  const activeRoles = (person.employmentHistory || [])
    .filter((r: any) => r.startDate && new Date(r.startDate) <= d && (!r.endDate || new Date(r.endDate) > d))
    .sort((a: any, b: any) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  if (activeRoles.length > 0)
    return { grossAnnual: activeRoles[0].grossAnnual, eventLabel: null, employer: activeRoles[0].employer || null };

  // 3. Fallback — if employment history exists but date is before any role started
  const allRoles = person.employmentHistory || [];
  if (allRoles.length > 0) {
    const dateStr       = d.toISOString().slice(0, 10);
    const earliestStart = allRoles.reduce((min: string, r: any) => r.startDate && r.startDate < min ? r.startDate : min, '9999-99-99');
    if (dateStr < earliestStart) return { grossAnnual: 0, eventLabel: null, employer: null };
  }
  return { grossAnnual: person.grossAnnual, eventLabel: null, employer: null };
}

export function calcFortnightlyIncomeAt(people: Person[], date: Date | string): number {
  return (people || []).reduce((sum, p) => {
    const { grossAnnual } = getPersonIncomeAt(p, date);
    const net = calcNetPay({ ...p, grossAnnual }).netFortnightly;
    return sum + net + secondaryIncomeFn(p.secondaryIncomes);
  }, 0);
}

export function calcFortnightlyAssetIncome(assetIncomes: AssetIncome[]): number {
  return (assetIncomes || []).reduce((sum, a) => sum + toFortnightly(a.amount, a.frequency), 0);
}

export function calcFortnightlyExpenses(expenses: Expense[]): number {
  return (expenses || []).reduce((sum, e) => sum + toFortnightly(e.amount, e.frequency), 0);
}

export function calcFortnightlyExpensesAt(expenses: Expense[], date: Date | string): number {
  const dateStr = typeof date === 'string' ? date : date.toISOString().slice(0, 10);
  return (expenses || []).reduce((sum, e) => {
    if (e.startDate && e.startDate > dateStr) return sum;
    if (e.endDate   && e.endDate   < dateStr) return sum;
    return sum + toFortnightly(e.amount, e.frequency);
  }, 0);
}

// ── Savings trajectory ───────────────────────────────────────────────────────

export interface TrajectoryPoint {
  date: string;
  balance: number;
  year: number;
  idx: number;
}

interface TrajectoryInput {
  people: Person[];
  expenses: Expense[];
  fortnightlyData: FortnightlyData;
  accounts: Account[];
  assetIncomes: AssetIncome[];
}

export function buildSavingsTrajectory(state: TrajectoryInput): TrajectoryPoint[] {
  const { people, expenses, fortnightlyData, accounts, assetIncomes } = state;
  const fnAssetIncome = calcFortnightlyAssetIncome(assetIncomes);

  const now = new Date();
  const currentYear = now.getFullYear();
  const allYears = Array.from({ length: 100 }, (_, i) => currentYear - 1 + i);

  interface InternalRow {
    date: string;
    actual: number;
    balance: number;
    year: number;
    idx: number;
    start: Date;
    end: Date;
  }

  const rows: InternalRow[] = [];
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

export type AffordabilityCategory = 'now' | 'soon' | 'later' | 'far' | 'beyond' | 'unknown';

/**
 * Returns an affordability category for a wishlist item given the savings trajectory.
 */
export function affordabilityStatus(cost: number, currentBalance: number, trajectory: TrajectoryPoint[]): AffordabilityCategory {
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
 */
export function affordabilityDate(cost: number, currentBalance: number, trajectory: TrajectoryPoint[]): string | null {
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
export function findGoalHit(trajectory: TrajectoryPoint[], goal: Goal): string | null {
  const hit = trajectory.find(p => p.balance >= (goal.amount || 0));
  return hit?.date.slice(0, 7) || null;
}

