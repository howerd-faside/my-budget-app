/**
 * @fileoverview Cascade-delete utilities for all parent→child entity relationships.
 *
 * Each function is pure: it receives the current app state and an id, and returns
 * a partial state object (slices) that can be merged atomically via cascadeDelete()
 * from the store context.
 */

import type { PropertyState, InvestmentState, PeopleState } from '../types/state';
import type { Property }              from '../models/Property';
import type { PropertyTask }          from '../models/PropertyTask';
import type { PropertyMaintenance }   from '../models/PropertyMaintenance';
import type { PropertyAsset }         from '../models/PropertyAsset';
import type { PropertyProject }       from '../models/PropertyProject';
import type { Portfolio }               from '../models/Portfolio';
import type { Person }                 from '../models/Person';
import type { Expense }                from '../models/Expense';

// ── Helpers ───────────────────────────────────────────────────────────────────

const arr = <T>(x: T[] | undefined | null): T[] => x || [];

// ── Dependent-count queries ────────────────────────────────────────────────────

export function getPropertyDependents(state: PropertyState, propertyId: string) {
  return {
    tasks:       arr(state.propertyTasks).filter(t => t.propertyId === propertyId).length,
    maintenance: arr(state.propertyMaintenance).filter(m => m.propertyId === propertyId).length,
    assets:      arr(state.propertyAssets).filter(a => a.propertyId === propertyId).length,
    projects:    arr(state.propertyProjects).filter(p => p.propertyId === propertyId).length,
  };
}

export function getAreaDependents(state: PropertyState, propertyId: string, areaId: string) {
  return {
    tasks:       arr(state.propertyTasks).filter(t => t.propertyId === propertyId && t.areaId === areaId).length,
    maintenance: arr(state.propertyMaintenance).filter(m => m.propertyId === propertyId && m.areaId === areaId).length,
    assets:      arr(state.propertyAssets).filter(a => a.propertyId === propertyId && a.areaId === areaId).length,
  };
}

export function getTaskDependents(state: Pick<PropertyState, 'propertyMaintenance'>, taskId: string) {
  return {
    maintenance: arr(state.propertyMaintenance).filter(m => m.linkedTaskId === taskId).length,
  };
}

export function getAssetDependents(state: Pick<PropertyState, 'propertyMaintenance'>, assetId: string) {
  return {
    maintenance: arr(state.propertyMaintenance).filter(m => m.assetId === assetId).length,
  };
}

export function getPortfolioDependents(state: Pick<InvestmentState, 'investmentAssets' | 'investmentTransactions'>, portfolioId: string) {
  return {
    assets:        arr(state.investmentAssets).filter(a => a.portfolioId === portfolioId).length,
    transactions:  arr(state.investmentTransactions).filter(t => t.portfolioId === portfolioId).length,
  };
}

export function getInvestmentAssetDependents(state: Pick<InvestmentState, 'investmentTransactions' | 'priceCache'>, assetId: string) {
  return {
    transactions: arr(state.investmentTransactions).filter(t => t.assetId === assetId).length,
    prices:       arr(state.priceCache).filter(p => p.assetId === assetId).length,
  };
}

export function getPersonDependents(state: Pick<PeopleState, 'expenses'>, personId: string) {
  return {
    expenses: arr(state.expenses).filter(e => e.forPerson === personId).length,
  };
}

// ── Cascade-delete functions ──────────────────────────────────────────────────

export function propertyDeleteMessage(name: string, deps: { tasks: number; maintenance: number; assets: number; projects: number }): string {
  const parts: string[] = [];
  if (deps.tasks       > 0) parts.push(`${deps.tasks} task${deps.tasks       !== 1 ? 's' : ''}`);
  if (deps.maintenance > 0) parts.push(`${deps.maintenance} maintenance record${deps.maintenance !== 1 ? 's' : ''}`);
  if (deps.assets      > 0) parts.push(`${deps.assets} asset${deps.assets    !== 1 ? 's' : ''}`);
  if (deps.projects    > 0) parts.push(`${deps.projects} project${deps.projects !== 1 ? 's' : ''}`);
  const suffix = parts.length > 0 ? ` This will also permanently delete ${parts.join(', ')}.` : '';
  return `Delete "${name}"?${suffix}`;
}

export function cascadeDeleteProperty(state: PropertyState, propertyId: string) {
  const remaining = arr(state.properties).filter(p => p.id !== propertyId);
  return {
    properties:         remaining,
    propertyTasks:      arr(state.propertyTasks).filter(t => t.propertyId !== propertyId),
    propertyMaintenance:arr(state.propertyMaintenance).filter(m => m.propertyId !== propertyId),
    propertyAssets:     arr(state.propertyAssets).filter(a => a.propertyId !== propertyId),
    propertyProjects:   arr(state.propertyProjects).filter(p => p.propertyId !== propertyId),
    selectedPropertyId:
      state.selectedPropertyId === propertyId
        ? (remaining[0]?.id ?? null)
        : state.selectedPropertyId,
  };
}

export function areaDeleteMessage(name: string, deps: { tasks: number; maintenance: number; assets: number }): string {
  const parts: string[] = [];
  if (deps.tasks       > 0) parts.push(`${deps.tasks} task${deps.tasks       !== 1 ? 's' : ''}`);
  if (deps.maintenance > 0) parts.push(`${deps.maintenance} maintenance record${deps.maintenance !== 1 ? 's' : ''}`);
  if (deps.assets      > 0) parts.push(`${deps.assets} asset${deps.assets    !== 1 ? 's' : ''}`);
  const suffix = parts.length > 0
    ? ` The area field on ${parts.join(', ')} will be cleared.`
    : '';
  return `Delete area "${name}"?${suffix}`;
}

