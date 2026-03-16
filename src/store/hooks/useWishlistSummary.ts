import { useMemo } from 'react';
import { useFinance } from './useFinance';
import { usePeople }  from './usePeople';
import {
  totalBalance, buildSavingsTrajectory, affordabilityDate,
} from '../../utils/finance/savings';

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
 * Reuses the same affordability helpers as Wishlist.jsx:
 *   - currentBalance via totalBalance(accounts)
 *   - trajectory via buildSavingsTrajectory
 *   - affordabilityDate for human-readable next-affordable label
 */
export function useWishlistSummary(): WishlistSummary {
  const { accounts, fortnightlyData, assetIncomes } = useFinance();
  const { people, expenses, wishlist }               = usePeople();

  return useMemo(() => {
    const items   = wishlist || [];
    const pending = items.filter(i => !i.purchased);

    if (items.length === 0) {
      return {
        pendingCount: 0, totalPendingCost: 0, affordableNow: 0,
        nextAffordable: null, hasWishlist: false,
      };
    }

    const currentBal     = totalBalance(accounts);
    const totalPendingCost = pending.reduce((s, i) => s + (+i.estimatedCost || 0), 0);
    const affordableNow    = pending.filter(i => {
      const cost = +i.estimatedCost || 0;
      return cost > 0 && currentBal >= cost;
    }).length;

    // Find the next soonest affordable item (not currently affordable)
    let nextAffordable: string | null = null;
    const notYet = pending.filter(i => {
      const cost = +i.estimatedCost || 0;
      return cost > 0 && currentBal < cost;
    });

    if (notYet.length > 0) {
      const trajectory = buildSavingsTrajectory({
        people, expenses, fortnightlyData, accounts, assetIncomes,
      });

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
          currentBal,
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
  }, [accounts, people, expenses, wishlist, fortnightlyData, assetIncomes]);
}
