import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUndoStore } from '../undoStore';

beforeEach(() => {
  useUndoStore.setState({ undoStack: [] });
  vi.useFakeTimers();
});

afterEach(() => {
  // Clear all pending timers
  vi.runAllTimers();
  vi.useRealTimers();
});

describe('undoStore', () => {
  it('pushUndo adds an entry to the stack', () => {
    const restoreFn = vi.fn();
    const timerId = setTimeout(() => {}, 7000);

    useUndoStore.getState().pushUndo({
      label: 'Test deleted',
      domain: 'people',
      restoreFn,
      timerId,
    });

    const stack = useUndoStore.getState().undoStack;
    expect(stack).toHaveLength(1);
    expect(stack[0].label).toBe('Test deleted');
    expect(stack[0].domain).toBe('people');
    expect(stack[0].id).toBeTruthy();
  });

  it('executeUndo calls restoreFn and removes entry', () => {
    const restoreFn = vi.fn();
    const timerId = setTimeout(() => {}, 7000);

    useUndoStore.getState().pushUndo({
      label: 'Expense deleted',
      domain: 'people',
      restoreFn,
      timerId,
    });

    const id = useUndoStore.getState().undoStack[0].id;
    useUndoStore.getState().executeUndo(id);

    expect(restoreFn).toHaveBeenCalledOnce();
    expect(useUndoStore.getState().undoStack).toHaveLength(0);
  });

  it('expireUndo removes entry without calling restoreFn', () => {
    const restoreFn = vi.fn();
    const timerId = setTimeout(() => {}, 7000);

    useUndoStore.getState().pushUndo({
      label: 'Goal deleted',
      domain: 'finance',
      restoreFn,
      timerId,
    });

    const id = useUndoStore.getState().undoStack[0].id;
    useUndoStore.getState().expireUndo(id);

    expect(restoreFn).not.toHaveBeenCalled();
    expect(useUndoStore.getState().undoStack).toHaveLength(0);
  });

  it('pushUndo with same domain discards previous entry', () => {
    const restoreFn1 = vi.fn();
    const restoreFn2 = vi.fn();
    const timerId1 = setTimeout(() => {}, 7000);
    const timerId2 = setTimeout(() => {}, 7000);

    useUndoStore.getState().pushUndo({
      label: 'First expense',
      domain: 'people',
      restoreFn: restoreFn1,
      timerId: timerId1,
    });

    useUndoStore.getState().pushUndo({
      label: 'Second expense',
      domain: 'people',
      restoreFn: restoreFn2,
      timerId: timerId2,
    });

    const stack = useUndoStore.getState().undoStack;
    expect(stack).toHaveLength(1);
    expect(stack[0].label).toBe('Second expense');
  });

  it('entries from different domains coexist', () => {
    const timerId1 = setTimeout(() => {}, 7000);
    const timerId2 = setTimeout(() => {}, 7000);

    useUndoStore.getState().pushUndo({
      label: 'Expense deleted',
      domain: 'people',
      restoreFn: vi.fn(),
      timerId: timerId1,
    });

    useUndoStore.getState().pushUndo({
      label: 'Property deleted',
      domain: 'property',
      restoreFn: vi.fn(),
      timerId: timerId2,
    });

    expect(useUndoStore.getState().undoStack).toHaveLength(2);
  });

  it('executeUndo with invalid id is a no-op', () => {
    useUndoStore.getState().executeUndo('nonexistent');
    expect(useUndoStore.getState().undoStack).toHaveLength(0);
  });
});
