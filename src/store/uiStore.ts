/**
 * UI preferences store.
 *
 * Owns transient or cross-domain UI state such as sidebar state, active theme,
 * or any display preferences that don't belong to a specific data domain.
 *
 * Currently empty — extended as new UI preferences are added.
 * Not persisted to localStorage (UI defaults are always safe to reset).
 */
import { create } from 'zustand';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface UiStoreState {
  // Reserved for future UI preferences, e.g.:
  //   sidebarCollapsed: boolean;
  //   colorScheme: 'auto' | 'light' | 'dark';
}

export type UiStore = UiStoreState;

export const useUiStore = create<UiStore>()(() => ({}));
