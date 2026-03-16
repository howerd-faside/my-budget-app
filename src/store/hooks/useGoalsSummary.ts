import { useMemo } from 'react';
import { useFinance } from './useFinance';
import { useTrajectory } from './useTrajectory';
import { findGoalHit } from '../../utils/finance/savings';

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
 * Uses the shared useTrajectory hook so the trajectory is computed at most
 * once per render cycle, shared with useSavingsPosition and useWishlistSummary.
 *
 * progressPct = min(100, round(currentBalance / goalAmount * 100))
 * hitDate = first trajectory point where balance >= goal.amount (via findGoalHit)
 */
export function useGoalsSummary(): GoalsSummary {
  const { goals: rawGoals } = useFinance();
  const { trajectory, currentBalance } = useTrajectory();

  return useMemo(() => {
    const goalList = rawGoals || [];
    if (goalList.length === 0) {
      return { goals: [] as GoalProgress[], hasGoals: false };
    }

    const goals: GoalProgress[] = goalList.map(g => {
      const amount      = g.amount || 0;
      const progressPct = amount > 0 ? Math.min(100, Math.round(currentBalance / amount * 100)) : 0;
      const hitDate     = findGoalHit(trajectory, g);
      return { id: g.id, name: g.name, amount, progressPct, hitDate };
    });

    return { goals, hasGoals: true };
  }, [rawGoals, trajectory, currentBalance]);
}
