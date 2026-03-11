/**
 * Tests for numeric field normalization across all domain models.
 *
 * Validates that normalize* functions:
 *   - Coerce string numbers → actual numbers
 *   - Coerce empty strings → 0 or null (per field semantics)
 *   - Preserve already-numeric values unchanged
 *   - Handle null / undefined inputs gracefully
 *   - Treat non-numeric strings as 0 or null
 *
 * Fields tested by domain:
 *   People:      Person.grossAnnual, kiwiSaverRate
 *                SecondaryIncome.amount
 *                IncomeEvent.grossAnnual
 *                EmploymentRole.grossAnnual
 *                AssetIncome.amount
 *   Expenses:    Expense.amount, ddDay
 *                Facility.balance, rate, amount
 *   Wishlist:    WishlistItem.estimatedCost (number | null)
 *   Investments: Holding.units, avgCost, currentPrice
 *                InvestmentContribution.amount
 *                Dividend.grossAmount, taxAmount, netAmount
 *   Property:    PropertyAsset.expectedLifespan (number | null)
 */
import { describe, it, expect } from 'vitest';

import {
  normalizePerson,
  normalizeSecondaryIncome,
  normalizeIncomeEvent,
  normalizeEmploymentRole,
  normalizeAssetIncome,
} from '../../models/Person';

import { normalizeExpense, normalizeFacility }          from '../../models/Expense';
import { normalizeWishlistItem }                        from '../../models/WishlistItem';
import { normalizeHolding }                             from '../../models/Holding';
import { normalizeInvestmentContribution }              from '../../models/InvestmentContribution';
import { normalizeDividend }                            from '../../models/Dividend';
import { normalizePropertyAsset }                       from '../../models/PropertyAsset';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Assert that a field is a number (not NaN, not string). */
function expectNum(val, expected) {
  expect(typeof val).toBe('number');
  expect(isNaN(val)).toBe(false);
  expect(val).toBe(expected);
}

// ── Person domain ─────────────────────────────────────────────────────────────

describe('normalizePerson — numeric fields', () => {
  it('coerces string grossAnnual to number', () => {
    const p = normalizePerson({ grossAnnual: '85000' });
    expectNum(p.grossAnnual, 85000);
  });

  it('coerces float string grossAnnual to number', () => {
    const p = normalizePerson({ grossAnnual: '72500.50' });
    expectNum(p.grossAnnual, 72500.5);
  });

  it('uses 0 for empty grossAnnual', () => {
    expectNum(normalizePerson({ grossAnnual: '' }).grossAnnual, 0);
  });

  it('uses 0 for null grossAnnual', () => {
    expectNum(normalizePerson({ grossAnnual: null }).grossAnnual, 0);
  });

  it('uses 0 for non-numeric grossAnnual', () => {
    expectNum(normalizePerson({ grossAnnual: 'abc' }).grossAnnual, 0);
  });

  it('preserves numeric grossAnnual', () => {
    expectNum(normalizePerson({ grossAnnual: 100000 }).grossAnnual, 100000);
  });

  it('coerces string kiwiSaverRate to number', () => {
    expectNum(normalizePerson({ kiwiSaverRate: '4' }).kiwiSaverRate, 4);
  });

  it('preserves kiwiSaverRate 0 (not enrolled)', () => {
    expectNum(normalizePerson({ kiwiSaverRate: 0 }).kiwiSaverRate, 0);
  });

  it('defaults kiwiSaverRate to 3 when absent', () => {
    expectNum(normalizePerson({}).kiwiSaverRate, 3);
  });

  it('normalizes numeric fields in nested secondaryIncomes', () => {
    const p = normalizePerson({
      secondaryIncomes: [{ id: 's1', name: 'Rental', amount: '650', frequency: 'monthly' }],
    });
    expectNum(p.secondaryIncomes[0].amount, 650);
  });

  it('normalizes grossAnnual in nested incomeEvents', () => {
    const p = normalizePerson({
      incomeEvents: [{ id: 'e1', label: 'Leave', startDate: '2026-01-01', grossAnnual: '30000' }],
    });
    expectNum(p.incomeEvents[0].grossAnnual, 30000);
  });

  it('normalizes grossAnnual in nested employmentHistory', () => {
    const p = normalizePerson({
      employmentHistory: [{ id: 'r1', employer: 'ACME', startDate: '2023-01-01', grossAnnual: '110000' }],
    });
    expectNum(p.employmentHistory[0].grossAnnual, 110000);
  });
});

