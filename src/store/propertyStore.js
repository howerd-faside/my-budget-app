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

export const PROPERTY_KEYS = [
  'properties', 'propertyTasks', 'propertyMaintenance',
  'propertyProjects', 'propertyAssets', 'selectedPropertyId',
];

const defaults = {
  properties:          [],
  propertyTasks:       [],
  propertyMaintenance: [],
  propertyProjects:    [],
  propertyAssets:      [],
  selectedPropertyId:  null,
};

export const usePropertyStore = create(
  persist(
    (set) => ({
      ...defaults,

      setSlice:    (key, val) => set({ [key]: val }),
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
