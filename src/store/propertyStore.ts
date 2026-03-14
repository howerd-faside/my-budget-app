/**
 * Property domain store.
 *
 * Owns: properties, propertyTasks, propertyMaintenance, propertyProjects,
 *       propertyAssets, selectedPropertyId
 */
import { create } from 'zustand';
import { persist }  from 'zustand/middleware';
import { createBudgetStorage } from './budgetStorage';
import {
  PROPERTY_VERSION,
  PROPERTY_VERSION_KEY,
  PROPERTY_MIGRATIONS,
} from './migrations/property';

import type { Property }            from '../models/Property';
import type { PropertyTask }        from '../models/PropertyTask';
import type { PropertyMaintenance } from '../models/PropertyMaintenance';
import type { PropertyProject }     from '../models/PropertyProject';
import type { PropertyAsset }       from '../models/PropertyAsset';

// ── State + Action interfaces ────────────────────────────────────────────────

export interface PropertyStoreState {
  properties:          Property[];
  propertyTasks:       PropertyTask[];
  propertyMaintenance: PropertyMaintenance[];
  propertyProjects:    PropertyProject[];
  propertyAssets:      PropertyAsset[];
  selectedPropertyId:  string | null;
}

export interface PropertyStoreActions {
  setSlice:    <K extends keyof PropertyStoreState>(key: K, val: PropertyStoreState[K]) => void;
  mergeSlices: (slices: Partial<PropertyStoreState>) => void;
}

export type PropertyStore = PropertyStoreState & PropertyStoreActions;

// ── Keys & defaults ──────────────────────────────────────────────────────────

export const PROPERTY_KEYS: (keyof PropertyStoreState)[] = [
  'properties', 'propertyTasks', 'propertyMaintenance',
  'propertyProjects', 'propertyAssets', 'selectedPropertyId',
];

const defaults: PropertyStoreState = {
  properties:          [],
  propertyTasks:       [],
  propertyMaintenance: [],
  propertyProjects:    [],
  propertyAssets:      [],
  selectedPropertyId:  null,
};

// ── Store ────────────────────────────────────────────────────────────────────

export const usePropertyStore = create<PropertyStore>()(
  persist(
    (set) => ({
      ...defaults,

      setSlice:    (key, val) => set({ [key]: val } as Partial<PropertyStoreState>),
      mergeSlices: (slices)   => set(slices),
    }),
    {
      name:       'budget_v1',
      version:    PROPERTY_VERSION,
      storage:    createBudgetStorage(
        PROPERTY_KEYS,
        PROPERTY_VERSION_KEY,
        PROPERTY_VERSION,
        PROPERTY_MIGRATIONS
      ),
      partialize: (s) => Object.fromEntries(PROPERTY_KEYS.map(k => [k, s[k]])),
    }
  )
);
