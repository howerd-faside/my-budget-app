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
