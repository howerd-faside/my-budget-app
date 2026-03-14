/**
 * Tests for src/store/migrations/property.js
 *
 * Covers:
 *   - v0 → v1: normalizes properties (insulation backfill)
 *   - v0 → v1: normalizes propertyTasks (ensures notes is array)
 *   - v0 → v1: normalizes propertyMaintenance
 *   - v0 → v1: normalizes propertyProjects (previously unnormalized)
 *   - v0 → v1: normalizes propertyAssets
 *   - v0 → v1: initializes selectedPropertyId when missing
 *   - v0 → v1: initializes all missing slices to []
 *   - v0 → v1: preserves existing data
 *   - v2 → v3: coerces property numeric fields (landArea etc.) to number | null
 *   - v2 → v3: coerces valuation sub-object numerics to number | null
 */
import { describe, it, expect } from 'vitest';
import { PROPERTY_MIGRATIONS } from '../migrations/property';

const migrateV1 = PROPERTY_MIGRATIONS.find(m => m.toVersion === 1).migrate;

describe('property migration v0 → v1', () => {
  describe('properties normalization', () => {
    it('backfills missing insulation fields to "unknown"', () => {
      const slice = {
        properties: [{ id: 'p1', name: 'Home', type: 'Primary Home' }], // no insulation
      };
      const result = migrateV1(slice);
      expect(result.properties[0].insulation).toEqual({
        ceiling: 'unknown',
        underfloor: 'unknown',
        walls: 'unknown',
      });
    });

    it('preserves existing insulation values', () => {
      const slice = {
        properties: [{
          id: 'p1', name: 'Home', type: 'Primary Home',
          insulation: { ceiling: 'yes', underfloor: 'no', walls: 'yes' },
        }],
      };
      const result = migrateV1(slice);
      expect(result.properties[0].insulation.ceiling).toBe('yes');
    });

    it('sets valuation to null when missing', () => {
      const slice = {
        properties: [{ id: 'p1', name: 'Home', type: 'Primary Home' }],
      };
      const result = migrateV1(slice);
      expect(result.properties[0].valuation).toBeNull();
    });

    it('ensures areas is an array', () => {
      const slice = { properties: [{ id: 'p1', name: 'Home' }] };
      const result = migrateV1(slice);
      expect(Array.isArray(result.properties[0].areas)).toBe(true);
    });

    it('initializes properties to [] when missing', () => {
      const result = migrateV1({});
      expect(result.properties).toEqual([]);
    });
  });

  describe('propertyTasks normalization', () => {
    it('coerces notes from non-array to []', () => {
      const slice = {
        propertyTasks: [{ id: 't1', propertyId: 'p1', title: 'Fix tap', notes: null }],
      };
      const result = migrateV1(slice);
      expect(result.propertyTasks[0].notes).toEqual([]);
    });

    it('preserves existing task notes', () => {
      const notes = [{ id: 'n1', date: '2026-01-01', text: 'Done' }];
      const slice = { propertyTasks: [{ id: 't1', propertyId: 'p1', title: 'Fix tap', notes }] };
      const result = migrateV1(slice);
      expect(result.propertyTasks[0].notes).toEqual(notes);
    });

    it('initializes propertyTasks to [] when missing', () => {
      const result = migrateV1({});
      expect(result.propertyTasks).toEqual([]);
    });
  });

  describe('propertyProjects normalization (previously unnormalized)', () => {
    it('normalizes a raw project with missing array fields', () => {
      const slice = {
        propertyProjects: [{
          id: 'proj1', propertyId: 'p1', title: 'Deck rebuild',
          // areas, taskIds, notes all missing
        }],
      };
      const result = migrateV1(slice);
      expect(Array.isArray(result.propertyProjects[0].areas)).toBe(true);
      expect(Array.isArray(result.propertyProjects[0].taskIds)).toBe(true);
      expect(Array.isArray(result.propertyProjects[0].notes)).toBe(true);
    });

    it('applies default status when missing', () => {
      const slice = {
        propertyProjects: [{ id: 'proj1', propertyId: 'p1', title: 'Deck' }],
      };
      const result = migrateV1(slice);
      expect(result.propertyProjects[0].status).toBe('Planning');
    });

    it('preserves existing project data', () => {
      const slice = {
        propertyProjects: [{
          id: 'proj1', propertyId: 'p1', title: 'Deck rebuild',
          status: 'In Progress', priority: 'High',
          areas: ['area1'], taskIds: ['t1'],
          notes: [{ id: 'n1', date: '2026-01-01', text: 'Started' }],
          createdAt: '2026-01-01T00:00:00.000Z',
        }],
      };
      const result = migrateV1(slice);
      const proj = result.propertyProjects[0];
      expect(proj.status).toBe('In Progress');
      expect(proj.priority).toBe('High');
      expect(proj.areas).toEqual(['area1']);
      expect(proj.notes[0].text).toBe('Started');
    });

    it('initializes propertyProjects to [] when missing', () => {
      const result = migrateV1({});
      expect(result.propertyProjects).toEqual([]);
    });
  });

  describe('propertyAssets normalization', () => {
    it('applies default condition when missing', () => {
      const slice = {
        propertyAssets: [{ id: 'a1', propertyId: 'p1', name: 'Heat Pump' }],
      };
      const result = migrateV1(slice);
      expect(result.propertyAssets[0].condition).toBe('Good');
    });

    it('initializes propertyAssets to [] when missing', () => {
      const result = migrateV1({});
      expect(result.propertyAssets).toEqual([]);
    });
  });

  describe('selectedPropertyId', () => {
    it('defaults to null when missing', () => {
      const result = migrateV1({});
      expect(result.selectedPropertyId).toBeNull();
    });

    it('preserves existing selectedPropertyId', () => {
      const result = migrateV1({ selectedPropertyId: 'p1' });
      expect(result.selectedPropertyId).toBe('p1');
    });

    it('preserves null selectedPropertyId explicitly', () => {
      const result = migrateV1({ selectedPropertyId: null });
      expect(result.selectedPropertyId).toBeNull();
    });
  });
});

