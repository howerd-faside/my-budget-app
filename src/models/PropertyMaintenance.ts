/**
 * @fileoverview Domain model for a maintenance log entry on a property.
 */

export const MAINTENANCE_CATEGORIES = ['Repair', 'Maintenance', 'Improvement', 'Inspection', 'Cleaning', 'Compliance', 'General'] as const;
export type MaintenanceCategory = typeof MAINTENANCE_CATEGORIES[number];

export const PERFORMED_BY_OPTIONS = ['Self', 'Plumber', 'Electrician', 'Builder', 'Landscaper', 'Roofer', 'Painter', 'HVAC Tech', 'Other'] as const;

export interface PropertyMaintenance {
  id: string;
  propertyId: string;
  date: string;
  title: string;
  description: string;
  areaId: string;
  assetId: string;
  category: MaintenanceCategory;
  performedBy: string;
  performedByCustom: string;
  linkedTaskId: string;
  createdAt: string;
}

export function createPropertyMaintenance(overrides: any = {}) {
  return {
    id:                '',
    propertyId:        '',
    date:              '',
    title:             '',
    description:       '',
    areaId:            '',
    assetId:           '',
    category:          'Maintenance',
    performedBy:       'Self',
    performedByCustom: '',
    linkedTaskId:      '',
    createdAt:         '',
    ...overrides,
  };
}

export function normalizePropertyMaintenance(raw: any = {}): PropertyMaintenance {
  return createPropertyMaintenance({
    id:                raw.id                ?? '',
    propertyId:        raw.propertyId        ?? '',
    date:              raw.date              ?? '',
    title:             raw.title             ?? '',
    description:       raw.description       ?? '',
    areaId:            raw.areaId            ?? '',
    assetId:           raw.assetId           ?? '',
    category:          raw.category          ?? 'Maintenance',
    performedBy:       raw.performedBy       ?? 'Self',
    performedByCustom: raw.performedByCustom ?? '',
    linkedTaskId:      raw.linkedTaskId      ?? '',
    createdAt:         raw.createdAt         ?? '',
  });
}
