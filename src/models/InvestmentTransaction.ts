/**
 * @fileoverview Persisted investment transaction (ledger entry).
 *
 * An InvestmentTransaction is the single source of truth for money/unit
 * movement within a portfolio. Position (units held, cost basis) is derived
 * from the buy/sell history — never stored directly.
 *
 * Type semantics:
 *   buy        – acquire units of an asset (units, price required)
 *   sell       – dispose of units (units, price required)
 *   dividend   – cash distribution from an asset (grossAmount/taxAmount optional)
 *   fee        – platform/admin fee not tied to a trade
 *   deposit    – cash into the portfolio (no asset)
 *   withdrawal – cash out of the portfolio (no asset)
 *   transfer   – move cash/units between portfolios (linkedTxId points to the other side)
 *
 * Naming: "InvestmentTransaction" avoids collision with the ephemeral
 * Transaction adapter model in Transaction.ts.
 */

export const INV_TX_TYPES = [
  'buy', 'sell', 'dividend', 'fee',
  'deposit', 'withdrawal', 'transfer',
] as const;
export type InvTxType = typeof INV_TX_TYPES[number];

/** Pill colour class keyed by transaction type — mirrors CONTRIBUTION_TYPE_PILL pattern. */
export const INV_TX_TYPE_PILL: Record<InvTxType, string> = {
  buy:        'teal',
  sell:       'red',
  dividend:   'green',
  fee:        'amber',
  deposit:    'purple',
  withdrawal: 'amber',
  transfer:   '',
} as const;

export interface InvestmentTransaction {
  id: string;
  portfolioId: string;
  assetId: string;            // '' for non-asset transactions (deposit, withdrawal, fee)
  date: string;               // ISO date YYYY-MM-DD
  type: InvTxType;

  // Position fields — present on buy/sell, null otherwise
  units: number | null;
  price: number | null;       // per-unit price at trade time

  amount: number;             // signed cash impact: positive = money in, negative = money out
  fee: number;                // brokerage / platform fee for this transaction

  // Dividend detail — present on dividend type, null otherwise
  grossAmount: number | null;
  taxAmount: number | null;

  label: string;              // user-facing note (e.g. contribution type, dividend source)
  linkedTxId: string | null;  // for transfers: id of the counterpart transaction
  notes: string;
  createdAt: string;
}

/**
 * Factory — blank InvestmentTransaction with form-friendly defaults.
 * Numeric fields use '' for form binding (same convention as Holding/Contribution).
 */
export function createInvestmentTransaction(overrides: any = {}) {
  return {
    id:          '',
    portfolioId: '',
    assetId:     '',
    date:        '',
    type:        'buy',
    units:       '',
    price:       '',
    amount:      '',
    fee:         '',
    grossAmount: '',
    taxAmount:   '',
    label:       '',
    linkedTxId:  null,
    notes:       '',
    createdAt:   '',
    ...overrides,
  };
}

function toNum(val: any): number {
  const n = parseFloat(val);
  return isFinite(n) ? n : 0;
}

function toNumOrNull(val: any): number | null {
  if (val == null || val === '') return null;
  const n = parseFloat(val);
  return isFinite(n) ? n : null;
}

/**
 * Coerce a raw object to the canonical InvestmentTransaction shape.
 */
export function normalizeInvestmentTransaction(raw: any = {}): InvestmentTransaction {
  return {
    id:          raw.id          ?? '',
    portfolioId: raw.portfolioId ?? '',
    assetId:     raw.assetId     ?? '',
    date:        raw.date        ?? '',
    type:        raw.type        ?? 'buy',
    units:       toNumOrNull(raw.units),
    price:       toNumOrNull(raw.price),
    amount:      toNum(raw.amount),
    fee:         toNum(raw.fee),
    grossAmount: toNumOrNull(raw.grossAmount),
    taxAmount:   toNumOrNull(raw.taxAmount),
    label:       raw.label       ?? '',
    linkedTxId:  raw.linkedTxId  ?? null,
    notes:       raw.notes       ?? '',
    createdAt:   raw.createdAt   ?? '',
  };
}
