/**
 * Versioned migrations for the Investment domain.
 *
 * Version history:
 *   0 → 1  Normalize all investment sub-entities. Initialize missing slices.
 *   1 → 2  Coerce numeric fields to numbers.
 *   2 → 3  Normalize priceUpdatedAt on holdings from undefined to null.
 *   3 → 4  Add new entity arrays (assets, transactions, priceCache).
 *          Add currency + costBasisMethod to portfolios.
 *   4 → 5  Convert holdings → assets + opening transactions + price cache.
 *          Convert contributions → buy transactions.
 *          Convert dividends → dividend transactions.
 */
import { normalizePortfolio }              from '../../models/Portfolio';
import { normalizeHolding }                from '../../models/Holding';
import { normalizeInvestmentContribution } from '../../models/InvestmentContribution';
import { normalizeDividend }               from '../../models/Dividend';
import { normalizeAsset }                  from '../../models/Asset';
import { normalizeInvestmentTransaction }  from '../../models/InvestmentTransaction';
import { normalizePriceEntry }             from '../../models/PriceEntry';
import type { MigrationStep } from '../budgetStorage';

export const INVESTMENT_VERSION     = 6;
export const INVESTMENT_VERSION_KEY = '_investmentVersion';

// ── v5 conversion helpers (exported for testing) ────────────────────────────

function toNum(val: any): number {
  const n = parseFloat(val);
  return isFinite(n) ? n : 0;
}

/** Extract identity fields from a holding → Asset. */
export function holdingToAsset(h: any, currency: string) {
  return normalizeAsset({
    id:          h.id          ?? '',
    portfolioId: h.portfolioId ?? '',
    name:        h.name        ?? '',
    ticker:      h.ticker      ?? '',
    platform:    h.platform    ?? '',
    category:    h.category    ?? 'Shares',
    currency,
    notes:       h.notes       ?? '',
    createdAt:   h.createdAt   ?? '',
  });
}

/** Create an opening-position buy transaction from a holding. Null if no units. */
export function holdingToOpeningTx(h: any) {
  const units   = toNum(h.units);
  const avgCost = toNum(h.avgCost);
  if (units <= 0) return null;

  return normalizeInvestmentTransaction({
    id:          crypto.randomUUID(),
    portfolioId: h.portfolioId ?? '',
    assetId:     h.id          ?? '',
    date:        h.createdAt   ?? '',
    type:        'buy',
    units,
    price:       avgCost,
    amount:      units * avgCost,
    fee:         0,
    label:       'Opening position (migrated)',
    notes:       '',
    createdAt:   h.createdAt   ?? '',
  });
}

/** Create a PriceEntry from a holding's cached price. Null if no price. */
export function holdingToPriceEntry(h: any, currency: string) {
  const price = toNum(h.currentPrice);
  if (price <= 0) return null;

  return normalizePriceEntry({
    assetId:   h.id             ?? '',
    price,
    currency,
    updatedAt: h.priceUpdatedAt ?? '',
  });
}

/** Convert an InvestmentContribution → buy transaction. Null if no id. */
export function contributionToTx(c: any) {
  if (!c.id) return null;

  return normalizeInvestmentTransaction({
    id:          crypto.randomUUID(),
    portfolioId: c.portfolioId ?? '',
    assetId:     c.holdingId   ?? '',
    date:        c.date        ?? '',
    type:        'buy',
    units:       null,       // contributions don't record unit detail
    price:       null,
    amount:      toNum(c.amount),
    fee:         0,
    label:       c.type || 'Regular',
    notes:       c.notes ?? '',
    createdAt:   c.createdAt ?? '',
  });
}

/** Convert a Dividend → dividend transaction. Null if no id. */
export function dividendToTx(d: any) {
  if (!d.id) return null;

  const gross = toNum(d.grossAmount);
  const tax   = toNum(d.taxAmount);
  // If netAmount was blank, fall back to gross − tax
  const rawNet = parseFloat(d.netAmount);
  const net    = isFinite(rawNet) ? rawNet : (gross - tax);

  return normalizeInvestmentTransaction({
    id:          crypto.randomUUID(),
    portfolioId: d.portfolioId ?? '',
    assetId:     d.holdingId   ?? '',
    date:        d.date        ?? '',
    type:        'dividend',
    units:       null,
    price:       null,
    amount:      net,
    fee:         0,
    grossAmount: gross || null,  // 0 → null (unrecorded)
    taxAmount:   tax   || null,
    label:       'Dividend',
    notes:       d.notes ?? '',
    createdAt:   d.createdAt ?? '',
  });
}

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
  {
    toVersion:   4,
    description: 'add new entity arrays (assets, transactions, priceCache); add currency + costBasisMethod to portfolios',
    migrate(slice: any) {
      // Portfolios gain currency + costBasisMethod via normalizePortfolio defaults
      if (Array.isArray(slice.investmentPortfolios)) {
        slice.investmentPortfolios = slice.investmentPortfolios.map(normalizePortfolio);
      }

      // Initialize new arrays if absent — additive only, no data conversion yet
      if (!Array.isArray(slice.investmentAssets))       slice.investmentAssets       = [];
      if (!Array.isArray(slice.investmentTransactions)) slice.investmentTransactions = [];
      if (!Array.isArray(slice.priceCache))             slice.priceCache             = [];

      return slice;
    },
  },
  {
    toVersion:   5,
    description: 'convert holdings/contributions/dividends into assets, transactions, and price cache',
    migrate(slice: any) {
      const holdings      = Array.isArray(slice.investments)             ? slice.investments             : [];
      const contributions = Array.isArray(slice.investmentContributions) ? slice.investmentContributions : [];
      const dividends     = Array.isArray(slice.investmentDividends)     ? slice.investmentDividends     : [];
      const portfolios    = Array.isArray(slice.investmentPortfolios)    ? slice.investmentPortfolios    : [];

      // Build portfolio → currency lookup (default NZD for legacy portfolios)
      const currencyOf: Record<string, string> = {};
      for (const p of portfolios) currencyOf[p.id] = p.currency || 'NZD';

      const assets:       any[] = [];
      const transactions: any[] = [];
      const prices:       any[] = [];

      // ── Holdings → Asset + opening buy tx + price entry ──
      for (const h of holdings) {
        const cur = currencyOf[h.portfolioId] || 'NZD';
        assets.push(holdingToAsset(h, cur));

        const openTx = holdingToOpeningTx(h);
        if (openTx) transactions.push(openTx);

        const pe = holdingToPriceEntry(h, cur);
        if (pe) prices.push(pe);
      }

      // ── Contributions → buy transactions ──
      for (const c of contributions) {
        const tx = contributionToTx(c);
        if (tx) transactions.push(tx);
      }

      // ── Dividends → dividend transactions ──
      for (const d of dividends) {
        const tx = dividendToTx(d);
        if (tx) transactions.push(tx);
      }

      slice.investmentAssets       = assets;
      slice.investmentTransactions = transactions;
      slice.priceCache             = prices;

      // Old keys (investments, investmentContributions, investmentDividends)
      // intentionally left in place — current UI still reads them.

      return slice;
    },
  },
  {
    toVersion:   6,
    description: 'add watchlist and watchlistPrices arrays for Discovery section',
    migrate(slice: any) {
      if (!Array.isArray(slice.watchlist))       slice.watchlist       = [];
      if (!Array.isArray(slice.watchlistPrices)) slice.watchlistPrices = [];
      return slice;
    },
  },
];
