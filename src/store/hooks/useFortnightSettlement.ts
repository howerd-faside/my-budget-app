/**
 * useFortnightSettlement — auto-settles completed fortnights into the main account.
 *
 * When the current fortnight advances past `lastSettledFortnight`, this hook
 * calculates the projected net savings for each intervening fortnight and adds
 * the total to the primary (main) account balance.
 *
 * This keeps the account balance in sync with the trajectory projections, so
 * backward-propagated historical balances remain stable across fortnight transitions.
 */
import { useEffect, useRef } from 'react';
import { useFinanceStore }   from '../financeStore';
import { usePeopleStore }    from '../peopleStore';
import { getFortnight }      from '../../utils/finance/dates';
import {
  calcFortnightlyIncomeAt,
  calcFortnightlyExpensesAt,
  calcFortnightlyAssetIncome,
} from '../../utils/finance/savings';

import type { FortnightRef } from '../financeStore';

// ── Fortnight arithmetic ────────────────────────────────────────────────────

function getCurrentFortnight(): FortnightRef | null {
  const now  = new Date();
  const year = now.getFullYear();
  for (let i = 0; i < 26; i++) {
    const { start, end } = getFortnight(year, i);
    if (now >= start && now <= end) return { year, idx: i };
  }
  // Jan 1–4 may still fall in the previous year's last fortnight
  for (let i = 25; i >= 0; i--) {
    const { start, end } = getFortnight(year - 1, i);
    if (now >= start && now <= end) return { year: year - 1, idx: i };
  }
  return null;
}

function prevFn(fn: FortnightRef): FortnightRef {
  return fn.idx > 0
    ? { year: fn.year, idx: fn.idx - 1 }
    : { year: fn.year - 1, idx: 25 };
}

function nextFn(fn: FortnightRef): FortnightRef {
  return fn.idx < 25
    ? { year: fn.year, idx: fn.idx + 1 }
    : { year: fn.year + 1, idx: 0 };
}

function fnKey(fn: FortnightRef): number {
  return fn.year * 26 + fn.idx;
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useFortnightSettlement() {
  // Track the lastSettled key that was used for the most recent settlement,
  // so we re-run if data is imported/reset (which changes lastSettled externally).
  const settledKey = useRef<string | null>(null);

  // Pull state selectors individually to avoid unnecessary re-renders
  const lastSettled     = useFinanceStore(s => s.lastSettledFortnight);
  const fortnightlyData = useFinanceStore(s => s.fortnightlyData);
  const assetIncomes    = useFinanceStore(s => s.assetIncomes);
  const settle          = useFinanceStore(s => s.settleFortnight);

  const people   = usePeopleStore(s => s.people);
  const expenses = usePeopleStore(s => s.expenses);

  useEffect(() => {
    const current = getCurrentFortnight();
    if (!current) return;

    // Build a key from lastSettled to detect external changes (import/reset)
    const lsKey = lastSettled ? `${lastSettled.year}:${lastSettled.idx}` : 'null';

    // Skip if we already settled for this exact lastSettled value
    if (settledKey.current === lsKey) return;

    // First time after upgrade: assume the user's balance was anchored at the
    // previous fortnight, so the first settlement covers one transition.
    const anchor: FortnightRef = lastSettled ?? prevFn(current);

    // Nothing to settle — same or future fortnight
    if (fnKey(current) <= fnKey(anchor)) {
      settledKey.current = lsKey;
      if (!lastSettled) settle(0, current);
      return;
    }

    // Sum actuals for each fortnight from anchor+1 … current (inclusive).
    // This matches the forward-projection formula in buildSavingsTrajectory:
    //   rows[i+1].balance = rows[i].balance + rows[i+1].actual
    const fnAssetIncome = calcFortnightlyAssetIncome(assetIncomes || []);
    let settlement = 0;

    let fn = nextFn(anchor);
    while (fnKey(fn) <= fnKey(current)) {
      const { start, end } = getFortnight(fn.year, fn.idx);
      const midDate = new Date((start.getTime() + end.getTime()) / 2);
      const income  = calcFortnightlyIncomeAt(people, midDate) + fnAssetIncome;
      const exp     = calcFortnightlyExpensesAt(expenses, midDate);

      const yd    = fortnightlyData[fn.year] || { fortnights: {} };
      const ft    = ((yd as any).fortnights || {})[fn.idx] || { adhocTransactions: [] };
      const adhoc = (ft.adhocTransactions || []).reduce(
        (s: number, t: any) => s + (t.amount || 0), 0
      );

      settlement += income - exp + adhoc;
      fn = nextFn(fn);
    }

    settledKey.current = lsKey;
    settle(settlement, current);
  }, [lastSettled, fortnightlyData, assetIncomes, people, expenses, settle]);
}
