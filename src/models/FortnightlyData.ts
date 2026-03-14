/**
 * @fileoverview Types for fortnightly ad-hoc transaction tracking.
 *
 * The fortnightlyData structure is nested in the finance store:
 *   fortnightlyData[year][fortnightIndex] = { adhocTransactions: AdhocTransaction[] }
 *
 * Ad-hoc transactions are one-off income/expense events logged via the
 * FinancialTracking page. Positive amounts = income, negative = expense.
 *
 * These types describe an existing persisted structure — no new behaviour added.
 */

export interface AdhocTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  note: string;
  type: 'income' | 'expense';
}

export interface FortnightData {
  adhocTransactions: AdhocTransaction[];
}

/**
 * Year → { fortnights: { [fortnightIndex]: FortnightData } }
 *
 * Both the year and fortnight index are stored as object keys.
 * Fortnight indices run 0–25 (26 fortnights per year).
 */
export interface YearData {
  fortnights: Record<number, FortnightData>;
}

export type FortnightlyData = Record<number, YearData>;
