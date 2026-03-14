/**
 * @fileoverview Domain model for a property asset (appliance, fixture, or system).
 *
 * Numeric normalization:
 *   `normalizePropertyAsset` coerces `expectedLifespan` to number | null.
 *   null means "lifespan unknown"; `createPropertyAsset` retains `''` default for form binding.
 */

export const ASSET_TYPES = ['HVAC', 'Plumbing', 'Electrical', 'Appliance', 'Structural', 'Roofing', 'Exterior', 'Security', 'Other'] as const;
export type AssetType = typeof ASSET_TYPES[number];

export const ASSET_CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor', 'Critical'] as const;
export type AssetCondition = typeof ASSET_CONDITIONS[number];

/** Pill colour class keyed by condition. */
export const CONDITION_PILL = {
  Excellent: 'green', Good: 'teal', Fair: 'amber', Poor: 'orange', Critical: 'red',
} as const;

export interface PropertyAsset {
  id: string;
  propertyId: string;
  name: string;
  type: AssetType;
  areaId: string;
  brand: string;
  model: string;
  dateInstalled: string;
  warrantyExpiry: string;
  expectedLifespan: number | null;
  condition: AssetCondition;
  notes: string;
  createdAt: string;
}

export function createPropertyAsset(overrides: any = {}) {
  return {
    id:               '',
    propertyId:       '',
    name:             '',
    type:             'Appliance',
    areaId:           '',
    brand:            '',
    model:            '',
    dateInstalled:    '',
    warrantyExpiry:   '',
    expectedLifespan: '',
    condition:        'Good',
    notes:            '',
    createdAt:        '',
    ...overrides,
  };
}

function toNumOrNull(val: any): number | null {
  if (val === '' || val == null) return null;
  const n = parseFloat(val);
  return isFinite(n) ? n : null;
}

export function normalizePropertyAsset(raw: any = {}): PropertyAsset {
  return createPropertyAsset({
    id:               raw.id               ?? '',
    propertyId:       raw.propertyId       ?? '',
    name:             raw.name             ?? '',
    type:             raw.type             ?? 'Appliance',
    areaId:           raw.areaId           ?? '',
    brand:            raw.brand            ?? '',
    model:            raw.model            ?? '',
    dateInstalled:    raw.dateInstalled    ?? '',
    warrantyExpiry:   raw.warrantyExpiry   ?? '',
    expectedLifespan: toNumOrNull(raw.expectedLifespan),
    condition:        raw.condition        ?? 'Good',
    notes:            raw.notes            ?? '',
    createdAt:        raw.createdAt        ?? '',
  });
}
