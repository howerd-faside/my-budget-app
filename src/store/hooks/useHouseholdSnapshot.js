import { useMemo } from 'react';
import { useFinance } from './useFinance';
import { usePeople }  from './usePeople';
import {
  calcFortnightlyIncomeAt,
  calcFortnightlyAssetIncome,
  calcFortnightlyExpensesAt,
} from '../../utils/finance/savings';

/**
 * Derived hook — household-level financial snapshot.
 *
 * All values are fortnightly figures using the same helpers as Dashboard.jsx.
 * No store logic is reimplemented here; this is purely composition.
 *
 * Returns:
 *   netIncome   — net take-home + asset income per fortnight
 *   totalSpend  — total recurring expenses per fortnight
 *   netCashflow — netIncome − totalSpend
 *   savingsRate — netCashflow / netIncome (0 when income is zero)
 */
export function useHouseholdSnapshot() {
  const { assetIncomes } = useFinance();
  const { people, expenses } = usePeople();

  return useMemo(() => {
    const now        = new Date();
    const netIncome  = calcFortnightlyIncomeAt(people, now) + calcFortnightlyAssetIncome(assetIncomes);
    const totalSpend = calcFortnightlyExpensesAt(expenses, now);
    const netCashflow = netIncome - totalSpend;
    const savingsRate = netIncome > 0 ? netCashflow / netIncome : 0;
    return { netIncome, totalSpend, netCashflow, savingsRate };
  }, [people, expenses, assetIncomes]);
}
