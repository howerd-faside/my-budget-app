import { useMemo } from 'react';
import { useFinance } from './useFinance';
import { usePeople }  from './usePeople';
import {
  totalBalance, buildSavingsTrajectory,
  calcFortnightlyIncomeAt, calcFortnightlyAssetIncome, calcFortnightlyExpensesAt,
} from '../../store';

/**
 * Derived hook — current and near-term savings position.
 *
 * Uses buildSavingsTrajectory as the canonical source so all balances are
 * consistent with the existing trajectory chart on Dashboard. The trajectory
 * is anchored to totalBalance(accounts) at the current fortnight, projecting
 * forward using date-aware income and expense helpers.
 *
 * Returns:
 *   currentBalance    — totalBalance(accounts); same anchor used by trajectory
 *   yearEndBalance    — projected balance at end of current calendar year
 *   fortnightlyCashflow — net cashflow per fortnight at current rates;
 *                         matches the Household Snapshot "Net Cashflow" tile
 *   sparkline         — array of { month: 'YYYY-MM', balance } for the next
 *                       12 calendar months (one point per month, first fortnight)
 */
export function useSavingsPosition() {
  const { accounts, fortnightlyData, assetIncomes } = useFinance();
  const { people, expenses }                        = usePeople();

  return useMemo(() => {
    const currentBalance = totalBalance(accounts);

    const trajectory = buildSavingsTrajectory({
      people, expenses, fortnightlyData, accounts, assetIncomes,
    });

    // ── Year-end projected balance ───────────────────────────────────────────
    const thisYear    = new Date().getFullYear().toString();
    const yearPoints  = trajectory.filter(p => p.date.startsWith(thisYear));
    const yearEndBalance = yearPoints.length > 0
      ? yearPoints[yearPoints.length - 1].balance
      : currentBalance;

    // ── Sparkline: next 12 calendar months, first fortnight per month ────────
    const todayStr  = new Date().toISOString().slice(0, 10);
    const monthMap  = new Map();
    for (const p of trajectory) {
      if (p.date < todayStr) continue;
      const month = p.date.slice(0, 7);
      if (!monthMap.has(month)) monthMap.set(month, Math.round(p.balance));
    }
    const sparkline = Array.from(monthMap.entries())
      .slice(0, 12)
      .map(([month, balance]) => ({ month, balance }));

    // Fortnightly cashflow at current rates — matches Household Snapshot.
    const now = new Date();
    const fnNet =
      calcFortnightlyIncomeAt(people, now) +
      calcFortnightlyAssetIncome(assetIncomes) -
      calcFortnightlyExpensesAt(expenses, now);
    const fortnightlyCashflow = Math.round(fnNet * 100) / 100;

    return { currentBalance, yearEndBalance, fortnightlyCashflow, sparkline };
  }, [accounts, people, expenses, fortnightlyData, assetIncomes]);
}
