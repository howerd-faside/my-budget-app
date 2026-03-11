/**
 * useProperty — domain hook for the property slice.
 *
 * Exposed state:   properties, propertyTasks, propertyMaintenance,
 *                  propertyProjects, propertyAssets, selectedPropertyId
 * Exposed actions: setProperty(key, val), mergeProperty(slices)
 */
import { usePropertyStore } from '../propertyStore';

export function useProperty() {
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
