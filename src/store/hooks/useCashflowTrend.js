import { useMemo } from 'react';
import { useFinance } from './useFinance';
import { usePeople }  from './usePeople';
import {
  calcFortnightlyIncomeAt,
  calcFortnightlyExpensesAt,
  calcFortnightlyAssetIncome,
  getFortnight,
} from '../../store';

const FORTNIGHTS_BACK = 25; // current fortnight + 25 prior = 26 total

/**
 * Derived hook — fortnightly net cashflow for the last 26 fortnights.
 *
 * Each point represents one fortnight. The cashflow value is:
 *   calcFortnightlyIncomeAt + assetIncome − calcFortnightlyExpensesAt + adhoc
 * evaluated at the midpoint of each fortnight, so income events and
 * date-bounded expenses are applied correctly.
 *
 * Local calendar dates are used throughout to avoid UTC off-by-one errors
 * in UTC+ timezones.
 *
 * Returns:
 *   points   — array of { date: 'YYYY-MM-DD', cashflow: number }
 *              date = LOCAL start date of each fortnight
 *   hasData  — false when all cashflows are zero (no income/expense configured)
 */
export function useCashflowTrend() {
  const { fortnightlyData, assetIncomes } = useFinance();
  const { people, expenses }              = usePeople();

  return useMemo(() => {
    const fnAssetIncome = calcFortnightlyAssetIncome(assetIncomes);
    const now = new Date();

    // ── Find current fortnight ───────────────────────────────────────────────
    let curYear = now.getFullYear();
    let curIdx  = 25; // fallback: last fortnight of year
    for (let i = 0; i < 26; i++) {
      const { start, end } = getFortnight(curYear, i);
      if (now >= start && now <= end) { curIdx = i; break; }
    }

    // ── Build ordered list of last 26 fortnights ─────────────────────────────
    const fnList = [];
    let y = curYear, idx = curIdx;
    for (let n = 0; n <= FORTNIGHTS_BACK; n++) {
      fnList.unshift({ year: y, idx });
      if (idx > 0) { idx--; } else { y--; idx = 25; }
    }

    // ── Compute cashflow per fortnight ───────────────────────────────────────
    const points = fnList.map(({ year, idx: i }) => {
      const { start, end } = getFortnight(year, i);
      const midDate = new Date((start.getTime() + end.getTime()) / 2);

      const yd    = (fortnightlyData || {})[year] || { fortnights: {} };
      const ft    = (yd.fortnights || {})[i] || {};
      const adhoc = (ft.adhocTransactions || []).reduce((s, t) => s + (t.amount || 0), 0);

      const cashflow =
        calcFortnightlyIncomeAt(people, midDate) +
        fnAssetIncome -
        calcFortnightlyExpensesAt(expenses, midDate) +
        adhoc;

      // Use LOCAL date to avoid UTC month-boundary shift in UTC+ timezones
      const dateStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
      return { date: dateStr, cashflow: Math.round(cashflow * 100) / 100 };
    });

    const hasData = points.some(p => p.cashflow !== 0);
    return { points, hasData };
  }, [people, expenses, assetIncomes, fortnightlyData]);
}
