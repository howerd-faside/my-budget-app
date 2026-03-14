import { useMemo } from 'react';
import { useMortgageFacilities } from './useMortgageFacilities';
import { buildAmortSchedule } from '../../utils/finance/mortgage';

/**
 * Derived hook — aggregate amortisation datasets for all mortgage facilities.
 *
 * Schedules are computed once per facility and then aligned into shared annual
 * time buckets before summing. Facilities with different remaining terms are
 * handled by padding shorter schedules with zeros once they are fully repaid
 * — the total columns reflect this naturally (a paid-off facility stops
 * contributing balance, interest, and principal).
 *
 * Assumptions:
 *   - Revolving facilities are treated as standard P&I for projection purposes:
 *     the schedule shows what happens if the stated repayment is applied every
 *     fortnight without any redraws. This gives a conservative "if you repay
 *     at this rate" view rather than modelling actual revolving behaviour.
 *   - Interest-only facilities will not amortise: buildAmortSchedule returns
 *     an empty array if the payment does not exceed the interest charge, so
 *     they are excluded from chart data silently.
 *   - amountFn is used for all facilities (fortnightly-normalised) rather than
 *     the raw f.amount, correcting a defect in the original Mortgage.jsx which
 *     assumed all facility amounts were already fortnightly.
 *
 * Returns:
 *   facilities   — normalised facility array from useMortgageFacilities;
 *                  index i corresponds to key `fi` in each balanceData row,
 *                  enabling chart components to build per-facility legends
 *   balanceData  — annual balance samples aligned across all facilities:
 *                  [{ year, f0, f1, …, total }, …]
 *                  year 0 = today (starting balances); year N = N years from now.
 *                  `fi` is 0 when facility i is fully repaid at that year.
 *   piData       — annual principal vs interest aggregated across all facilities:
 *                  [{ year, interest, principal }, …]
 *                  year 0 (initial snapshot, no annual flow yet) is excluded.
 *   hasData      — true when at least one facility produced a non-trivial schedule
 */
export function useMortgageAmortisation() {
  const { facilities } = useMortgageFacilities();

  return useMemo(() => {
    if (facilities.length === 0) {
      return { facilities, balanceData: [], piData: [], hasData: false };
    }

    // ── Build one schedule per facility ────────────────────────────────────
    // schedules[i] is the annual amortisation array for facilities[i].
    // Each entry: { year, balance, annualInterest, annualPrincipal, … }
    // year 0 = starting point (balance only, annual flows are 0).
    const schedules = facilities.map(f =>
      buildAmortSchedule(+f.balance, +f.rate, f.amountFn)
    );

    // Facilities that produced no schedule (IO or insufficient payment) are
    // represented as empty arrays and contribute zeros to aggregates below.
    const maxLen = Math.max(...schedules.map(s => s.length), 0);

    if (maxLen === 0) {
      return { facilities, balanceData: [], piData: [], hasData: false };
    }

    // ── Balance over time ──────────────────────────────────────────────────
    // One row per year (0 … maxLen-1). Each `fi` column is the balance for
    // facility i at that year, zero-padded once the facility is cleared.
    const balanceData = Array.from({ length: maxLen }, (_, i) => {
      const row = { year: i };
      schedules.forEach((s, fi) => {
        row[`f${fi}`] = i < s.length ? Math.round(s[i].balance) : 0;
      });
      row.total = schedules.reduce((sum, _s, fi) => sum + (row[`f${fi}`] || 0), 0);
      return row;
    });

    // ── P&I split over time ────────────────────────────────────────────────
    // Year 0 is the initial snapshot (annualInterest/annualPrincipal are 0
    // in buildAmortSchedule's year-0 entry) so it is excluded.
    // For years beyond a facility's term, that facility contributes 0 to
    // both columns — handled by the bounds check on `i < s.length`.
    const piData = Array.from({ length: maxLen }, (_, i) => ({
      year: i,
      interest:  Math.round(schedules.reduce((sum, s) => sum + (i < s.length ? (s[i].annualInterest  || 0) : 0), 0)),
      principal: Math.round(schedules.reduce((sum, s) => sum + (i < s.length ? (s[i].annualPrincipal || 0) : 0), 0)),
    })).filter(d => d.year > 0);

    return {
      facilities,
      balanceData,
      piData,
      hasData: maxLen > 1,
    };
  }, [facilities]);
}
