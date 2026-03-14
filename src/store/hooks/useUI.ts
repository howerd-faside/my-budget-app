/**
 * useUI — domain hook for UI preferences (currently a placeholder).
 *
 * Wraps useUiStore; extend this when the UI slice gains real state.
 */
import { useUiStore } from '../uiStore';

import type { UiStore } from '../uiStore';

export function useUI(): UiStore {
  return useUiStore();
}
