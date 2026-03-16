/**
 * Undo store — in-memory only (not persisted).
 *
 * Holds snapshot-based undo entries for destructive actions.
 * One undo per domain; pushing a new undo auto-discards the previous one.
 */
import { create } from 'zustand';

export type UndoDomain = 'finance' | 'people' | 'property' | 'investment';

export interface UndoEntry {
  id:        string;
  label:     string;
  domain:    UndoDomain;
  restoreFn: () => void;
  timerId:   ReturnType<typeof setTimeout>;
}

interface UndoState {
  undoStack: UndoEntry[];
}

interface UndoActions {
  pushUndo:   (entry: Omit<UndoEntry, 'id'>) => void;
  executeUndo:(id: string) => void;
  expireUndo: (id: string) => void;
}

export type UndoStore = UndoState & UndoActions;

export const useUndoStore = create<UndoStore>()((set, get) => ({
  undoStack: [],

  pushUndo(entry) {
    const id = crypto.randomUUID();

    // Discard any existing undo for the same domain (one-per-domain limit)
    const prev = get().undoStack.find(e => e.domain === entry.domain);
    if (prev) {
      clearTimeout(prev.timerId);
    }

    set(s => ({
      undoStack: [
        ...s.undoStack.filter(e => e.domain !== entry.domain),
        { ...entry, id },
      ],
    }));
  },

  executeUndo(id) {
    const entry = get().undoStack.find(e => e.id === id);
    if (!entry) return;
    clearTimeout(entry.timerId);
    entry.restoreFn();
    set(s => ({ undoStack: s.undoStack.filter(e => e.id !== id) }));
  },

  expireUndo(id) {
    set(s => ({ undoStack: s.undoStack.filter(e => e.id !== id) }));
  },
}));