export function cascadeDeleteArea(state: PropertyState, propertyId: string, areaId: string) {
  return {
    properties: arr(state.properties).map(p =>
      p.id === propertyId
        ? { ...p, areas: arr(p.areas).filter(a => a.id !== areaId) }
        : p
    ),
    propertyTasks: arr(state.propertyTasks).map(t =>
      t.propertyId === propertyId && t.areaId === areaId ? { ...t, areaId: '' } : t
    ),
    propertyMaintenance: arr(state.propertyMaintenance).map(m =>
      m.propertyId === propertyId && m.areaId === areaId ? { ...m, areaId: '' } : m
    ),
    propertyAssets: arr(state.propertyAssets).map(a =>
      a.propertyId === propertyId && a.areaId === areaId ? { ...a, areaId: '' } : a
    ),
  };
}

export function taskDeleteMessage(deps: { maintenance: number }): string {
  const suffix = deps.maintenance > 0
    ? ` The task link on ${deps.maintenance} maintenance record${deps.maintenance !== 1 ? 's' : ''} will be cleared.`
    : '';
  return `Delete this task?${suffix}`;
}

export function cascadeDeleteTask(state: Pick<PropertyState, 'propertyTasks' | 'propertyMaintenance'>, taskId: string) {
  return {
    propertyTasks: arr(state.propertyTasks).filter(t => t.id !== taskId),
    propertyMaintenance: arr(state.propertyMaintenance).map(m =>
      m.linkedTaskId === taskId ? { ...m, linkedTaskId: '' } : m
    ),
  };
}

export function assetDeleteMessage(name: string, deps: { maintenance: number }): string {
  const suffix = deps.maintenance > 0
    ? ` The asset link on ${deps.maintenance} maintenance record${deps.maintenance !== 1 ? 's' : ''} will be cleared.`
    : '';
  return `Delete "${name}"?${suffix}`;
}

export function cascadeDeleteAsset(state: Pick<PropertyState, 'propertyAssets' | 'propertyMaintenance'>, assetId: string) {
  return {
    propertyAssets: arr(state.propertyAssets).filter(a => a.id !== assetId),
    propertyMaintenance: arr(state.propertyMaintenance).map(m =>
      m.assetId === assetId ? { ...m, assetId: '' } : m
    ),
  };
}

export function portfolioDeleteMessage(name: string, deps: { assets: number; transactions: number }): string {
  const parts: string[] = [];
  if (deps.assets       > 0) parts.push(`${deps.assets} asset${deps.assets       !== 1 ? 's' : ''}`);
  if (deps.transactions > 0) parts.push(`${deps.transactions} transaction${deps.transactions !== 1 ? 's' : ''}`);
  const suffix = parts.length > 0 ? ` This will also permanently delete ${parts.join(', ')}.` : '';
  return `Delete portfolio "${name}"?${suffix}`;
}

export function cascadeDeletePortfolio(
  state: Pick<InvestmentState, 'investmentPortfolios' | 'selectedPortfolioId' | 'investmentAssets' | 'investmentTransactions' | 'priceCache'>,
  portfolioId: string,
) {
  const remaining = arr(state.investmentPortfolios).filter(p => p.id !== portfolioId);
  return {
    investmentPortfolios: remaining,
    investmentAssets:        arr(state.investmentAssets).filter(a => a.portfolioId !== portfolioId),
    investmentTransactions:  arr(state.investmentTransactions).filter(t => t.portfolioId !== portfolioId),
    priceCache:              arr(state.priceCache).filter(p => {
      // Remove price entries for assets that belong to the deleted portfolio
      const assetIds = new Set(arr(state.investmentAssets).filter(a => a.portfolioId === portfolioId).map(a => a.id));
      return !assetIds.has(p.assetId);
    }),
    selectedPortfolioId:
      state.selectedPortfolioId === portfolioId
        ? (remaining.length > 0 ? remaining[remaining.length - 1].id : null)
        : state.selectedPortfolioId,
  };
}

export function investmentAssetDeleteMessage(name: string, deps: { transactions: number; prices: number }): string {
  const parts: string[] = [];
  if (deps.transactions > 0) parts.push(`${deps.transactions} transaction${deps.transactions !== 1 ? 's' : ''}`);
  const suffix = parts.length > 0 ? ` This will also permanently delete ${parts.join(', ')}.` : '';
  return `Delete "${name}"?${suffix}`;
}

export function cascadeDeleteInvestmentAsset(state: Pick<InvestmentState, 'investmentAssets' | 'investmentTransactions' | 'priceCache'>, assetId: string) {
  return {
    investmentAssets:       arr(state.investmentAssets).filter(a => a.id !== assetId),
    investmentTransactions: arr(state.investmentTransactions).filter(t => t.assetId !== assetId),
    priceCache:             arr(state.priceCache).filter(p => p.assetId !== assetId),
  };
}

export function personDeleteMessage(name: string, deps: { expenses: number }): string {
  const suffix = deps.expenses > 0
    ? ` The person assignment on ${deps.expenses} expense${deps.expenses !== 1 ? 's' : ''} will be cleared.`
    : '';
  return `Remove "${name}"?${suffix}`;
}

export function cascadeDeletePerson(state: Pick<PeopleState, 'people' | 'expenses'>, personId: string) {
  return {
    people: arr(state.people).filter(p => p.id !== personId),
    expenses: arr(state.expenses).map(e =>
      e.forPerson === personId ? { ...e, forPerson: '' } : e
    ),
  };
}
