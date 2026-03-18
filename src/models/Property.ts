/**
 * @fileoverview Domain model for a real-estate property and its embedded area records.
 *
 * Inconsistencies detected:
 * - `valuation` is a nullable sub-object added by the web lookup feature;
 *   older property records lack the key. normalizeProperty sets it to null when absent.
 * - `areas` items use an `id`-based reference system, but the `group` field only
 *   constrains to four string values.
 * - `insulation` is a nested object with three sub-fields. Early property records
 *   may lack the sub-object entirely.
 */

export const PROPERTY_TYPES = ['Primary Home', 'Rental', 'Bach/Holiday', 'Investment', 'Land/Section', 'Other'] as const;
export type PropertyType = typeof PROPERTY_TYPES[number];

export const CONSTRUCTION_TYPES = ['', 'Timber Frame', 'Brick and Tile', 'Concrete Block', 'Steel Frame', 'Other'] as const;
export const ROOF_TYPES = ['', 'Iron/Colorsteel', 'Tile', 'Concrete Tile', 'Membrane', 'Shingle', 'Other'] as const;
export const CLADDING_TYPES = ['', 'Weatherboard', 'Brick Veneer', 'Stucco', 'Fibre Cement', 'Aluminium', 'Stone', 'Other'] as const;
export const HEATING_TYPES = ['', 'Heat pump', 'Gas central', 'Wood burner', 'Underfloor', 'Panel heaters', 'Multi', 'None'] as const;
export const WATER_SUPPLY_OPTIONS = ['', 'Mains', 'Tank', 'Bore', 'Mains + Tank'] as const;
export const WASTEWATER_OPTIONS = ['', 'Mains sewer', 'Septic'] as const;
export const INSULATION_OPTIONS = ['yes', 'no', 'unknown'] as const;
export const AREA_GROUPS = ['Interior', 'Exterior', 'Grounds', 'Other'] as const;

export type InsulationStatus = typeof INSULATION_OPTIONS[number];
export type AreaGroup = typeof AREA_GROUPS[number];

// ── Private helpers ──────────────────────────────────────────────────────────

function toNumOrNull(val: any): number | null {
  if (val === '' || val == null) return null;
  const n = parseFloat(val);
  return isFinite(n) ? n : null;
}

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface PropertyArea {
  id: string;
  name: string;
  group: AreaGroup;
}

export interface PropertyValuation {
  id: string;
  rv: number | null;
  landValue: number | null;
  improvementsValue: number | null;
  valuationDate: string;
  estimatedValue: number | null;
  createdAt: string;
}

export interface Insulation {
  ceiling: InsulationStatus;
  underfloor: InsulationStatus;
  walls: InsulationStatus;
}

export interface Property {
  id: string;
  name: string;
  type: PropertyType;
  address: string;
  landArea: number | null;
  floorArea: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  yearBuilt: number | null;
  constructionType: string;
  roofType: string;
  cladding: string;
  insulation: Insulation;
  heating: string;
  waterSupply: string;
  wastewater: string;
  notes: string;
  areas: PropertyArea[];
  valuations: PropertyValuation[];
}

export function createPropertyArea(overrides: any = {}): PropertyArea {
  return { id: '', name: '', group: 'Interior', ...overrides };
}

export function createProperty(overrides: any = {}) {
  return {
    id:               '',
    name:             '',
    type:             'Primary Home',
    address:          '',
    landArea:         '',
    floorArea:        '',
    bedrooms:         '',
    bathrooms:        '',
    yearBuilt:        '',
    constructionType: '',
    roofType:         '',
    cladding:         '',
    insulation:       { ceiling: 'unknown', underfloor: 'unknown', walls: 'unknown' },
    heating:          '',
    waterSupply:      '',
    wastewater:       '',
    notes:            '',
    areas:            [],
    valuations:       [],
    ...overrides,
  };
}

function normalizeValuation(v: any): PropertyValuation {
  return {
    id:                v.id                ?? crypto.randomUUID(),
    rv:                toNumOrNull(v.rv),
    landValue:         toNumOrNull(v.landValue),
    improvementsValue: toNumOrNull(v.improvementsValue),
    valuationDate:     v.valuationDate     ?? '',
    estimatedValue:    toNumOrNull(v.estimatedValue),
    createdAt:         v.createdAt || v.fetchedAt || '',
  };
}

export function normalizeProperty(raw: any = {}): Property {
  const ins = raw.insulation ?? {};

  // Support both old `valuation` (single) and new `valuations` (array)
  let valuations: PropertyValuation[] = [];
  if (Array.isArray(raw.valuations)) {
    valuations = raw.valuations.map(normalizeValuation);
  } else if (raw.valuation) {
    valuations = [normalizeValuation(raw.valuation)];
  }

  return createProperty({
    id:               raw.id               ?? '',
    name:             raw.name             ?? '',
    type:             raw.type             ?? 'Primary Home',
    address:          raw.address          ?? '',
    landArea:         toNumOrNull(raw.landArea),
    floorArea:        toNumOrNull(raw.floorArea),
    bedrooms:         toNumOrNull(raw.bedrooms),
    bathrooms:        toNumOrNull(raw.bathrooms),
    yearBuilt:        toNumOrNull(raw.yearBuilt),
    constructionType: raw.constructionType ?? '',
    roofType:         raw.roofType         ?? '',
    cladding:         raw.cladding         ?? '',
    insulation: {
      ceiling:    ins.ceiling    ?? 'unknown',
      underfloor: ins.underfloor ?? 'unknown',
      walls:      ins.walls      ?? 'unknown',
    },
    heating:     raw.heating     ?? '',
    waterSupply: raw.waterSupply ?? '',
    wastewater:  raw.wastewater  ?? '',
    notes:       raw.notes       ?? '',
    areas:       (raw.areas ?? []).map((a: any) => createPropertyArea(a)),
    valuations,
  });
}
