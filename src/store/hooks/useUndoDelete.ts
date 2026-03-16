/**
 * useUndoDelete — hook for undoable destructive actions.
 *
 * Usage:
 *   const undoDelete = useUndoDelete();
 *   undoDelete({
 *     label: 'Expense deleted',
 *     domain: 'people',
 *     snapshot: { expenses: currentExpenses },
 *     applyFn: () => setPeople('expenses', filtered),
 *   });
 */
import { useCallback } from 'react';
import { useToast } from '../../components/Toast';
import { useUndoStore, type UndoDomain } from '../undoStore';
import { useFinanceStore }   from '../financeStore';
import { usePeopleStore }    from '../peopleStore';
import { usePropertyStore }  from '../propertyStore';
import { useInvestmentStore } from '../investmentStore';

const UNDO_DURATION = 7000;

const mergeByDomain: Record<UndoDomain, () => (slices: Record<string, unknown>) => void> = {
  finance:    () => useFinanceStore.getState().mergeSlices,
  people:     () => usePeopleStore.getState().mergeSlices,
  property:   () => usePropertyStore.getState().mergeSlices,
  investment: () => useInvestmentStore.getState().mergeSlices,
};

interface UndoDeleteOpts {
  label:    string;
  domain:   UndoDomain;
  snapshot: Record<string, unknown>;
  applyFn:  () => void;
}

export function useUndoDelete() {
  const toast     = useToast();
  const pushUndo  = useUndoStore(s => s.pushUndo);
  const executeUndo = useUndoStore(s => s.executeUndo);
  const expireUndo  = useUndoStore(s => s.expireUndo);

  return useCallback((opts: UndoDeleteOpts) => {
    const { label, domain, snapshot, applyFn } = opts;

    // 1. Execute the deletion immediately
    applyFn();

    // 2. Build a restore closure that will be called on undo
    const restoreFn = () => {
      const merge = mergeByDomain[domain]();
      merge(snapshot as any);
    };

    // 3. Set up the expiry timer
    let entryId = '';
    const timerId = setTimeout(() => {
      expireUndo(entryId);
    }, UNDO_DURATION);

    // 4. Push to undo store (assigns the id)
    pushUndo({ label, domain, restoreFn, timerId });

    // Read back the id that was just assigned
    const stack = useUndoStore.getState().undoStack;
    const entry = stack.find(e => e.domain === domain);
    entryId = entry?.id ?? '';

    // 5. Show undo toast
    toast(label, 'undo', {
      duration: UNDO_DURATION,
      action: {
        label: 'Undo',
        onClick: () => { if (entryId) executeUndo(entryId); },
      },
    });
  }, [toast, pushUndo, executeUndo, expireUndo]);
}
