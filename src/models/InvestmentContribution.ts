/**
 * @fileoverview Domain model for a contribution made to an investment holding.
 *
 * Numeric normalization:
 *   `normalizeInvestmentContribution` coerces `amount` to a number (0 if absent).
 *   `createInvestmentContribution` retains `''` default for form binding.
 */

export const CONTRIBUTION_TYPES = ['Regular', 'Lump Sum', 'KiwiSaver', 'Dividend Reinvestment', 'Other'] as const;
export type ContributionType = typeof CONTRIBUTION_TYPES[number];

/** Pill colour class keyed by contribution type. */
export const CONTRIBUTION_TYPE_PILL = {
  'Regular':               'teal',
  'Lump Sum':              'amber',
  'KiwiSaver':             'purple',
  'Dividend Reinvestment': 'green',
  'Other':                 '',
} as const;

export interface InvestmentContribution {
  id: string;
  portfolioId: string;
  date: string;
  holdingId: string;
  platform: string;
  amount: number;
  type: ContributionType;
  notes: string;
  createdAt: string;
}

export function createInvestmentContribution(overrides: any = {}) {
  return {
    id:          '',
    portfolioId: '',
    date:        '',
    holdingId:   '',
    platform:    '',
    amount:      '',
    type:        'Regular',
    notes:       '',
    createdAt:   '',
    ...overrides,
  };
}

function toNum(val: any): number {
  const n = parseFloat(val);
  return isFinite(n) ? n : 0;
}

export function normalizeInvestmentContribution(raw: any = {}): InvestmentContribution {
  return createInvestmentContribution({
    id:          raw.id          ?? '',
    portfolioId: raw.portfolioId ?? '',
    date:        raw.date        ?? '',
    holdingId:   raw.holdingId   ?? '',
    platform:    raw.platform    ?? '',
    amount:      toNum(raw.amount),
    type:        raw.type        ?? 'Regular',
    notes:       raw.notes       ?? '',
    createdAt:   raw.createdAt   ?? '',
  });
}
