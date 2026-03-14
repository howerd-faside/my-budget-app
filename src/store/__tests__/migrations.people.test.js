/**
 * Tests for src/store/migrations/people.js
 *
 * Covers:
 *   - v0 → v1: normalizes people (ensures sub-arrays present)
 *   - v0 → v1: migrates legacy expense type='fixed' → type='standard', subtype='fixed'
 *   - v0 → v1: migrates legacy expense type='variable' → type='standard', subtype='variable'
 *   - v0 → v1: backfills missing startDate on expenses
 *   - v0 → v1: preserves existing startDate on expenses
 *   - v0 → v1: normalizes wishlist items
 *   - v0 → v1: initializes missing slices to []
 *   - v0 → v1: preserves existing non-empty slices
 *   - v2 → v3: normalizes endDate '' to null on incomeEvents and employmentHistory
 */
import { describe, it, expect } from 'vitest';
import { PEOPLE_MIGRATIONS } from '../migrations/people';

const migrateV1 = PEOPLE_MIGRATIONS.find(m => m.toVersion === 1).migrate;
const migrateV2 = PEOPLE_MIGRATIONS.find(m => m.toVersion === 2).migrate;

describe('people migration v0 → v1', () => {
  describe('people normalization', () => {
    it('ensures secondaryIncomes is an array when missing', () => {
      const slice = { people: [{ id: 'p1', name: 'Alice' }] };
      const result = migrateV1(slice);
      expect(Array.isArray(result.people[0].secondaryIncomes)).toBe(true);
    });

    it('ensures incomeEvents is an array when missing', () => {
      const slice = { people: [{ id: 'p1', name: 'Alice' }] };
      const result = migrateV1(slice);
      expect(Array.isArray(result.people[0].incomeEvents)).toBe(true);
    });

    it('ensures employmentHistory is an array when missing', () => {
      const slice = { people: [{ id: 'p1', name: 'Alice' }] };
      const result = migrateV1(slice);
      expect(Array.isArray(result.people[0].employmentHistory)).toBe(true);
    });

    it('preserves existing people data', () => {
      const slice = {
        people: [{ id: 'p1', name: 'Bob', grossAnnual: 80000, taxCode: 'M', secondaryIncomes: [] }],
      };
      const result = migrateV1(slice);
      expect(result.people[0].name).toBe('Bob');
      expect(result.people[0].grossAnnual).toBe(80000);
    });

    it('initializes people to [] when missing', () => {
      const result = migrateV1({ expenses: [], wishlist: [] });
      expect(result.people).toEqual([]);
    });
  });

  describe('expense normalization', () => {
    it("migrates legacy type='fixed' to type='standard', subtype='fixed'", () => {
      const slice = {
        expenses: [{ id: 'e1', name: 'Rent', type: 'fixed', amount: 1000, frequency: 'monthly', startDate: '2025-01-01' }],
      };
      const result = migrateV1(slice);
      expect(result.expenses[0].type).toBe('standard');
      expect(result.expenses[0].subtype).toBe('fixed');
    });

    it("migrates legacy type='variable' to type='standard', subtype='variable'", () => {
      const slice = {
        expenses: [{ id: 'e2', name: 'Groceries', type: 'variable', amount: 300, frequency: 'weekly', startDate: '2025-01-01' }],
      };
      const result = migrateV1(slice);
      expect(result.expenses[0].type).toBe('standard');
      expect(result.expenses[0].subtype).toBe('variable');
    });

    it('backfills missing startDate to 2025-11-10', () => {
      const slice = {
        expenses: [{ id: 'e3', name: 'Insurance', type: 'standard', amount: 200, frequency: 'monthly' }],
      };
      const result = migrateV1(slice);
      expect(result.expenses[0].startDate).toBe('2025-11-10');
    });

    it('preserves existing startDate', () => {
      const slice = {
        expenses: [{ id: 'e4', name: 'Insurance', type: 'standard', amount: 200, frequency: 'monthly', startDate: '2025-06-01' }],
      };
      const result = migrateV1(slice);
      expect(result.expenses[0].startDate).toBe('2025-06-01');
    });

    it('ensures facilities is an array when missing', () => {
      const slice = {
        expenses: [{ id: 'e5', name: 'Mortgage', type: 'loan', startDate: '2025-01-01' }],
      };
      const result = migrateV1(slice);
      expect(Array.isArray(result.expenses[0].facilities)).toBe(true);
    });

    it('initializes expenses to [] when missing', () => {
      const result = migrateV1({ people: [], wishlist: [] });
      expect(result.expenses).toEqual([]);
    });
  });

  describe('wishlist normalization', () => {
    it('normalizes wishlist items and sets purchased default', () => {
      const slice = {
        wishlist: [{ id: 'w1', name: 'Bike', estimatedCost: '800' }],
      };
      const result = migrateV1(slice);
      expect(result.wishlist[0].purchased).toBe(false);
      expect(result.wishlist[0].name).toBe('Bike');
      // v1 already calls updated normalizeWishlistItem — estimatedCost is now a number
      expect(result.wishlist[0].estimatedCost).toBe(800);
    });

    it('normalizes missing estimatedCost to null', () => {
      const slice = { wishlist: [{ id: 'w2', name: 'Camera' }] };
      const result = migrateV1(slice);
      expect(result.wishlist[0].estimatedCost).toBeNull();
    });

    it('initializes wishlist to [] when missing', () => {
      const result = migrateV1({ people: [], expenses: [] });
      expect(result.wishlist).toEqual([]);
    });
  });
});