describe('normalizeSecondaryIncome — amount', () => {
  it('coerces string amount to number', () => {
    expectNum(normalizeSecondaryIncome({ amount: '400' }).amount, 400);
  });

  it('uses 0 for empty amount', () => {
    expectNum(normalizeSecondaryIncome({ amount: '' }).amount, 0);
  });

  it('preserves numeric amount', () => {
    expectNum(normalizeSecondaryIncome({ amount: 250.5 }).amount, 250.5);
  });
});

describe('normalizeIncomeEvent — grossAnnual', () => {
  it('coerces string grossAnnual to number', () => {
    expectNum(normalizeIncomeEvent({ grossAnnual: '45000' }).grossAnnual, 45000);
  });

  it('uses 0 for empty grossAnnual', () => {
    expectNum(normalizeIncomeEvent({ grossAnnual: '' }).grossAnnual, 0);
  });
});

describe('normalizeEmploymentRole — grossAnnual', () => {
  it('coerces string grossAnnual to number', () => {
    expectNum(normalizeEmploymentRole({ grossAnnual: '95000' }).grossAnnual, 95000);
  });

  it('uses 0 for missing grossAnnual', () => {
    expectNum(normalizeEmploymentRole({}).grossAnnual, 0);
  });
});

describe('normalizeAssetIncome — amount', () => {
  it('coerces string amount to number', () => {
    expectNum(normalizeAssetIncome({ amount: '1200' }).amount, 1200);
  });

  it('uses 0 for empty amount', () => {
    expectNum(normalizeAssetIncome({ amount: '' }).amount, 0);
  });
});

// ── Expense domain ────────────────────────────────────────────────────────────

describe('normalizeExpense — numeric fields', () => {
  it('coerces string amount to number', () => {
    expectNum(normalizeExpense({ amount: '350' }).amount, 350);
  });

  it('uses 0 for empty amount', () => {
    expectNum(normalizeExpense({ amount: '' }).amount, 0);
  });

  it('uses 0 for non-numeric amount', () => {
    expectNum(normalizeExpense({ amount: 'abc' }).amount, 0);
  });

  it('preserves numeric amount', () => {
    expectNum(normalizeExpense({ amount: 1500 }).amount, 1500);
  });

  it('coerces string ddDay to number', () => {
    expectNum(normalizeExpense({ ddDay: '15' }).ddDay, 15);
  });

  it('normalizes empty ddDay to null', () => {
    expect(normalizeExpense({ ddDay: '' }).ddDay).toBeNull();
  });

  it('normalizes null ddDay to null', () => {
    expect(normalizeExpense({ ddDay: null }).ddDay).toBeNull();
  });

  it('normalizes missing ddDay to null', () => {
    expect(normalizeExpense({}).ddDay).toBeNull();
  });

  it('preserves numeric ddDay', () => {
    expectNum(normalizeExpense({ ddDay: 5 }).ddDay, 5);
  });
});

describe('normalizeFacility — numeric fields', () => {
  it('coerces string balance to number', () => {
    expectNum(normalizeFacility({ balance: '450000' }).balance, 450000);
  });

  it('coerces string rate to number', () => {
    expectNum(normalizeFacility({ rate: '6.79' }).rate, 6.79);
  });

  it('coerces string amount to number', () => {
    expectNum(normalizeFacility({ amount: '1300' }).amount, 1300);
  });

  it('uses 0 for empty balance, rate, amount', () => {
    const f = normalizeFacility({ balance: '', rate: '', amount: '' });
    expectNum(f.balance, 0);
    expectNum(f.rate, 0);
    expectNum(f.amount, 0);
  });

  it('preserves already-numeric fields', () => {
    const f = normalizeFacility({ balance: 320000, rate: 5.5, amount: 900 });
    expectNum(f.balance, 320000);
    expectNum(f.rate, 5.5);
    expectNum(f.amount, 900);
  });
});

// ── Wishlist domain ───────────────────────────────────────────────────────────

