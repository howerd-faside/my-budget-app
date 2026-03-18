/**
 * Versioned migrations for the Property domain.
 *
 * Version history:
 *   0 → 1  Normalize all property sub-entities including propertyProjects.
 *   1 → 2  Coerce expectedLifespan on propertyAssets from string to number | null.
 *   2 → 3  Coerce property numeric fields and valuation sub-object to number | null.
 */
import { normalizeProperty }            from '../../models/Property';
import { normalizePropertyTask }        from '../../models/PropertyTask';
import { normalizePropertyMaintenance } from '../../models/PropertyMaintenance';
import { normalizePropertyAsset }       from '../../models/PropertyAsset';
import { normalizePropertyProject }     from '../../models/PropertyProject';
import type { MigrationStep } from '../budgetStorage';

export const PROPERTY_VERSION     = 4;
export const PROPERTY_VERSION_KEY = '_propertyVersion';

export const PROPERTY_MIGRATIONS: MigrationStep[] = [
  {
    toVersion:   1,
    description: 'normalize properties/tasks/maintenance/projects/assets; initialize missing slices',
    migrate(slice: any) {
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
    migrate(slice: any) {
      if (Array.isArray(slice.propertyAssets)) {
        slice.propertyAssets = slice.propertyAssets.map(normalizePropertyAsset);
      }
      return slice;
    },
  },
  {
    toVersion:   3,
    description: 'coerce property numeric fields and valuation sub-object to number | null',
    migrate(slice: any) {
      if (Array.isArray(slice.properties)) {
        slice.properties = slice.properties.map(normalizeProperty);
      }
      return slice;
    },
  },
  {
    toVersion:   4,
    description: 'convert single valuation to valuations array for historical tracking',
    migrate(slice: any) {
      if (Array.isArray(slice.properties)) {
        slice.properties = slice.properties.map(normalizeProperty);
      }
      return slice;
    },
  },
];
