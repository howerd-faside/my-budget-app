/**
 * @fileoverview Composite state interfaces for the budget app.
 *
 * These types describe the shape of data across domain store boundaries.
 * They are used by cross-cutting utilities (cascade deletes, backup/restore)
 * that need to read or write multiple slices atomically.
 *
 * Each domain state matches the persisted slice from its Zustand store.
 * The composite AppState is the union of all four domains.
 */

import type { Account }                 from '../models/Account';
import type { Transfer }                from '../models/Transaction';
import type { Goal }                    from '../models/Goal';
import type { AssetIncome, Person }     from '../models/Person';
import type { Expense }                 from '../models/Expense';
import type { WishlistItem }            from '../models/WishlistItem';
import type { Property }                from '../models/Property';
import type { PropertyTask }            from '../models/PropertyTask';
import type { PropertyMaintenance }     from '../models/PropertyMaintenance';
import type { PropertyProject }         from '../models/PropertyProject';
import type { PropertyAsset }           from '../models/PropertyAsset';
import type { Portfolio }               from '../models/Portfolio';
import type { Holding }                 from '../models/Holding';
import type { InvestmentContribution }  from '../models/InvestmentContribution';
import type { Dividend }                from '../models/Dividend';
import type { Asset }                   from '../models/Asset';
import type { InvestmentTransaction }   from '../models/InvestmentTransaction';
import type { PriceEntry }              from '../models/PriceEntry';
import type { FortnightlyData }         from '../models/FortnightlyData';

// ── Per-domain state slices ──────────────────────────────────────────────────

export interface FinanceState {
  accounts: Account[];
  transfers: Transfer[];
  fortnightlyData: FortnightlyData;
  goals: Goal[];
  assetIncomes: AssetIncome[];
  settings: { currentBalance: number };
}

export interface PeopleState {
  people: Person[];
  expenses: Expense[];
  wishlist: WishlistItem[];
}

export interface PropertyState {
  properties: Property[];
  propertyTasks: PropertyTask[];
  propertyMaintenance: PropertyMaintenance[];
  propertyProjects: PropertyProject[];
  propertyAssets: PropertyAsset[];
  selectedPropertyId: string | null;
}

export interface InvestmentState {
  investmentPortfolios: Portfolio[];
  selectedPortfolioId: string | null;
  investments: Holding[];
  investmentContributions: InvestmentContribution[];
  investmentDividends: Dividend[];
  investmentAssets: Asset[];
  investmentTransactions: InvestmentTransaction[];
  priceCache: PriceEntry[];
}

// ── Composite state ──────────────────────────────────────────────────────────

/**
 * Full application state across all domain stores.
 *
 * Used by cross-cutting utilities (cascade.ts, backup.ts) that need to
 * operate across domain boundaries.
 */
export type AppState = FinanceState & PeopleState & PropertyState & InvestmentState;
