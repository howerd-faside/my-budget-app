/**
 * @fileoverview Domain model for a household income earner and their sub-entities.
 *
 * Inconsistencies detected:
 * - `assetIncomes` (rental, dividends, business income) is stored at the top level
 *   of the app state rather than nested under the person it belongs to.
 * - `SecondaryIncome` amounts are treated as net (post-tax) in all calculations,
 *   but there is no `isTaxed` field to make this intent explicit.
 * - `IncomeEvent.endDate` being empty string means "ongoing" throughout the code
 *   but the field is typed as string | null.
 * - `EmploymentRole` was added later than `incomeEvents`; older Person records may
 *   lack `employmentHistory: []` entirely.
 * - `grossAnnual` on Person is a fallback when no EmploymentRole covers the date.
 *
 * Numeric normalization:
 *   All financial amounts and rates are stored as numbers after normalization.
 *   `create*` factories retain `''` defaults so form inputs bind to empty strings.
 *   `normalize*` functions are the single coercion boundary for storage data.
 */

export const TAX_CODES = ['M', 'M SL', 'ME', 'ME SL', 'S', 'SH', 'ST', 'SA', 'CAE', 'EDW', 'NSW', 'WT'] as const;
export type TaxCode = typeof TAX_CODES[number];

export const KIWISAVER_RATES = [0, 3, 4, 6, 8, 10] as const;
export type KiwiSaverRate = typeof KIWISAVER_RATES[number];

export const PAY_FREQUENCIES = ['weekly', 'fortnightly', 'monthly', 'annual'] as const;
export type PayFrequency = typeof PAY_FREQUENCIES[number];

export const INCOME_FREQUENCIES = ['weekly', 'fortnightly', 'monthly', 'quarterly', 'annual'] as const;

export const ASSET_INCOME_TYPES = ['rental', 'dividend', 'business', 'trust', 'other'] as const;
export type AssetIncomeType = typeof ASSET_INCOME_TYPES[number];

// ── Private helpers ──────────────────────────────────────────────────────────

function toNum(val: any, fallback = 0): number {
  const n = parseFloat(val);
  return isFinite(n) ? n : fallback;
}

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface SecondaryIncome {
  id: string;
  name: string;
  amount: number;
  frequency: string;
}

export interface IncomeEvent {
  id: string;
  label: string;
  startDate: string;
  endDate: string | null;
  grossAnnual: number;
}

export interface EmploymentRole {
  id: string;
  employer: string;
  role: string;
  startDate: string;
  endDate: string | null;
  grossAnnual: number;
}

export interface AssetIncome {
  id: string;
  name: string;
  type: AssetIncomeType;
  amount: number;
  frequency: string;
  notes: string;
}

export interface Person {
  id: string;
  name: string;
  grossAnnual: number;
  taxCode: TaxCode;
  kiwiSaverRate: number;
  payFrequency: PayFrequency;
  secondaryIncomes: SecondaryIncome[];
  incomeEvents: IncomeEvent[];
  employmentHistory: EmploymentRole[];
}

// ── Factories (form defaults — numeric fields intentionally '' for input binding) ──

export function createSecondaryIncome(overrides: any = {}) {
  return { id: '', name: '', amount: '', frequency: 'monthly', ...overrides };
}

export function createIncomeEvent(overrides: any = {}) {
  return { id: '', label: '', startDate: '', endDate: '', grossAnnual: '', ...overrides };
}

export function createEmploymentRole(overrides: any = {}) {
  return { id: '', employer: '', role: '', startDate: '', endDate: '', grossAnnual: '', ...overrides };
}

export function createAssetIncome(overrides: any = {}) {
  return { id: '', name: '', type: 'rental', amount: '', frequency: 'monthly', notes: '', ...overrides };
}

export function createPerson(overrides: any = {}) {
  return {
    id:                '',
    name:              '',
    grossAnnual:       '',
    taxCode:           'M',
    kiwiSaverRate:     3,
    payFrequency:      'fortnightly',
    secondaryIncomes:  [],
    incomeEvents:      [],
    employmentHistory: [],
    ...overrides,
  };
}

// ── Normalizers (storage boundary — all numeric fields coerced to number) ────

export function normalizeSecondaryIncome(raw: any = {}): SecondaryIncome {
  return createSecondaryIncome({
    id:        raw.id        ?? '',
    name:      raw.name      ?? '',
    amount:    toNum(raw.amount),
    frequency: raw.frequency ?? 'monthly',
  });
}

export function normalizeIncomeEvent(raw: any = {}): IncomeEvent {
  return createIncomeEvent({
    id:          raw.id          ?? '',
    label:       raw.label       ?? '',
    startDate:   raw.startDate   ?? '',
    endDate:     raw.endDate     || null,
    grossAnnual: toNum(raw.grossAnnual),
  });
}

export function normalizeEmploymentRole(raw: any = {}): EmploymentRole {
  return createEmploymentRole({
    id:          raw.id          ?? '',
    employer:    raw.employer    ?? '',
    role:        raw.role        ?? '',
    startDate:   raw.startDate   ?? '',
    endDate:     raw.endDate     || null,
    grossAnnual: toNum(raw.grossAnnual),
  });
}

export function normalizeAssetIncome(raw: any = {}): AssetIncome {
  return createAssetIncome({
    id:        raw.id        ?? '',
    name:      raw.name      ?? '',
    type:      raw.type      ?? 'rental',
    amount:    toNum(raw.amount),
    frequency: raw.frequency ?? 'monthly',
    notes:     raw.notes     ?? '',
  });
}

export function normalizePerson(raw: any = {}): Person {
  return createPerson({
    id:           raw.id       ?? '',
    name:         raw.name     ?? '',
    grossAnnual:  toNum(raw.grossAnnual),
    taxCode:      raw.taxCode  ?? 'M',
    kiwiSaverRate:     raw.kiwiSaverRate != null ? toNum(raw.kiwiSaverRate) : 3,
    payFrequency:      raw.payFrequency ?? 'fortnightly',
    secondaryIncomes:  (raw.secondaryIncomes  ?? []).map(normalizeSecondaryIncome),
    incomeEvents:      (raw.incomeEvents      ?? []).map(normalizeIncomeEvent),
    employmentHistory: (raw.employmentHistory ?? []).map(normalizeEmploymentRole),
  });
}