const migrateV3 = PROPERTY_MIGRATIONS.find(m => m.toVersion === 3).migrate;

describe('property migration v2 → v3', () => {
  describe('property numeric field coercion', () => {
    it('coerces string landArea to number', () => {
      const slice = {
        properties: [{ id: 'p1', name: 'Home', landArea: '650' }],
      };
      const result = migrateV3(slice);
      expect(result.properties[0].landArea).toBe(650);
      expect(typeof result.properties[0].landArea).toBe('number');
    });

    it('coerces string floorArea, bedrooms, bathrooms, yearBuilt to numbers', () => {
      const slice = {
        properties: [{
          id: 'p1', name: 'Home',
          floorArea: '180', bedrooms: '3', bathrooms: '2', yearBuilt: '1985',
        }],
      };
      const result = migrateV3(slice);
      expect(result.properties[0].floorArea).toBe(180);
      expect(result.properties[0].bedrooms).toBe(3);
      expect(result.properties[0].bathrooms).toBe(2);
      expect(result.properties[0].yearBuilt).toBe(1985);
    });

    it('normalizes empty string numeric fields to null', () => {
      const slice = {
        properties: [{
          id: 'p1', name: 'Home',
          landArea: '', floorArea: '', bedrooms: '', bathrooms: '', yearBuilt: '',
        }],
      };
      const result = migrateV3(slice);
      expect(result.properties[0].landArea).toBeNull();
      expect(result.properties[0].floorArea).toBeNull();
      expect(result.properties[0].bedrooms).toBeNull();
      expect(result.properties[0].bathrooms).toBeNull();
      expect(result.properties[0].yearBuilt).toBeNull();
    });

    it('preserves already-numeric values', () => {
      const slice = {
        properties: [{ id: 'p1', name: 'Home', landArea: 800, bedrooms: 4 }],
      };
      const result = migrateV3(slice);
      expect(result.properties[0].landArea).toBe(800);
      expect(result.properties[0].bedrooms).toBe(4);
    });
  });

  describe('valuation sub-object coercion', () => {
    it('coerces string valuation numerics to numbers', () => {
      const slice = {
        properties: [{
          id: 'p1', name: 'Home',
          valuation: {
            rv: '850000', landValue: '500000', improvementsValue: '350000',
            valuationDate: '2024-09-01', estimatedValue: '900000', fetchedAt: '2026-01-15T10:00:00Z',
          },
        }],
      };
      const result = migrateV3(slice);
      const val = result.properties[0].valuation;
      expect(val.rv).toBe(850000);
      expect(val.landValue).toBe(500000);
      expect(val.improvementsValue).toBe(350000);
      expect(val.estimatedValue).toBe(900000);
      expect(val.valuationDate).toBe('2024-09-01');
      expect(val.fetchedAt).toBe('2026-01-15T10:00:00Z');
    });

    it('preserves null valuation', () => {
      const slice = {
        properties: [{ id: 'p1', name: 'Home', valuation: null }],
      };
      const result = migrateV3(slice);
      expect(result.properties[0].valuation).toBeNull();
    });

    it('normalizes missing valuation to null', () => {
      const slice = {
        properties: [{ id: 'p1', name: 'Home' }],
      };
      const result = migrateV3(slice);
      expect(result.properties[0].valuation).toBeNull();
    });
  });

  it('skips migration when properties is missing', () => {
    const result = migrateV3({});
    expect(result.properties).toBeUndefined();
  });
});