describe('people migration v1 → v2', () => {
  describe('Person numeric field coercion', () => {
    it('coerces grossAnnual string to number', () => {
      const slice = {
        people: [{ id: 'p1', name: 'Alice', grossAnnual: '95000', taxCode: 'M', kiwiSaverRate: 3 }],
      };
      const result = migrateV2(slice);
      expect(result.people[0].grossAnnual).toBe(95000);
      expect(typeof result.people[0].grossAnnual).toBe('number');
    });

    it('coerces kiwiSaverRate string to number', () => {
      const slice = {
        people: [{ id: 'p1', name: 'Alice', grossAnnual: 80000, kiwiSaverRate: '4' }],
      };
      const result = migrateV2(slice);
      expect(result.people[0].kiwiSaverRate).toBe(4);
    });

    it('preserves kiwiSaverRate of 0 (not enrolled)', () => {
      const slice = {
        people: [{ id: 'p1', name: 'Alice', grossAnnual: 80000, kiwiSaverRate: 0 }],
      };
      const result = migrateV2(slice);
      expect(result.people[0].kiwiSaverRate).toBe(0);
    });

    it('coerces string grossAnnual on secondaryIncomes to number', () => {
      const slice = {
        people: [{
          id: 'p1', name: 'Alice', grossAnnual: 80000,
          secondaryIncomes: [{ id: 's1', name: 'Rental', amount: '600', frequency: 'monthly' }],
        }],
      };
      const result = migrateV2(slice);
      expect(result.people[0].secondaryIncomes[0].amount).toBe(600);
    });

    it('coerces string grossAnnual on incomeEvents to number', () => {
      const slice = {
        people: [{
          id: 'p1', name: 'Alice', grossAnnual: 80000,
          incomeEvents: [{ id: 'e1', label: 'Parental Leave', startDate: '2026-01-01', endDate: '', grossAnnual: '25000' }],
        }],
      };
      const result = migrateV2(slice);
      expect(result.people[0].incomeEvents[0].grossAnnual).toBe(25000);
    });

    it('coerces string grossAnnual on employmentHistory to number', () => {
      const slice = {
        people: [{
          id: 'p1', name: 'Alice', grossAnnual: 80000,
          employmentHistory: [{ id: 'r1', employer: 'ACME', role: 'Dev', startDate: '2023-01-01', endDate: '', grossAnnual: '90000' }],
        }],
      };
      const result = migrateV2(slice);
      expect(result.people[0].employmentHistory[0].grossAnnual).toBe(90000);
    });

    it('uses 0 for empty string grossAnnual', () => {
      const slice = { people: [{ id: 'p1', name: 'Alice', grossAnnual: '' }] };
      const result = migrateV2(slice);
      expect(result.people[0].grossAnnual).toBe(0);
    });
  });

  describe('Expense numeric field coercion', () => {
    it('coerces string expense amount to number', () => {
      const slice = {
        expenses: [{ id: 'e1', name: 'Rent', type: 'standard', amount: '1800', frequency: 'monthly', startDate: '2025-01-01' }],
      };
      const result = migrateV2(slice);
      expect(result.expenses[0].amount).toBe(1800);
      expect(typeof result.expenses[0].amount).toBe('number');
    });

    it('coerces numeric string ddDay to number', () => {
      const slice = {
        expenses: [{ id: 'e1', name: 'Power', amount: '100', frequency: 'monthly', ddDay: '15', startDate: '2025-01-01' }],
      };
      const result = migrateV2(slice);
      expect(result.expenses[0].ddDay).toBe(15);
    });

    it('normalizes empty ddDay to null', () => {
      const slice = {
        expenses: [{ id: 'e1', name: 'Power', amount: '100', frequency: 'monthly', ddDay: '', startDate: '2025-01-01' }],
      };
      const result = migrateV2(slice);
      expect(result.expenses[0].ddDay).toBeNull();
    });

    it('uses 0 for empty/missing expense amount', () => {
      const slice = {
        expenses: [{ id: 'e1', name: 'Power', amount: '', frequency: 'monthly', startDate: '2025-01-01' }],
      };
      const result = migrateV2(slice);
      expect(result.expenses[0].amount).toBe(0);
    });

    it('coerces facility balance, rate, and amount to numbers', () => {
      const slice = {
        expenses: [{
          id: 'e1', name: 'Mortgage', type: 'loan', amount: '0', frequency: 'fortnightly',
          startDate: '2025-01-01',
          facilities: [{ id: 'f1', label: 'Fixed', balance: '450000', rate: '6.5', amount: '1200', frequency: 'fortnightly' }],
        }],
      };
      const result = migrateV2(slice);
      const fac = result.expenses[0].facilities[0];
      expect(fac.balance).toBe(450000);
      expect(fac.rate).toBe(6.5);
      expect(fac.amount).toBe(1200);
    });
  });

  describe('WishlistItem estimatedCost coercion', () => {
    it('coerces string estimatedCost to number', () => {
      const slice = { wishlist: [{ id: 'w1', name: 'Bike', estimatedCost: '1200' }] };
      const result = migrateV2(slice);
      expect(result.wishlist[0].estimatedCost).toBe(1200);
    });

    it('normalizes empty estimatedCost to null', () => {
      const slice = { wishlist: [{ id: 'w1', name: 'Camera', estimatedCost: '' }] };
      const result = migrateV2(slice);
      expect(result.wishlist[0].estimatedCost).toBeNull();
    });

    it('preserves already-numeric estimatedCost', () => {
      const slice = { wishlist: [{ id: 'w1', name: 'Laptop', estimatedCost: 2500 }] };
      const result = migrateV2(slice);
      expect(result.wishlist[0].estimatedCost).toBe(2500);
    });
  });
});

