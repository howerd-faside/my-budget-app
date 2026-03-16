import { useMemo } from 'react';
import { usePeople }  from './usePeople';
import { useTrajectory } from './useTrajectory';
import { affordabilityDate } from '../../utils/finance/savings';

export interface WishlistSummary {
  pendingCount:     number;
  totalPendingCost: number;
  affordableNow:    number;
  nextAffordable:   string | null;   // human-readable label, e.g. "~3 months"
  hasWishlist:      boolean;
}

/**
 * Derived hook — compact wishlist summary for dashboard display.
 *
 * Uses the shared useTrajectory hook so the trajectory is computed at most
 * once per render cycle, shared with useSavingsPosition and useGoalsSummary.
 */
export function useWishlistSummary(): WishlistSummary {
  const { wishlist } = usePeople();
  const { trajectory, currentBalance } = useTrajectory();

  return useMemo(() => {
    const items   = wishlist || [];
    const pending = items.filter(i => !i.purchased);

    if (items.length === 0) {
      return {
        pendingCount: 0, totalPendingCost: 0, affordableNow: 0,
        nextAffordable: null as string | null, hasWishlist: false,
      };
    }

    const totalPendingCost = pending.reduce((s, i) => s + (+i.estimatedCost || 0), 0);
    const affordableNow    = pending.filter(i => {
      const cost = +i.estimatedCost || 0;
      return cost > 0 && currentBalance >= cost;
    }).length;

    // Find the next soonest affordable item (not currently affordable)
    let nextAffordable: string | null = null;
    const notYet = pending.filter(i => {
      const cost = +i.estimatedCost || 0;
      return cost > 0 && currentBalance < cost;
    });

    if (notYet.length > 0) {
      const soonest = notYet
        .map(i => ({
          item: i,
          hit: trajectory.find(p => p.balance >= (+i.estimatedCost || 0)),
        }))
        .filter(e => e.hit)
        .sort((a, b) => a.hit!.date.localeCompare(b.hit!.date))[0];

      if (soonest) {
        nextAffordable = affordabilityDate(
          +soonest.item.estimatedCost || 0,
          currentBalance,
          trajectory,
        );
      }
    }

    return {
      pendingCount: pending.length,
      totalPendingCost,
      affordableNow,
      nextAffordable,
      hasWishlist: true,
    };
  }, [wishlist, trajectory, currentBalance]);
}
