import { useMemo } from 'react';
import { useMortgageFacilities } from './useMortgageFacilities';
import { buildAmortSchedule } from '../../utils/finance/mortgage';

import type { NormalisedFacility } from './useMortgageFacilities';

export interface BalanceRow {
  year: number;
  total: number;
  [facilityKey: `f${number}`]: number;
}

export interface PIRow {
  year: number;
  interest: number;
  principal: number;
}

export interface MortgageAmortisationReturn {
  facilities:  NormalisedFacility[];
  balanceData: BalanceRow[];
  piData:      PIRow[];
  hasData:     boolean;
}

/**
 * Derived hook — aggregate amortisation datasets for all mortgage facilities.
 */
export function useMortgageAmortisation(): MortgageAmortisationReturn {
  const { facilities } = useMortgageFacilities();

  return useMemo(() => {
    if (facilities.length === 0) {
      return { facilities, balanceData: [], piData: [], hasData: false };
    }

    // ── Build one schedule per facility ────────────────────────────────────
    const schedules = facilities.map(f =>
      buildAmortSchedule(+f.balance, +f.rate, f.amountFn)
    );

    const maxLen = Math.max(...schedules.map(s => s.length), 0);

    if (maxLen === 0) {
      return { facilities, balanceData: [], piData: [], hasData: false };
    }

    // ── Balance over time ──────────────────────────────────────────────────
    const balanceData: BalanceRow[] = Array.from({ length: maxLen }, (_, i) => {
      const row: any = { year: i };
      schedules.forEach((s, fi) => {
        row[`f${fi}`] = i < s.length ? Math.round(s[i].balance) : 0;
      });
      row.total = schedules.reduce((sum, _s, fi) => sum + (row[`f${fi}`] || 0), 0);
      return row as BalanceRow;
    });

    // ── P&I split over time ────────────────────────────────────────────────
    const piData: PIRow[] = Array.from({ length: maxLen }, (_, i) => ({
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
