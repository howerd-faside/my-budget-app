/**
 * Versioned migrations for the Property domain.
 *
 * Version history:
 *   0 → 1  Normalize all property sub-entities including propertyProjects (previously
 *           stored as raw objects with no normalization pass). Initialize missing slices.
 *           Existing data that pre-dates the versioning system is treated as v0.
 *   1 → 2  Coerce `expectedLifespan` on propertyAssets from string to number | null.
 *           Re-runs the updated normalizePropertyAsset against v1-stored records.
 *
 * Adding a future v3 migration:
 *   1. Bump PROPERTY_VERSION to 3.
 *   2. Append to PROPERTY_MIGRATIONS:
 *        { toVersion: 3, description: '…', migrate(slice) { …; return slice; } }
 *   toVersion values must be consecutive integers (1, 2, 3, …) — a gap throws at startup.
 */
import { normalizeProperty }            from '../../models/Property';
import { normalizePropertyTask }        from '../../models/PropertyTask';
import { normalizePropertyMaintenance } from '../../models/PropertyMaintenance';
import { normalizePropertyAsset }       from '../../models/PropertyAsset';
import { normalizePropertyProject }     from '../../models/PropertyProject';

export const PROPERTY_VERSION     = 2;
export const PROPERTY_VERSION_KEY = '_propertyVersion';

export const PROPERTY_MIGRATIONS = [
  {
    toVersion:   1,
    description: 'normalize properties/tasks/maintenance/projects/assets; initialize missing slices',
    /**
     * @param {object} slice  Raw property slice from localStorage (may be partial).
     * @returns {object}      Normalized property slice.
     */
    migrate(slice) {
      if (Array.isArray(slice.properties)) {
        slice.properties = slice.properties.map(normalizeProperty);
      } else {
        slice.properties = [];
      }

      if (Array.isArray(slice.propertyTasks)) {
        slice.propertyTasks = slice.propertyTasks.map(normalizePropertyTask);
      } else {
        slice.propertyTasks = [];
      }

      if (Array.isArray(slice.propertyMaintenance)) {
        slice.propertyMaintenance = slice.propertyMaintenance.map(normalizePropertyMaintenance);
      } else {
        slice.propertyMaintenance = [];
      }

      // propertyProjects previously had no normalization pass — fixed here.
      if (Array.isArray(slice.propertyProjects)) {
        slice.propertyProjects = slice.propertyProjects.map(normalizePropertyProject);
      } else {
        slice.propertyProjects = [];
      }

      if (Array.isArray(slice.propertyAssets)) {
        slice.propertyAssets = slice.propertyAssets.map(normalizePropertyAsset);
      } else {
        slice.propertyAssets = [];
      }

      if (!('selectedPropertyId' in slice)) {
        slice.selectedPropertyId = null;
      }

      return slice;
    },
  },
  {
    toVersion:   2,
    description: 'coerce expectedLifespan on propertyAssets from string to number | null',
    /**
     * @param {object} slice  Property slice at v1 (may have string expectedLifespan).
     * @returns {object}      Property slice with expectedLifespan as number | null.
     */
    migrate(slice) {
      if (Array.isArray(slice.propertyAssets)) {
        slice.propertyAssets = slice.propertyAssets.map(normalizePropertyAsset);
      }
      return slice;
    },
  },
];
