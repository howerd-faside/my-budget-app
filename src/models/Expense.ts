/**
 * @fileoverview Domain model for recurring expenses and embedded loan facilities.
 *
 * Inconsistencies detected:
 * - `history: []` field is present in the EMPTY template and therefore persisted
 *   to localStorage, but is never written to or read from anywhere in the UI.
 *   It appears to be dead data from an earlier design.
 * - `startDate` is backfilled to '2025-11-10' in store.jsx migrate() for expenses
 *   created before the field was introduced.
 * - `Facility` objects have optional `frequency` and `amount` fields; older facilities
 *   may be missing these entirely. normalizeExpense backfills them.
 * - `forPerson` links to a Person.id but there is no referential-integrity check.
 *
 * Numeric normalization:
 *   `normalize*` functions coerce all financial/numeric fields to their canonical types.
 *   `create*` factories keep `''` defaults for form binding.
 */

export type ExpenseType = 'standard' | 'loan';
export type ExpenseSubtype = 'fixed' | 'variable';
export type RateType = 'fixed' | 'floating' | 'revolving';
export type RepaymentType = 'P&I' | 'IO';

export const FREQUENCIES = ['weekly', 'fortnightly', 'monthly', 'quarterly', 'annual'] as const;
export type Frequency = typeof FREQUENCIES[number];

export const PAYMENT_METHODS = ['Direct Debit', 'Credit Card', 'Bank Transfer', 'Auto-Pay', 'Cash'] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

export const RATE_TYPES = ['fixed', 'floating', 'revolving'] as const;
export const REPAYMENT_TYPES = ['P&I', 'IO'] as const;

// ── Private helpers ──────────────────────────────────────────────────────────

function toNum(val: any, fallback = 0): number {
  const n = parseFloat(val);
  return isFinite(n) ? n : fallback;
}

function toNumOrNull(val: any): number | null {
  if (val === '' || val == null) return null;
  const n = parseFloat(val);
  return isFinite(n) ? n : null;
}

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface Facility {
  id: string;
  label: string;
  balance: number;
  rate: number;
  rateType: RateType;
  repaymentType: RepaymentType;
  fixedTermExpiry: string;
  amount: number;
  frequency: Frequency;
}

export interface Expense {
  id: string;
  name: string;
  category: string;
  type: ExpenseType;
  subtype: ExpenseSubtype;
  amount: number;
  frequency: Frequency;
  paymentMethod: PaymentMethod;
  ddDay: number | null;
  lender: string;
  facilities: Facility[];
  notes: string;
  history: any[];
  startDate: string;
  endDate: string;
  forPerson: string;
}

// ── Factories (form defaults — numeric fields intentionally '' for input binding) ──

export function createFacility(overrides: any = {}) {
  return {
    id:              '',
    label:           '',
    balance:         '',
    rate:            '',
    rateType:        'fixed',
    repaymentType:   'P&I',
    fixedTermExpiry: '',
    amount:          '',
    frequency:       'fortnightly',
    ...overrides,
  };
}

export function createExpense(overrides: any = {}) {
  return {
    id:            '',
    name:          '',
    category:      'Groceries',
    type:          'standard',
    subtype:       'fixed',
    amount:        '',
    frequency:     'monthly',
    paymentMethod: 'Direct Debit',
    ddDay:         '',
    lender:        '',
    facilities:    [],
    notes:         '',
    history:       [], // legacy — never populated
    startDate:     '',
    endDate:       '',
    forPerson:     '',
    ...overrides,
  };
}

// ── Normalizers (storage boundary — all numeric fields coerced to number/null) ──

export function normalizeFacility(raw: any = {}): Facility {
  return createFacility({
    id:              raw.id              ?? '',
    label:           raw.label           ?? '',
    balance:         toNum(raw.balance),
    rate:            toNum(raw.rate),
    rateType:        raw.rateType        ?? 'fixed',
    repaymentType:   raw.repaymentType   ?? 'P&I',
    fixedTermExpiry: raw.fixedTermExpiry ?? '',
    amount:          toNum(raw.amount),
    frequency:       raw.frequency       ?? 'fortnightly',
  });
}

export function normalizeExpense(raw: any = {}): Expense {
  // Legacy type migration (pre-v1 data stored type as 'fixed' or 'variable')
  let type    = raw.type    ?? 'standard';
  let subtype = raw.subtype ?? 'fixed';
  if (type === 'fixed' || type === 'variable') {
    subtype = type;
    type    = 'standard';
  }

  return createExpense({
    id:            raw.id            ?? '',
    name:          raw.name          ?? '',
    category:      raw.category      ?? 'Groceries',
    type,
    subtype,
    amount:        toNum(raw.amount),
    frequency:     raw.frequency     ?? 'monthly',
    paymentMethod: raw.paymentMethod ?? 'Direct Debit',
    ddDay:         toNumOrNull(raw.ddDay),
    lender:        raw.lender        ?? '',
    facilities:    (raw.facilities   ?? []).map(normalizeFacility),
    notes:         raw.notes         ?? '',
    history:       raw.history       ?? [],
    startDate:     raw.startDate     ?? '',
    endDate:       raw.endDate       ?? '',
    forPerson:     raw.forPerson     ?? '',
  });
}
