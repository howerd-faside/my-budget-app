/**
 * useFinance — domain hook for the finance slice.
 *
 * Wraps useFinanceStore with a stable, named API so components never need to
 * know about the raw store internals.
 */
import { useFinanceStore } from '../financeStore';

import type { FinanceStoreState } from '../financeStore';
import type { FortnightData }     from '../../models/FortnightlyData';

export interface UseFinanceReturn {
  // State
  accounts:        FinanceStoreState['accounts'];
  transfers:       FinanceStoreState['transfers'];
  fortnightlyData: FinanceStoreState['fortnightlyData'];
  goals:           FinanceStoreState['goals'];
  assetIncomes:    FinanceStoreState['assetIncomes'];
  settings:        FinanceStoreState['settings'];
  // Actions
  setFinance:      <K extends keyof FinanceStoreState>(key: K, val: FinanceStoreState[K]) => void;
  mergeFinance:    (slices: Partial<FinanceStoreState>) => void;
  updateFortnight: (year: number, idx: number, data: Partial<FortnightData>) => void;
  updateAccount:   (id: string, balance: number | string) => void;
  addTransfer:     (params: { fromId: string; toId: string; amount: number | string; note?: string }) => void;
  removeTransfer:  (txId: string) => void;
}

export function useFinance(): UseFinanceReturn {
  const s = useFinanceStore();
  return {
    // State
    accounts:        s.accounts,
    transfers:       s.transfers,
    fortnightlyData: s.fortnightlyData,
    goals:           s.goals,
    assetIncomes:    s.assetIncomes,
    settings:        s.settings,
    // Actions
    setFinance:      s.setSlice,
    mergeFinance:    s.mergeSlices,
    updateFortnight: s.updateFortnight,
    updateAccount:   s.updateAccount,
    addTransfer:     s.addTransfer,
    removeTransfer:  s.removeTransfer,
  };
}
