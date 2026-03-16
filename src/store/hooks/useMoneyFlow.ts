import { useMemo } from 'react';
import { useFinance }    from './useFinance';
import { usePeople }     from './usePeople';
import { useInvestment } from './useInvestment';
import {
  calcFortnightlyIncomeAt,
  calcFortnightlyAssetIncome,
  calcFortnightlyExpensesAt,
} from '../../utils/finance/savings';
import { getLoanFacilities }    from '../../utils/finance/loanFacilities';
import { filterTxByDateRange } from '../../utils/finance/portfolio';

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
  const { investmentTransactions }        = useInvestment();

  return useMemo(() => {
    // ── Net income (date-aware — applies active income events) ──────────────
    const now = new Date();
    const netIncome =
      calcFortnightlyIncomeAt(people, now) + calcFortnightlyAssetIncome(assetIncomes);

    // ── Mortgage (loan-type expense facilities) ─────────────────────────────
    // requireRate=false: zero-rate facilities still represent repayment outflows
    const { facilities: loanFacilities } = getLoanFacilities(expenses, { requireRate: false });
    const mortgage = loanFacilities.reduce((s, f) => s + f.amountFn, 0);

    // ── Living costs (standard recurring expenses, date-aware) ──────────────
    const standardExpenses = (expenses || []).filter(e => e.type === 'standard');
    const livingCosts = calcFortnightlyExpensesAt(standardExpenses, now);

    // ── Investments (trailing 12-month buy transactions → annualised /fn) ──
    const todayStr   = now.toISOString().slice(0, 10);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const fromStr    = oneYearAgo.toISOString().slice(0, 10);

    const buyTxs     = (investmentTransactions || []).filter(tx => tx.type === 'buy');
    const recentBuys = filterTxByDateRange(buyTxs, fromStr, todayStr);
    const investments = recentBuys.reduce((s, tx) => s + tx.amount, 0) / 26;

    // ── Savings (implied remainder) ─────────────────────────────────────────
    const savings = netIncome - mortgage - livingCosts - investments;

    return { netIncome, mortgage, livingCosts, investments, savings };
  }, [people, expenses, assetIncomes, investmentTransactions]);
}
