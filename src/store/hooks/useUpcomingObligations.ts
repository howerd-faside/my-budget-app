import { useMemo } from 'react';
import { usePeople } from './usePeople';
import { useMortgageFacilities } from './useMortgageFacilities';
import { today, daysBetween } from '../../utils/finance/dates';

export interface ObligationItem {
  id:        string;
  icon:      string;
  label:     string;
  detail?:   string;
  severity:  'info' | 'warn' | 'urgent';
}

export interface UpcomingObligations {
  items:    ObligationItem[];
  hasItems: boolean;
}

/**
 * Derived hook — upcoming financial obligations and date-backed events.
 *
 * Obligation types surfaced:
 *   1. Mortgage fixed-rate expiry  (within 180 days)
 *   2. Income events starting/ending (within 90 days)
 *   3. Recurring expenses ending   (within 90 days)
 *
 * Items are sorted by severity then proximity.
 * Property task alerts are NOT included — those live in usePropertyAlerts.
 */
export function useUpcomingObligations(): UpcomingObligations {
  const { people, expenses } = usePeople();
  const { facilities }       = useMortgageFacilities();

  return useMemo(() => {
    const NOW = today();
    const items: ObligationItem[] = [];

    // ── 1. Mortgage fixed-rate expiries (180 days) ────────────────────────────
    for (const f of facilities) {
      if (f.rateType !== 'fixed' || !f.fixedTermExpiry) continue;
      const d = daysBetween(NOW, f.fixedTermExpiry);
      if (d < 0 || d > 180) continue;
      items.push({
        id:       `fix-expiry-${f.id}`,
        icon:     'mortgage',
        label:    `${f.loanName} — ${f.label} fixed rate expires`,
        detail:   d <= 30 ? `${d}d` : `~${Math.round(d / 30)}mo`,
        severity: d <= 30 ? 'urgent' : d <= 90 ? 'warn' : 'info',
      });
    }

    // ── 2. Income events starting or ending (90 days) ─────────────────────────
    for (const person of (people || [])) {
      for (const ev of (person.incomeEvents || [])) {
        if (ev.startDate) {
          const d = daysBetween(NOW, ev.startDate);
          if (d > 0 && d <= 90) {
            items.push({
              id:       `income-start-${ev.id}`,
              icon:     'calendar',
              label:    `${person.name} — ${ev.label} starts`,
              detail:   `${d}d`,
              severity: d <= 14 ? 'warn' : 'info',
            });
          }
        }
        if (ev.endDate) {
          const d = daysBetween(NOW, ev.endDate);
          if (d > 0 && d <= 90) {
            items.push({
              id:       `income-end-${ev.id}`,
              icon:     'calendar',
              label:    `${person.name} — ${ev.label} ends`,
              detail:   `${d}d`,
              severity: d <= 14 ? 'warn' : 'info',
            });
          }
        }
      }
    }

    // ── 3. Recurring expenses ending (90 days) ────────────────────────────────
    for (const exp of (expenses || [])) {
      if (exp.type !== 'standard' || !exp.endDate) continue;
      const d = daysBetween(NOW, exp.endDate);
      if (d > 0 && d <= 90) {
        items.push({
          id:       `exp-end-${exp.id}`,
          icon:     'wallet',
          label:    `${exp.name} expires`,
          detail:   `${d}d`,
          severity: d <= 14 ? 'warn' : 'info',
        });
      }
    }

    // Sort: urgent first, then warn, then info
    const ORDER = { urgent: 0, warn: 1, info: 2 } as const;
    items.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);

    return { items, hasItems: items.length > 0 };
  }, [people, expenses, facilities]);
}