describe('normalizeWishlistItem — estimatedCost', () => {
  it('coerces string estimatedCost to number', () => {
    expectNum(normalizeWishlistItem({ estimatedCost: '1200' }).estimatedCost, 1200);
  });

  it('normalizes empty estimatedCost to null', () => {
    expect(normalizeWishlistItem({ estimatedCost: '' }).estimatedCost).toBeNull();
  });

  it('normalizes null estimatedCost to null', () => {
    expect(normalizeWishlistItem({ estimatedCost: null }).estimatedCost).toBeNull();
  });

  it('normalizes missing estimatedCost to null', () => {
    expect(normalizeWishlistItem({}).estimatedCost).toBeNull();
  });

  it('preserves numeric estimatedCost including 0 (free item)', () => {
    expectNum(normalizeWishlistItem({ estimatedCost: 0 }).estimatedCost, 0);
  });

  it('preserves non-zero numeric estimatedCost', () => {
    expectNum(normalizeWishlistItem({ estimatedCost: 2999 }).estimatedCost, 2999);
  });

  it('normalizes non-numeric string to null', () => {
    expect(normalizeWishlistItem({ estimatedCost: 'unknown' }).estimatedCost).toBeNull();
  });
});

// ── Investment domain ─────────────────────────────────────────────────────────

describe('normalizeHolding — numeric fields', () => {
  it('coerces string units to number', () => {
    expectNum(normalizeHolding({ units: '50' }).units, 50);
  });

  it('coerces float string avgCost to number', () => {
    expectNum(normalizeHolding({ avgCost: '12.34' }).avgCost, 12.34);
  });

  it('coerces string currentPrice to number', () => {
    expectNum(normalizeHolding({ currentPrice: '18.99' }).currentPrice, 18.99);
  });

  it('uses 0 for empty/missing numeric holding fields', () => {
    const h = normalizeHolding({ units: '', avgCost: null, currentPrice: undefined });
    expectNum(h.units, 0);
    expectNum(h.avgCost, 0);
    expectNum(h.currentPrice, 0);
  });

  it('preserves already-numeric values', () => {
    const h = normalizeHolding({ units: 100, avgCost: 5.5, currentPrice: 7.25 });
    expectNum(h.units, 100);
    expectNum(h.avgCost, 5.5);
    expectNum(h.currentPrice, 7.25);
  });

  it('uses 0 for non-numeric string fields', () => {
    const h = normalizeHolding({ units: 'N/A', avgCost: '-', currentPrice: '' });
    expectNum(h.units, 0);
    expectNum(h.avgCost, 0);
    expectNum(h.currentPrice, 0);
  });
});

describe('normalizeInvestmentContribution — amount', () => {
  it('coerces string amount to number', () => {
    expectNum(normalizeInvestmentContribution({ amount: '500' }).amount, 500);
  });

  it('uses 0 for empty amount', () => {
    expectNum(normalizeInvestmentContribution({ amount: '' }).amount, 0);
  });

  it('preserves numeric amount', () => {
    expectNum(normalizeInvestmentContribution({ amount: 1000 }).amount, 1000);
  });
});

describe('normalizeDividend — amount fields', () => {
  it('coerces string grossAmount to number', () => {
    expectNum(normalizeDividend({ grossAmount: '150' }).grossAmount, 150);
  });

  it('coerces string taxAmount to number', () => {
    expectNum(normalizeDividend({ taxAmount: '49.5' }).taxAmount, 49.5);
  });

  it('coerces string netAmount to number', () => {
    expectNum(normalizeDividend({ netAmount: '100.5' }).netAmount, 100.5);
  });

  it('uses 0 for empty amount fields', () => {
    const d = normalizeDividend({ grossAmount: '', taxAmount: null, netAmount: undefined });
    expectNum(d.grossAmount, 0);
    expectNum(d.taxAmount, 0);
    expectNum(d.netAmount, 0);
  });

  it('preserves already-numeric dividend amounts', () => {
    const d = normalizeDividend({ grossAmount: 200, taxAmount: 66, netAmount: 134 });
    expectNum(d.grossAmount, 200);
    expectNum(d.taxAmount, 66);
    expectNum(d.netAmount, 134);
  });
});

// ── Property domain ───────────────────────────────────────────────────────────

