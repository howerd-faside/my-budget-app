/**
 * Tests for src/store/migrations/investment.js
 *
 * Covers:
 *   - v0 → v1: normalizes portfolios
 *   - v0 → v1: normalizes holdings (investments)
 *   - v0 → v1: normalizes contributions
 *   - v0 → v1: normalizes dividends
 *   - v0 → v1: initializes selectedPortfolioId when missing
 *   - v0 → v1: initializes all missing slices to []
 *   - v0 → v1: preserves existing data
 *   - v1 → v2: coerces holding numeric fields (units, avgCost, currentPrice) to numbers
 *   - v1 → v2: coerces contribution amount to number
 *   - v1 → v2: coerces dividend amounts (gross, tax, net) to numbers
 *   - v1 → v2: preserves non-numeric fields unchanged
 */
import { describe, it, expect } from 'vitest';
import { INVESTMENT_MIGRATIONS } from '../migrations/investment';

const migrateV1 = INVESTMENT_MIGRATIONS.find(m => m.toVersion === 1).migrate;
const migrateV2 = INVESTMENT_MIGRATIONS.find(m => m.toVersion === 2).migrate;

describe('investment migration v0 → v1', () => {
  describe('investmentPortfolios normalization', () => {
    it('normalizes portfolios and preserves existing fields', () => {
      const slice = {
        investmentPortfolios: [{ id: 'port1', name: 'Main', createdAt: '2026-01-01T00:00:00.000Z' }],
      };
      const result = migrateV1(slice);
      expect(result.investmentPortfolios[0].name).toBe('Main');
    });

    it('applies default name when missing', () => {
      const slice = {
        investmentPortfolios: [{ id: 'port1' }],
      };
      const result = migrateV1(slice);
      expect(result.investmentPortfolios[0].name).toBe('');
    });

    it('initializes investmentPortfolios to [] when missing', () => {
      const result = migrateV1({});
      expect(result.investmentPortfolios).toEqual([]);
    });
  });

  describe('selectedPortfolioId', () => {
    it('defaults to null when missing', () => {
      const result = migrateV1({});
      expect(result.selectedPortfolioId).toBeNull();
    });

    it('preserves existing selectedPortfolioId', () => {
      const result = migrateV1({ selectedPortfolioId: 'port1' });
      expect(result.selectedPortfolioId).toBe('port1');
    });
  });

  describe('investments (holdings) normalization', () => {
    it('normalizes a raw holding and applies numeric defaults for missing fields', () => {
      const slice = {
        investments: [{ id: 'h1', portfolioId: 'port1', name: 'Apple' }],
      };
      const result = migrateV1(slice);
      const holding = result.investments[0];
      expect(holding.category).toBe('Shares'); // default
      expect(holding.ticker).toBe('');
      // After v1 migration (which calls updated normalizeHolding), numeric fields are 0
      expect(holding.units).toBe(0);
    });

    it('coerces string numeric fields to numbers in v1 migration', () => {
      const slice = {
        investments: [{
          id: 'h1', portfolioId: 'port1', name: 'Tesla',
          ticker: 'TSLA', category: 'Shares',
          units: '10', avgCost: '250', currentPrice: '300',
        }],
      };
      const result = migrateV1(slice);
      const holding = result.investments[0];
      expect(holding.ticker).toBe('TSLA');
      expect(holding.units).toBe(10);
      expect(holding.avgCost).toBe(250);
      expect(holding.currentPrice).toBe(300);
    });

    it('initializes investments to [] when missing', () => {
      const result = migrateV1({});
      expect(result.investments).toEqual([]);
    });
  });

  describe('investmentContributions normalization', () => {
    it('normalizes contributions and applies default type', () => {
      const slice = {
        investmentContributions: [{ id: 'c1', portfolioId: 'port1', amount: '500' }],
      };
      const result = migrateV1(slice);
      expect(result.investmentContributions[0].type).toBe('Regular');
      expect(result.investmentContributions[0].amount).toBe(500);
    });

    it('preserves existing contribution type', () => {
      const slice = {
        investmentContributions: [{
          id: 'c1', portfolioId: 'port1', amount: '1000', type: 'Lump Sum', date: '2026-01-01',
        }],
      };
      const result = migrateV1(slice);
      expect(result.investmentContributions[0].type).toBe('Lump Sum');
      expect(result.investmentContributions[0].amount).toBe(1000);
    });

    it('initializes investmentContributions to [] when missing', () => {
      const result = migrateV1({});
      expect(result.investmentContributions).toEqual([]);
    });
  });

  describe('investmentDividends normalization', () => {
    it('normalizes dividends and applies numeric defaults (0, not empty string)', () => {
      const slice = {
        investmentDividends: [{ id: 'd1', portfolioId: 'port1' }],
      };
      const result = migrateV1(slice);
      const div = result.investmentDividends[0];
      expect(div.grossAmount).toBe(0);
      expect(div.taxAmount).toBe(0);
      expect(div.netAmount).toBe(0);
    });

    it('coerces string dividend amounts to numbers', () => {
      const slice = {
        investmentDividends: [{
          id: 'd1', portfolioId: 'port1',
          grossAmount: '100', taxAmount: '33', netAmount: '67',
        }],
      };
      const result = migrateV1(slice);
      expect(result.investmentDividends[0].grossAmount).toBe(100);
      expect(result.investmentDividends[0].taxAmount).toBe(33);
      expect(result.investmentDividends[0].netAmount).toBe(67);
    });

    it('initializes investmentDividends to [] when missing', () => {
      const result = migrateV1({});
      expect(result.investmentDividends).toEqual([]);
    });
  });
});

