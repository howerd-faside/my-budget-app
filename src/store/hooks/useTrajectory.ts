import { useMemo } from 'react';
import { useFinance } from './useFinance';
import { usePeople }  from './usePeople';
import { totalBalance, buildSavingsTrajectory } from '../../utils/finance/savings';
import type { TrajectoryPoint } from '../../utils/finance/savings';

export interface TrajectoryResult {
  trajectory:     TrajectoryPoint[];
  currentBalance: number;
}

/* ── Module-level deduplication cache ───────────────────────────────────────
 * Multiple hooks (useSavingsPosition, useGoalsSummary, useWishlistSummary)
 * each call useTrajectory() within the same render cycle.  Each instance has
 * its own useMemo, but this module-scoped cache ensures buildSavingsTrajectory
 * runs at most once per unique set of store-slice references.
 *
 * Within a single React render pass Zustand returns the same reference for
 * each slice, so the second and third callers always hit the cache.
 */
let _cacheKey: unknown[] = [];
let _cacheVal: TrajectoryPoint[] = [];

/**
 * Shared derived hook — full savings trajectory computed once per render cycle.
 *
 * Wraps buildSavingsTrajectory with a module-level reference-equality cache
 * so that useSavingsPosition, useGoalsSummary and useWishlistSummary share a
 * single trajectory build instead of each rebuilding independently.
 */
export function useTrajectory(): TrajectoryResult {
  const { accounts, fortnightlyData, assetIncomes } = useFinance();
  const { people, expenses }                        = usePeople();

  const trajectory = useMemo(() => {
    const key = [accounts, people, expenses, fortnightlyData, assetIncomes];
    if (key.every((v, i) => v === _cacheKey[i])) return _cacheVal;
    _cacheKey = key;
    _cacheVal = buildSavingsTrajectory({ accounts, people, expenses, fortnightlyData, assetIncomes });
    return _cacheVal;
  }, [accounts, people, expenses, fortnightlyData, assetIncomes]);

  const currentBalance = useMemo(() => totalBalance(accounts), [accounts]);

  return { trajectory, currentBalance };
}
