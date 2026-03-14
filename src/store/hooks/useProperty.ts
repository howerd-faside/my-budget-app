/**
 * useProperty — domain hook for the property slice.
 *
 * Exposed state:   properties, propertyTasks, propertyMaintenance,
 *                  propertyProjects, propertyAssets, selectedPropertyId
 * Exposed actions: setProperty(key, val), mergeProperty(slices)
 */
import { usePropertyStore } from '../propertyStore';

import type { PropertyStoreState } from '../propertyStore';

export interface UsePropertyReturn {
  // State
  properties:          PropertyStoreState['properties'];
  propertyTasks:       PropertyStoreState['propertyTasks'];
  propertyMaintenance: PropertyStoreState['propertyMaintenance'];
  propertyProjects:    PropertyStoreState['propertyProjects'];
  propertyAssets:      PropertyStoreState['propertyAssets'];
  selectedPropertyId:  PropertyStoreState['selectedPropertyId'];
  // Actions
  setProperty:         <K extends keyof PropertyStoreState>(key: K, val: PropertyStoreState[K]) => void;
  mergeProperty:       (slices: Partial<PropertyStoreState>) => void;
}

export function useProperty(): UsePropertyReturn {
  const s = usePropertyStore();
  return {
    // State
    properties:          s.properties,
    propertyTasks:       s.propertyTasks,
    propertyMaintenance: s.propertyMaintenance,
    propertyProjects:    s.propertyProjects,
    propertyAssets:      s.propertyAssets,
    selectedPropertyId:  s.selectedPropertyId,
    // Actions
    setProperty:         s.setSlice,
    mergeProperty:       s.mergeSlices,
  };
}
