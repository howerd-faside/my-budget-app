import { useMemo } from 'react';
import { useFinance }    from './useFinance';
import { usePeople }     from './usePeople';
import { useInvestment } from './useInvestment';
import {
  calcFortnightlyIncomeAt,
  calcFortnightlyAssetIncome,
  calcFortnightlyExpensesAt,
} from '../../store';
import { toFortnightly }                     from '../../utils/finance/frequency';
import { filterByDateRange, sumTransactions } from '../../utils/finance/transactions';
import { transactionFromContribution }        from '../../models/Transaction';

/**
 * Derived hook — high-level fortnightly money-flow allocation.
 *
 * Five buckets, all in fortnightly NZD, that sum to netIncome:
 *   mortgage     — loan-facility repayments (type=loan expenses, via facilities)
 *   livingCosts  — recurring standard expenses (type=standard)
 *   investments  — trailing-12-month contributions annualised to /fn
 *   savings      — remainder (netIncome − mortgage − livingCosts − investments)
 *   netIncome    — total net income (for proportion calculations)
 *
 * Mortgage is sourced from loan facilities, not from the top-level expense
 * amount, matching the derivation used in Dashboard.jsx. Standard expenses
 * have a zero top-level amount for loan records, so calcFortnightlyExpenses
 * on the full expense list would already exclude them — but we filter
 * explicitly here for clarity.
 *
 * Investment contributions are ad-hoc events, not scheduled flows, so we
 * approximate a fortnightly run-rate from the past 12 months of data.
 */
export function useMoneyFlow() {
  const { assetIncomes }                  = useFinance();
  const { people, expenses }              = usePeople();
  const { investmentContributions }       = useInvestment();

  return useMemo(() => {
    // ── Net income (date-aware — applies active income events) ──────────────
    const now = new Date();
    const netIncome =
      calcFortnightlyIncomeAt(people, now) + calcFortnightlyAssetIncome(assetIncomes);

    // ── Mortgage (loan-type expense facilities) ─────────────────────────────
    const loanExpenses  = (expenses || []).filter(e => e.type === 'loan');
    const allFacilities = loanExpenses.flatMap(loan =>
      (loan.facilities || []).filter(f => (+f.balance || 0) > 0 && (+f.amount || 0) > 0)
    );
    const mortgage = allFacilities.reduce(
      (s, f) => s + toFortnightly(f.amount, f.frequency || 'fortnightly'),
      0
    );

    // ── Living costs (standard recurring expenses, date-aware) ──────────────
    const standardExpenses = (expenses || []).filter(e => e.type === 'standard');
    const livingCosts = calcFortnightlyExpensesAt(standardExpenses, now);

    // ── Investments (trailing 12-month contributions → annualised /fn) ──────
    const todayStr   = now.toISOString().slice(0, 10);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const fromStr    = oneYearAgo.toISOString().slice(0, 10);

    const contribTx = (investmentContributions || []).map(transactionFromContribution);
    const recentTx  = filterByDateRange(contribTx, fromStr, todayStr);
    const investments = sumTransactions(recentTx) / 26;

    // ── Savings (implied remainder) ─────────────────────────────────────────
    const savings = netIncome - mortgage - livingCosts - investments;

    return { netIncome, mortgage, livingCosts, investments, savings };
  }, [people, expenses, assetIncomes, investmentContributions]);
}
