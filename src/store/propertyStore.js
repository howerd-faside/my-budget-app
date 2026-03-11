/**
 * Property domain store.
 *
 * Owns: properties, propertyTasks, propertyMaintenance, propertyProjects,
 *       propertyAssets, selectedPropertyId
 */
import { create } from 'zustand';
import { persist }  from 'zustand/middleware';
import { normalizeProperty }            from '../models/Property';
import { normalizePropertyTask }        from '../models/PropertyTask';
import { normalizePropertyMaintenance } from '../models/PropertyMaintenance';
import { normalizePropertyAsset }       from '../models/PropertyAsset';
import { createBudgetStorage }          from './budgetStorage';

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

function migrateProperty(slice) {
  if (slice.properties)          slice.properties          = slice.properties.map(normalizeProperty);
  if (slice.propertyTasks)       slice.propertyTasks       = slice.propertyTasks.map(normalizePropertyTask);
  if (slice.propertyMaintenance) slice.propertyMaintenance = slice.propertyMaintenance.map(normalizePropertyMaintenance);
  if (slice.propertyAssets)      slice.propertyAssets      = slice.propertyAssets.map(normalizePropertyAsset);

  if (!slice.properties)          slice.properties          = [];
  if (!slice.propertyTasks)       slice.propertyTasks       = [];
  if (!slice.propertyMaintenance) slice.propertyMaintenance = [];
  if (!slice.propertyProjects)    slice.propertyProjects    = [];
  if (!slice.propertyAssets)      slice.propertyAssets      = [];
  if (!('selectedPropertyId' in slice)) slice.selectedPropertyId = null;

  return slice;
}

export const usePropertyStore = create(
  persist(
    (set) => ({
      ...defaults,

      setSlice:    (key, val) => set({ [key]: val }),
      mergeSlices: (slices)   => set(slices),
    }),
    {
      name:       'budget_v1',
      storage:    createBudgetStorage(PROPERTY_KEYS, migrateProperty),
      partialize: (s) => Object.fromEntries(PROPERTY_KEYS.map(k => [k, s[k]])),
    }
  )
);
