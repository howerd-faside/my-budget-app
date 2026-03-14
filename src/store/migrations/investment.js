/**
 * Versioned migrations for the Investment domain.
 *
 * Version history:
 *   0 → 1  Add normalization passes for all investment sub-entities (previously stored
 *           as raw objects). Initialize missing slices and selectedPortfolioId.
 *           Existing data that pre-dates the versioning system is treated as v0.
 *   1 → 2  Coerce numeric fields — units, avgCost, currentPrice on holdings;
 *           amount on contributions; grossAmount, taxAmount, netAmount on dividends —
 *           from strings to actual numbers.
 *   2 → 3  Normalize priceUpdatedAt on holdings from undefined to null.
 *
 * Adding a future v4 migration:
 *   1. Bump INVESTMENT_VERSION to 4.
 *   2. Append to INVESTMENT_MIGRATIONS:
 *        { toVersion: 4, description: '…', migrate(slice) { …; return slice; } }
 *   toVersion values must be consecutive integers (1, 2, 3, …) — a gap throws at startup.
 */
import { normalizePortfolio }              from '../../models/Portfolio';
import { normalizeHolding }                from '../../models/Holding';
import { normalizeInvestmentContribution } from '../../models/InvestmentContribution';
import { normalizeDividend }               from '../../models/Dividend';

export const INVESTMENT_VERSION     = 3;
export const INVESTMENT_VERSION_KEY = '_investmentVersion';

export const INVESTMENT_MIGRATIONS = [
  {
    toVersion:   1,
    description: 'normalize portfolios/holdings/contributions/dividends; initialize missing slices',
    /**
     * @param {object} slice  Raw investment slice from localStorage (may be partial).
     * @returns {object}      Normalized investment slice.
     */
    migrate(slice) {
      if (Array.isArray(slice.investmentPortfolios)) {
        slice.investmentPortfolios = slice.investmentPortfolios.map(normalizePortfolio);
      } else {
        slice.investmentPortfolios = [];
      }

      if (!('selectedPortfolioId' in slice)) {
        slice.selectedPortfolioId = null;
      }

      if (Array.isArray(slice.investments)) {
        slice.investments = slice.investments.map(normalizeHolding);
      } else {
        slice.investments = [];
      }

      if (Array.isArray(slice.investmentContributions)) {
        slice.investmentContributions = slice.investmentContributions.map(normalizeInvestmentContribution);
      } else {
        slice.investmentContributions = [];
      }

      if (Array.isArray(slice.investmentDividends)) {
        slice.investmentDividends = slice.investmentDividends.map(normalizeDividend);
      } else {
        slice.investmentDividends = [];
      }

      return slice;
    },
  },
  {
    toVersion:   2,
    description: 'coerce numeric fields (units, avgCost, currentPrice, amounts) to numbers',
    /**
     * @param {object} slice  Investment slice at v1 (may contain string-typed numbers).
     * @returns {object}      Investment slice with all numeric fields as actual numbers.
     */
    migrate(slice) {
      // Re-run updated normalizers — they now coerce numeric fields to numbers.
      if (Array.isArray(slice.investments)) {
        slice.investments = slice.investments.map(normalizeHolding);
      }
      if (Array.isArray(slice.investmentContributions)) {
        slice.investmentContributions = slice.investmentContributions.map(normalizeInvestmentContribution);
      }
      if (Array.isArray(slice.investmentDividends)) {
        slice.investmentDividends = slice.investmentDividends.map(normalizeDividend);
      }
      return slice;
    },
  },
  {
    toVersion:   3,
    description: 'normalize priceUpdatedAt on holdings from undefined to null',
    /**
     * @param {object} slice  Investment slice at v2 (holdings may have undefined priceUpdatedAt).
     * @returns {object}      Investment slice with priceUpdatedAt normalized to null.
     */
    migrate(slice) {
      if (Array.isArray(slice.investments)) {
        slice.investments = slice.investments.map(normalizeHolding);
      }
      return slice;
    },
  },
];
