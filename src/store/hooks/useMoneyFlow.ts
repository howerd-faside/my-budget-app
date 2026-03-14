import { useMemo } from 'react';
import { useFinance }    from './useFinance';
import { usePeople }     from './usePeople';
import { useInvestment } from './useInvestment';
import {
  calcFortnightlyIncomeAt,
  calcFortnightlyAssetIncome,
  calcFortnightlyExpensesAt,
} from '../../utils/finance/savings';
import { toFortnightly }                     from '../../utils/finance/frequency';
import { filterByDateRange, sumTransactions } from '../../utils/finance/transactions';
import { transactionFromContribution }        from '../../models/Transaction';

export interface MoneyFlow {
  netIncome:   number;
  mortgage:    number;
  livingCosts: number;
  investments: number;
  savings:     number;
}

/**
 * Derived hook — high-level fortnightly money-flow allocation.
 *
 * Five buckets, all in fortnightly NZD, that sum to netIncome.
 */
export function useMoneyFlow(): MoneyFlow {
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