describe('normalizePropertyAsset — expectedLifespan', () => {
  it('coerces string expectedLifespan to number', () => {
    expectNum(normalizePropertyAsset({ expectedLifespan: '15' }).expectedLifespan, 15);
  });

  it('normalizes empty expectedLifespan to null', () => {
    expect(normalizePropertyAsset({ expectedLifespan: '' }).expectedLifespan).toBeNull();
  });

  it('normalizes null expectedLifespan to null', () => {
    expect(normalizePropertyAsset({ expectedLifespan: null }).expectedLifespan).toBeNull();
  });

  it('normalizes missing expectedLifespan to null', () => {
    expect(normalizePropertyAsset({}).expectedLifespan).toBeNull();
  });

  it('preserves numeric expectedLifespan', () => {
    expectNum(normalizePropertyAsset({ expectedLifespan: 20 }).expectedLifespan, 20);
  });

  it('normalizes non-numeric string to null', () => {
    expect(normalizePropertyAsset({ expectedLifespan: 'unknown' }).expectedLifespan).toBeNull();
  });
});

// ── Persistence round-trip ────────────────────────────────────────────────────

describe('normalization round-trip (simulated storage read)', () => {
  it('a holding round-trips through JSON serialization with numeric types intact', () => {
    // Simulates: stored as number → JSON.stringify → JSON.parse → normalizeHolding
    const original = normalizeHolding({ units: 50, avgCost: 12.5, currentPrice: 15 });
    const jsonCycled = JSON.parse(JSON.stringify(original));
    const renormalized = normalizeHolding(jsonCycled);

    expectNum(renormalized.units, 50);
    expectNum(renormalized.avgCost, 12.5);
    expectNum(renormalized.currentPrice, 15);
  });

  it('a person round-trips with grossAnnual as number', () => {
    const original = normalizePerson({ grossAnnual: 85000, kiwiSaverRate: 4 });
    const jsonCycled = JSON.parse(JSON.stringify(original));
    const renormalized = normalizePerson(jsonCycled);

    expectNum(renormalized.grossAnnual, 85000);
    expectNum(renormalized.kiwiSaverRate, 4);
  });

  it('wishlist estimatedCost null survives round-trip as null', () => {
    const original = normalizeWishlistItem({ estimatedCost: null });
    const jsonCycled = JSON.parse(JSON.stringify(original));
    const renormalized = normalizeWishlistItem(jsonCycled);
    expect(renormalized.estimatedCost).toBeNull();
  });

  it('a dividend round-trips with numeric amounts', () => {
    const original = normalizeDividend({ grossAmount: 200, taxAmount: 66, netAmount: 134 });
    const jsonCycled = JSON.parse(JSON.stringify(original));
    const renormalized = normalizeDividend(jsonCycled);

    expectNum(renormalized.grossAmount, 200);
    expectNum(renormalized.taxAmount, 66);
    expectNum(renormalized.netAmount, 134);
  });

  it('an expense with facility round-trips with numeric fields', () => {
    const original = normalizeExpense({
      amount: 0, ddDay: null,
      facilities: [{ id: 'f1', balance: 400000, rate: 6.5, amount: 1100, frequency: 'fortnightly' }],
    });
    const jsonCycled = JSON.parse(JSON.stringify(original));
    const renormalized = normalizeExpense(jsonCycled);

    expectNum(renormalized.amount, 0);
    expect(renormalized.ddDay).toBeNull();
    expectNum(renormalized.facilities[0].balance, 400000);
    expectNum(renormalized.facilities[0].rate, 6.5);
    expectNum(renormalized.facilities[0].amount, 1100);
  });
});

// ── Invalid input handling ────────────────────────────────────────────────────

describe('invalid numeric input handling', () => {
  it('normalizeExpense handles NaN-producing strings as 0', () => {
    expectNum(normalizeExpense({ amount: 'not-a-number' }).amount, 0);
  });

  it('normalizeHolding handles Infinity string as 0', () => {
    // parseFloat('Infinity') = Infinity, isFinite(Infinity) = false → 0
    expectNum(normalizeHolding({ units: 'Infinity' }).units, 0);
  });

  it('normalizeDividend handles negative string amounts correctly', () => {
    // Negative numbers are valid (e.g. tax refund)
    expectNum(normalizeDividend({ grossAmount: '-50' }).grossAmount, -50);
  });

  it('normalizeWishlistItem handles whitespace-only string as null', () => {
    // parseFloat('  ') = NaN → null
    expect(normalizeWishlistItem({ estimatedCost: '  ' }).estimatedCost).toBeNull();
  });

  it('normalizePerson handles array grossAnnual as 0', () => {
    // parseFloat([]) = NaN → 0
    expectNum(normalizePerson({ grossAnnual: [] }).grossAnnual, 0);
  });
});
