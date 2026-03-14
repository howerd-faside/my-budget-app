/**
 * @fileoverview Domain model for a savings goal.
 *
 * Goals are stored in the finance domain slice. Unlike most models, there is no
 * dedicated CRUD page — goals are managed inline on the Dashboard via GoalsSection.
 *
 * `amount` is the target savings amount. `saved` tracks manual progress (currently
 * unused by the UI — trajectory-based projection is used instead).
 *
 * Numeric normalization:
 *   `normalizeGoal` coerces `amount` and `saved` to numbers (0 if absent).
 *   `createGoal` retains `''` defaults for form binding.
 */

export interface Goal {
  id: string;
  name: string;
  amount: number;
  targetDate: string;
  saved: number;
  notes: string;
}

export function createGoal(overrides: any = {}) {
  return {
    id:         '',
    name:       '',
    amount:     '',
    targetDate: '',
    saved:      0,
    notes:      '',
    ...overrides,
  };
}

function toNum(val: any): number {
  const n = parseFloat(val);
  return isFinite(n) ? n : 0;
}

export function normalizeGoal(raw: any = {}): Goal {
  return createGoal({
    id:         raw.id         ?? '',
    name:       raw.name       ?? '',
    amount:     toNum(raw.amount),
    targetDate: raw.targetDate ?? '',
    saved:      toNum(raw.saved),
    notes:      raw.notes      ?? '',
  });
}
