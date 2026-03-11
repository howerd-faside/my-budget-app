/**
 * useFinance — domain hook for the finance slice.
 *
 * Wraps useFinanceStore with a stable, named API so components never need to
 * know about the raw store internals.
 *
 * Exposed state:  accounts, transfers, fortnightlyData, goals, assetIncomes, settings
 * Exposed actions: setFinance(key, val), mergeFinance(slices),
 *                  updateFortnight, updateAccount, addTransfer, removeTransfer
 */
import { useFinanceStore } from '../financeStore';

export function useFinance() {
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
