import { useMemo } from 'react';
import { useFinance } from './useFinance';
import { usePeople }  from './usePeople';
import {
  calcFortnightlyIncomeAt,
  calcFortnightlyAssetIncome,
  calcFortnightlyExpensesAt,
} from '../../utils/finance/savings';

export interface HouseholdSnapshot {
  netIncome:   number;
  totalSpend:  number;
  netCashflow: number;
  savingsRate: number;
}

/**
 * Derived hook — household-level financial snapshot.
 *
 * All values are fortnightly figures using the same helpers as Dashboard.jsx.
 */
export function useHouseholdSnapshot(): HouseholdSnapshot {
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
