/**
 * Versioned migrations for the Investment domain.
 *
 * Version history:
 *   0 → 1  Normalize all investment sub-entities. Initialize missing slices.
 *   1 → 2  Coerce numeric fields to numbers.
 *   2 → 3  Normalize priceUpdatedAt on holdings from undefined to null.
 */
import { normalizePortfolio }              from '../../models/Portfolio';
import { normalizeHolding }                from '../../models/Holding';
import { normalizeInvestmentContribution } from '../../models/InvestmentContribution';
import { normalizeDividend }               from '../../models/Dividend';
import type { MigrationStep } from '../budgetStorage';

export const INVESTMENT_VERSION     = 3;
export const INVESTMENT_VERSION_KEY = '_investmentVersion';

export const INVESTMENT_MIGRATIONS: MigrationStep[] = [
  {
    toVersion:   1,
    description: 'normalize portfolios/holdings/contributions/dividends; initialize missing slices',
    migrate(slice: any) {
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
    migrate(slice: any) {
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
    migrate(slice: any) {
      if (Array.isArray(slice.investments)) {
        slice.investments = slice.investments.map(normalizeHolding);
      }
      return slice;
    },
  },
];
