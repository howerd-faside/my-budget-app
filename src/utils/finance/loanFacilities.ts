import { toFortnightly } from './frequency';
import { calcTotalInterest, calcRemainingTerm, calcSimpleRemainingTerm, projectBalance } from './mortgage';
import type { Expense, Facility } from '../../models/Expense';

export interface NormalisedFacility extends Facility {
  loanId:     string;
  loanName:   string;
  loanLender: string;
  amountFn:   number;
  /** Balance projected to today (accounts for payments since balanceDate). Falls back to raw balance. */
  currentBalance: number;
}

export interface LoanFacilitiesResult {
  loanExpenses: Expense[];
  facilities:   NormalisedFacility[];
  hasLoans:     boolean;
}

/**
 * Extract and normalise qualifying mortgage/loan facilities from expenses.
 *
 * Default criteria: balance > 0 && rate > 0 && amount > 0
 * Set requireRate=false / requireAmount=false for looser filtering
 * (e.g. zero-rate interest-free facilities, or deferred-repayment debt).
 */
export function getLoanFacilities(
  expenses: Expense[],
  options: { requireRate?: boolean; requireAmount?: boolean } = {},
): LoanFacilitiesResult {
  const { requireRate = true, requireAmount = true } = options;

  const loanExpenses = (expenses || []).filter(e => e.type === 'loan');

  const facilities: NormalisedFacility[] = loanExpenses.flatMap(loan =>
    (loan.facilities || [])
      .filter(f => {
        if ((+f.balance || 0) <= 0) return false;
        if (requireRate && (+f.rate || 0) <= 0) return false;
        if (requireAmount && (+f.amount || 0) <= 0) return false;
        return true;
      })
      .map(f => {
        const amountFn = toFortnightly(f.amount, f.frequency || 'fortnightly');
        const bDate = f.balanceDate || loan.startDate || '';
        const rawBal = +f.balance || 0;
        const currentBalance = bDate
          ? projectBalance(rawBal, +f.rate || 0, amountFn, bDate)
          : rawBal;
        return {
          ...f,
          loanId:     loan.id,
          loanName:   loan.name,
          loanLender: loan.lender,
          amountFn,
          currentBalance,
        };
      })
  );

  return {
    loanExpenses,
    facilities,
    hasLoans: facilities.length > 0,
  };
}

// ── Aggregate obligation metrics ─────────────────────────────────────────────

export interface ObligationMetrics {
  totalBalance:  number;
  repaymentFn:   number;
  totalInterest: number;
  payoffYear:    number | null;
  hasLoans:      boolean;
}

/**
 * Compute aggregate obligation metrics from an already-filtered facility list.
 *
 * Shared by useMortgageSummary and useObligationsSnapshot so the
 * totalBalance / repaymentFn / totalInterest / payoffYear logic lives in one place.
 */
export function calcObligationMetrics(facilities: NormalisedFacility[]): ObligationMetrics {
  if (facilities.length === 0) {
    return { totalBalance: 0, repaymentFn: 0, totalInterest: 0, payoffYear: null, hasLoans: false };
  }

  const totalBalance  = facilities.reduce((s, f) => s + ((f.currentBalance ?? +f.balance) || 0), 0);
  const repaymentFn   = facilities.reduce((s, f) => s + f.amountFn, 0);
  const totalInterest = facilities.reduce(
    (s, f) => s + calcTotalInterest((f.currentBalance ?? +f.balance) || 0, +f.rate, f.amountFn),
    0,
  );

  let maxYearsRemaining = 0;
  for (const f of facilities) {
    const bal = (f.currentBalance ?? +f.balance) || 0;
    const rate = +f.rate || 0;
    // Use simple division for zero-rate (interest-free) facilities
    const term = rate > 0
      ? calcRemainingTerm(bal, rate, f.amountFn)
      : calcSimpleRemainingTerm(bal, f.amountFn);
    if (term) {
      const total = term.years + term.months / 12;
      if (total > maxYearsRemaining) maxYearsRemaining = total;
    }
  }
  const payoffYear = maxYearsRemaining > 0
    ? new Date().getFullYear() + Math.ceil(maxYearsRemaining)
    : null;

  return { totalBalance, repaymentFn, totalInterest, payoffYear, hasLoans: true };
}