const migrateV3 = PEOPLE_MIGRATIONS.find(m => m.toVersion === 3).migrate;

describe('people migration v2 → v3', () => {
  describe('incomeEvent endDate normalization', () => {
    it('normalizes empty string endDate to null (ongoing event)', () => {
      const slice = {
        people: [{
          id: 'p1', name: 'Alice', grossAnnual: 80000,
          incomeEvents: [{ id: 'e1', label: 'Parental Leave', startDate: '2026-01-01', endDate: '', grossAnnual: 25000 }],
        }],
      };
      const result = migrateV3(slice);
      expect(result.people[0].incomeEvents[0].endDate).toBeNull();
    });

    it('preserves existing endDate string', () => {
      const slice = {
        people: [{
          id: 'p1', name: 'Alice', grossAnnual: 80000,
          incomeEvents: [{ id: 'e1', label: 'Leave', startDate: '2026-01-01', endDate: '2026-06-01', grossAnnual: 25000 }],
        }],
      };
      const result = migrateV3(slice);
      expect(result.people[0].incomeEvents[0].endDate).toBe('2026-06-01');
    });
  });

  describe('employmentRole endDate normalization', () => {
    it('normalizes empty string endDate to null (current role)', () => {
      const slice = {
        people: [{
          id: 'p1', name: 'Alice', grossAnnual: 80000,
          employmentHistory: [{ id: 'r1', employer: 'ACME', role: 'Dev', startDate: '2023-01-01', endDate: '', grossAnnual: 90000 }],
        }],
      };
      const result = migrateV3(slice);
      expect(result.people[0].employmentHistory[0].endDate).toBeNull();
    });

    it('preserves existing endDate on past roles', () => {
      const slice = {
        people: [{
          id: 'p1', name: 'Alice', grossAnnual: 80000,
          employmentHistory: [{ id: 'r1', employer: 'ACME', role: 'Dev', startDate: '2020-01-01', endDate: '2022-12-31', grossAnnual: 75000 }],
        }],
      };
      const result = migrateV3(slice);
      expect(result.people[0].employmentHistory[0].endDate).toBe('2022-12-31');
    });
  });

  it('skips migration when people is missing', () => {
    const result = migrateV3({});
    expect(result.people).toBeUndefined();
  });
});