describe('investment migration v1 → v2', () => {
  describe('holdings numeric coercion', () => {
    it('coerces string units to number', () => {
      const slice = {
        investments: [{ id: 'h1', portfolioId: 'p1', name: 'Test', units: '50.5', avgCost: '10', currentPrice: '12' }],
      };
      const result = migrateV2(slice);
      expect(result.investments[0].units).toBe(50.5);
      expect(typeof result.investments[0].units).toBe('number');
    });

    it('coerces string avgCost and currentPrice to numbers', () => {
      const slice = {
        investments: [{ id: 'h1', portfolioId: 'p1', name: 'Test', avgCost: '200.50', currentPrice: '250.75' }],
      };
      const result = migrateV2(slice);
      expect(result.investments[0].avgCost).toBe(200.5);
      expect(result.investments[0].currentPrice).toBe(250.75);
    });

    it('uses 0 for missing/empty numeric holding fields', () => {
      const slice = {
        investments: [{ id: 'h1', portfolioId: 'p1', name: 'Test', units: '', avgCost: null, currentPrice: undefined }],
      };
      const result = migrateV2(slice);
      expect(result.investments[0].units).toBe(0);
      expect(result.investments[0].avgCost).toBe(0);
      expect(result.investments[0].currentPrice).toBe(0);
    });

    it('preserves already-numeric values unchanged', () => {
      const slice = {
        investments: [{ id: 'h1', portfolioId: 'p1', name: 'Test', units: 30, avgCost: 15.5, currentPrice: 18 }],
      };
      const result = migrateV2(slice);
      expect(result.investments[0].units).toBe(30);
      expect(result.investments[0].avgCost).toBe(15.5);
    });

    it('skips migration when investments is missing', () => {
      const result = migrateV2({});
      expect(result.investments).toBeUndefined();
    });
  });

  describe('contribution amount coercion', () => {
    it('coerces string contribution amount to number', () => {
      const slice = {
        investmentContributions: [{ id: 'c1', portfolioId: 'p1', amount: '750' }],
      };
      const result = migrateV2(slice);
      expect(result.investmentContributions[0].amount).toBe(750);
      expect(typeof result.investmentContributions[0].amount).toBe('number');
    });

    it('uses 0 for missing contribution amount', () => {
      const slice = {
        investmentContributions: [{ id: 'c1', portfolioId: 'p1', amount: '' }],
      };
      const result = migrateV2(slice);
      expect(result.investmentContributions[0].amount).toBe(0);
    });
  });

  describe('dividend amount coercion', () => {
    it('coerces all three string dividend amounts to numbers', () => {
      const slice = {
        investmentDividends: [{ id: 'd1', portfolioId: 'p1', grossAmount: '120', taxAmount: '39.6', netAmount: '80.4' }],
      };
      const result = migrateV2(slice);
      expect(result.investmentDividends[0].grossAmount).toBe(120);
      expect(result.investmentDividends[0].taxAmount).toBe(39.6);
      expect(result.investmentDividends[0].netAmount).toBe(80.4);
    });

    it('uses 0 for missing/empty dividend amounts', () => {
      const slice = {
        investmentDividends: [{ id: 'd1', portfolioId: 'p1', grossAmount: '', taxAmount: null }],
      };
      const result = migrateV2(slice);
      expect(result.investmentDividends[0].grossAmount).toBe(0);
      expect(result.investmentDividends[0].taxAmount).toBe(0);
    });
  });
});
