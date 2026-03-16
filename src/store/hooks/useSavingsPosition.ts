import { useMemo } from 'react';
import { useFinance } from './useFinance';
import { usePeople }  from './usePeople';
import { useTrajectory } from './useTrajectory';
import {
  calcFortnightlyIncomeAt, calcFortnightlyAssetIncome, calcFortnightlyExpensesAt,
} from '../../utils/finance/savings';
import { today } from '../../utils/finance/dates';

export interface SparklinePoint {
  month: string;
  balance: number;
}

export interface SavingsPosition {
  currentBalance:      number;
  yearEndBalance:      number;
  fortnightlyCashflow: number;
  sparkline:           SparklinePoint[];
}

/**
 * Derived hook — current and near-term savings position.
 *
 * Uses the shared useTrajectory hook as the canonical source so all balances
 * are consistent with the existing trajectory chart on Dashboard.
 */
export function useSavingsPosition(): SavingsPosition {
  const { assetIncomes }   = useFinance();
  const { people, expenses } = usePeople();
  const { trajectory, currentBalance } = useTrajectory();

  return useMemo(() => {
    // ── Year-end projected balance ───────────────────────────────────────────
    const thisYear    = new Date().getFullYear().toString();
    const yearPoints  = trajectory.filter(p => p.date.startsWith(thisYear));
    const yearEndBalance = yearPoints.length > 0
      ? yearPoints[yearPoints.length - 1].balance
      : currentBalance;

    // ── Sparkline: next 12 calendar months, first fortnight per month ────────
    const todayStr  = today();
    const monthMap  = new Map<string, number>();
    for (const p of trajectory) {
      if (p.date < todayStr) continue;
      const month = p.date.slice(0, 7);
      if (!monthMap.has(month)) monthMap.set(month, Math.round(p.balance));
    }
    const sparkline: SparklinePoint[] = Array.from(monthMap.entries())
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
  }, [trajectory, currentBalance, people, expenses, assetIncomes]);
}
