import { useMemo } from 'react';
import { useFinance } from './useFinance';
import { usePeople }  from './usePeople';
import {
  totalBalance, buildSavingsTrajectory, findGoalHit,
} from '../../utils/finance/savings';

export interface GoalProgress {
  id:          string;
  name:        string;
  amount:      number;
  progressPct: number;          // 0–100, clamped
  hitDate:     string | null;   // YYYY-MM or null if beyond trajectory
}

export interface GoalsSummary {
  goals:    GoalProgress[];
  hasGoals: boolean;
}

/**
 * Derived hook — savings goals with progress and predicted hit date.
 *
 * Uses the same trajectory + findGoalHit logic as Dashboard.jsx (lines 80-92),
 * but extracted so both Dashboard and Home can share it without duplication.
 *
 * progressPct = min(100, round(currentBalance / goalAmount * 100))
 * hitDate = first trajectory point where balance >= goal.amount (via findGoalHit)
 */
export function useGoalsSummary(): GoalsSummary {
  const { accounts, fortnightlyData, goals: rawGoals, assetIncomes } = useFinance();
  const { people, expenses }                                          = usePeople();

  return useMemo(() => {
    const goalList = rawGoals || [];
    if (goalList.length === 0) {
      return { goals: [], hasGoals: false };
    }

    const currentBal = totalBalance(accounts);
    const trajectory = buildSavingsTrajectory({
      people, expenses, fortnightlyData, accounts, assetIncomes,
    });

    const goals: GoalProgress[] = goalList.map(g => {
      const amount      = g.amount || 0;
      const progressPct = amount > 0 ? Math.min(100, Math.round(currentBal / amount * 100)) : 0;
      const hitDate     = findGoalHit(trajectory, g);
      return { id: g.id, name: g.name, amount, progressPct, hitDate };
    });

    return { goals, hasGoals: true };
  }, [accounts, people, expenses, rawGoals, fortnightlyData, assetIncomes]);
}
