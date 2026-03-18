/**
 * Tests for src/utils/cascade.js
 *
 * All functions under test are pure (input → output slice, no side effects),
 * so no mocks or store setup are required.
 *
 * Covers:
 *   Dependent-count queries:
 *     getPropertyDependents, getAreaDependents, getTaskDependents,
 *     getAssetDependents, getPortfolioDependents, getPersonDependents
 *
 *   Cascade-delete functions:
 *     cascadeDeleteProperty — removes property + all dependent records, resets
 *       selectedPropertyId when the deleted property was selected
 *     cascadeDeleteArea — removes area from property.areas, clears areaId on
 *       tasks / maintenance / assets
 *     cascadeDeleteTask — removes task, clears linkedTaskId on maintenance
 *     cascadeDeleteAsset — removes asset, clears assetId on maintenance
 *     cascadeDeletePortfolio — removes portfolio + all assets / transactions,
 *       resets selectedPortfolioId when deleted
 *     cascadeDeletePerson — removes person, clears (not deletes) forPerson on expenses
 *
 *   Confirmation-message helpers:
 *     propertyDeleteMessage, areaDeleteMessage, taskDeleteMessage,
 *     assetDeleteMessage, portfolioDeleteMessage, personDeleteMessage
 */
import { describe, it, expect } from 'vitest';
import {
  getPropertyDependents,
  getAreaDependents,
  getTaskDependents,
  getAssetDependents,
  getPortfolioDependents,
  getPersonDependents,
  cascadeDeleteProperty,
  cascadeDeleteArea,
  cascadeDeleteTask,
  cascadeDeleteAsset,
  cascadeDeletePortfolio,
  cascadeDeletePerson,
  propertyDeleteMessage,
  areaDeleteMessage,
  taskDeleteMessage,
  assetDeleteMessage,
  portfolioDeleteMessage,
  personDeleteMessage,
} from './cascade';

// ── State fixture builder ──────────────────────────────────────────────────────

function makeState(overrides = {}) {
  return {
    properties:          [],
    propertyTasks:       [],
    propertyMaintenance: [],
    propertyProjects:    [],
    propertyAssets:      [],
    selectedPropertyId:  null,
    investmentPortfolios:    [],
    investments:             [],
    investmentContributions: [],
    investmentDividends:     [],
    investmentAssets:        [],
    investmentTransactions:  [],
    priceCache:              [],
    selectedPortfolioId:     null,
    people:   [],
    expenses: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getPropertyDependents
// ─────────────────────────────────────────────────────────────────────────────

describe('getPropertyDependents', () => {
  it('returns zeros when state arrays are empty', () => {
    const deps = getPropertyDependents(makeState(), 'p1');
    expect(deps).toEqual({ tasks: 0, maintenance: 0, assets: 0, projects: 0 });
  });

  it('counts only records belonging to the given propertyId', () => {
    const state = makeState({
      propertyTasks:       [{ propertyId: 'p1' }, { propertyId: 'p1' }, { propertyId: 'p2' }],
      propertyMaintenance: [{ propertyId: 'p1' }],
      propertyAssets:      [{ propertyId: 'p1' }, { propertyId: 'p2' }],
      propertyProjects:    [{ propertyId: 'p2' }],
    });
    const deps = getPropertyDependents(state, 'p1');
    expect(deps.tasks).toBe(2);
    expect(deps.maintenance).toBe(1);
    expect(deps.assets).toBe(1);
    expect(deps.projects).toBe(0);
  });

  it('is safe when state arrays are undefined/null', () => {
    const deps = getPropertyDependents({ propertyTasks: null, propertyMaintenance: undefined }, 'p1');
    expect(deps.tasks).toBe(0);
    expect(deps.maintenance).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getAreaDependents
// ─────────────────────────────────────────────────────────────────────────────

describe('getAreaDependents', () => {
  it('returns zeros when there are no referencing records', () => {
    const deps = getAreaDependents(makeState(), 'p1', 'area1');
    expect(deps).toEqual({ tasks: 0, maintenance: 0, assets: 0 });
  });

  it('counts tasks, maintenance, and assets referencing the area within the property', () => {
    const state = makeState({
      propertyTasks:       [
        { propertyId: 'p1', areaId: 'area1' },
        { propertyId: 'p1', areaId: 'area1' },
        { propertyId: 'p1', areaId: 'area2' },  // different area
        { propertyId: 'p2', areaId: 'area1' },  // different property
      ],
      propertyMaintenance: [{ propertyId: 'p1', areaId: 'area1' }],
      propertyAssets:      [{ propertyId: 'p1', areaId: 'area1' }],
    });
    const deps = getAreaDependents(state, 'p1', 'area1');
    expect(deps.tasks).toBe(2);
    expect(deps.maintenance).toBe(1);
    expect(deps.assets).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getTaskDependents
// ─────────────────────────────────────────────────────────────────────────────

describe('getTaskDependents', () => {
  it('returns zero when no maintenance links the task', () => {
    const state = makeState({ propertyMaintenance: [{ linkedTaskId: 'other' }] });
    expect(getTaskDependents(state, 'task1').maintenance).toBe(0);
  });

  it('counts maintenance records linked to the task', () => {
    const state = makeState({
      propertyMaintenance: [
        { linkedTaskId: 'task1' },
        { linkedTaskId: 'task1' },
        { linkedTaskId: 'task2' },
      ],
    });
    expect(getTaskDependents(state, 'task1').maintenance).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getAssetDependents
// ─────────────────────────────────────────────────────────────────────────────

describe('getAssetDependents', () => {
  it('returns zero when no maintenance links the asset', () => {
    expect(getAssetDependents(makeState(), 'asset1').maintenance).toBe(0);
  });

  it('counts maintenance records whose assetId matches', () => {
    const state = makeState({
      propertyMaintenance: [
        { assetId: 'asset1' },
        { assetId: 'asset1' },
        { assetId: 'asset2' },
      ],
    });
    expect(getAssetDependents(state, 'asset1').maintenance).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getPortfolioDependents
// ─────────────────────────────────────────────────────────────────────────────

describe('getPortfolioDependents', () => {
  it('returns zeros for an empty state', () => {
    const deps = getPortfolioDependents(makeState(), 'port1');
    expect(deps).toEqual({ assets: 0, transactions: 0 });
  });

  it('counts assets and transactions belonging to the portfolio', () => {
    const state = makeState({
      investmentAssets:       [{ portfolioId: 'port1' }, { portfolioId: 'port1' }, { portfolioId: 'port2' }],
      investmentTransactions: [{ portfolioId: 'port1' }, { portfolioId: 'port2' }],
    });
    const deps = getPortfolioDependents(state, 'port1');
    expect(deps.assets).toBe(2);
    expect(deps.transactions).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getPersonDependents
// ─────────────────────────────────────────────────────────────────────────────

describe('getPersonDependents', () => {
  it('counts expenses assigned to the person', () => {
    const state = makeState({
      expenses: [{ forPerson: 'person1' }, { forPerson: 'person1' }, { forPerson: 'person2' }],
    });
    expect(getPersonDependents(state, 'person1').expenses).toBe(2);
  });

  it('returns 0 when no expenses are assigned to the person', () => {
    const state = makeState({ expenses: [{ forPerson: 'other' }] });
    expect(getPersonDependents(state, 'person1').expenses).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cascadeDeleteProperty
// ─────────────────────────────────────────────────────────────────────────────

describe('cascadeDeleteProperty', () => {
  it('removes the property from the properties array', () => {
    const state = makeState({ properties: [{ id: 'p1' }, { id: 'p2' }] });
    const result = cascadeDeleteProperty(state, 'p1');
    expect(result.properties).toHaveLength(1);
    expect(result.properties[0].id).toBe('p2');
  });

  it('removes all tasks belonging to the property', () => {
    const state = makeState({
      properties:    [{ id: 'p1' }],
      propertyTasks: [{ id: 't1', propertyId: 'p1' }, { id: 't2', propertyId: 'p2' }],
    });
    const result = cascadeDeleteProperty(state, 'p1');
    expect(result.propertyTasks).toHaveLength(1);
    expect(result.propertyTasks[0].id).toBe('t2');
  });

  it('removes all maintenance records belonging to the property', () => {
    const state = makeState({
      properties:          [{ id: 'p1' }],
      propertyMaintenance: [
        { id: 'm1', propertyId: 'p1' },
        { id: 'm2', propertyId: 'p2' },
      ],
    });
    const result = cascadeDeleteProperty(state, 'p1');
    expect(result.propertyMaintenance).toHaveLength(1);
    expect(result.propertyMaintenance[0].id).toBe('m2');
  });

  it('removes all assets belonging to the property', () => {
    const state = makeState({
      properties:     [{ id: 'p1' }],
      propertyAssets: [{ id: 'a1', propertyId: 'p1' }, { id: 'a2', propertyId: 'p2' }],
    });
    const result = cascadeDeleteProperty(state, 'p1');
    expect(result.propertyAssets).toHaveLength(1);
    expect(result.propertyAssets[0].id).toBe('a2');
  });

  it('removes all projects belonging to the property', () => {
    const state = makeState({
      properties:       [{ id: 'p1' }],
      propertyProjects: [{ id: 'pr1', propertyId: 'p1' }],
    });
    const result = cascadeDeleteProperty(state, 'p1');
    expect(result.propertyProjects).toHaveLength(0);
  });

  it('resets selectedPropertyId to the next remaining property when the deleted one was selected', () => {
    const state = makeState({
      properties:         [{ id: 'p1' }, { id: 'p2' }],
      selectedPropertyId: 'p1',
    });
    const result = cascadeDeleteProperty(state, 'p1');
    expect(result.selectedPropertyId).toBe('p2');
  });

  it('sets selectedPropertyId to null when no properties remain', () => {
    const state = makeState({
      properties:         [{ id: 'p1' }],
      selectedPropertyId: 'p1',
    });
    const result = cascadeDeleteProperty(state, 'p1');
    expect(result.selectedPropertyId).toBeNull();
  });

  it('leaves selectedPropertyId unchanged when a different property was selected', () => {
    const state = makeState({
      properties:         [{ id: 'p1' }, { id: 'p2' }],
      selectedPropertyId: 'p2',
    });
    const result = cascadeDeleteProperty(state, 'p1');
    expect(result.selectedPropertyId).toBe('p2');
  });

  it('does not remove records belonging to other properties', () => {
    const state = makeState({
      properties:    [{ id: 'p1' }, { id: 'p2' }],
      propertyTasks: [{ id: 't1', propertyId: 'p1' }, { id: 't2', propertyId: 'p2' }],
    });
    const result = cascadeDeleteProperty(state, 'p1');
    expect(result.propertyTasks).toHaveLength(1);
    expect(result.propertyTasks[0].propertyId).toBe('p2');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cascadeDeleteArea
// ─────────────────────────────────────────────────────────────────────────────

describe('cascadeDeleteArea', () => {
  it('removes the area from the property areas array', () => {
    const state = makeState({
      properties: [
        { id: 'p1', areas: [{ id: 'area1', name: 'Kitchen' }, { id: 'area2', name: 'Roof' }] },
      ],
    });
    const result = cascadeDeleteArea(state, 'p1', 'area1');
    const prop = result.properties.find(p => p.id === 'p1');
    expect(prop.areas).toHaveLength(1);
    expect(prop.areas[0].id).toBe('area2');
  });

  it('does not modify other properties', () => {
    const state = makeState({
      properties: [
        { id: 'p1', areas: [{ id: 'area1' }] },
        { id: 'p2', areas: [{ id: 'area1' }] }, // same areaId but different property
      ],
    });
    const result = cascadeDeleteArea(state, 'p1', 'area1');
    const p2 = result.properties.find(p => p.id === 'p2');
    expect(p2.areas).toHaveLength(1);
  });

  it('clears areaId on tasks referencing the deleted area', () => {
    const state = makeState({
      properties:    [{ id: 'p1', areas: [{ id: 'area1' }] }],
      propertyTasks: [
        { id: 't1', propertyId: 'p1', areaId: 'area1' },
        { id: 't2', propertyId: 'p1', areaId: 'area2' },
        { id: 't3', propertyId: 'p2', areaId: 'area1' }, // different property — untouched
      ],
    });
    const result = cascadeDeleteArea(state, 'p1', 'area1');
    expect(result.propertyTasks.find(t => t.id === 't1').areaId).toBe('');
    expect(result.propertyTasks.find(t => t.id === 't2').areaId).toBe('area2');
    expect(result.propertyTasks.find(t => t.id === 't3').areaId).toBe('area1');
  });

  it('clears areaId on maintenance records referencing the deleted area', () => {
    const state = makeState({
      properties:          [{ id: 'p1', areas: [{ id: 'area1' }] }],
      propertyMaintenance: [{ id: 'm1', propertyId: 'p1', areaId: 'area1' }],
    });
    const result = cascadeDeleteArea(state, 'p1', 'area1');
    expect(result.propertyMaintenance[0].areaId).toBe('');
  });

  it('clears areaId on assets referencing the deleted area', () => {
    const state = makeState({
      properties:     [{ id: 'p1', areas: [{ id: 'area1' }] }],
      propertyAssets: [{ id: 'a1', propertyId: 'p1', areaId: 'area1' }],
    });
    const result = cascadeDeleteArea(state, 'p1', 'area1');
    expect(result.propertyAssets[0].areaId).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cascadeDeleteTask
// ─────────────────────────────────────────────────────────────────────────────

describe('cascadeDeleteTask', () => {
  it('removes the task', () => {
    const state = makeState({
      propertyTasks: [{ id: 'task1' }, { id: 'task2' }],
    });
    const result = cascadeDeleteTask(state, 'task1');
    expect(result.propertyTasks).toHaveLength(1);
    expect(result.propertyTasks[0].id).toBe('task2');
  });

  it('clears linkedTaskId on maintenance records that linked to the task', () => {
    const state = makeState({
      propertyTasks:       [{ id: 'task1' }],
      propertyMaintenance: [
        { id: 'm1', linkedTaskId: 'task1' },
        { id: 'm2', linkedTaskId: 'task2' },
        { id: 'm3', linkedTaskId: '' },
      ],
    });
    const result = cascadeDeleteTask(state, 'task1');
    expect(result.propertyMaintenance.find(m => m.id === 'm1').linkedTaskId).toBe('');
    expect(result.propertyMaintenance.find(m => m.id === 'm2').linkedTaskId).toBe('task2');
    expect(result.propertyMaintenance.find(m => m.id === 'm3').linkedTaskId).toBe('');
  });

  it('does not delete maintenance records, only clears the link', () => {
    const state = makeState({
      propertyTasks:       [{ id: 'task1' }],
      propertyMaintenance: [{ id: 'm1', linkedTaskId: 'task1' }],
    });
    const result = cascadeDeleteTask(state, 'task1');
    expect(result.propertyMaintenance).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cascadeDeleteAsset
// ─────────────────────────────────────────────────────────────────────────────

describe('cascadeDeleteAsset', () => {
  it('removes the asset', () => {
    const state = makeState({
      propertyAssets: [{ id: 'asset1' }, { id: 'asset2' }],
    });
    const result = cascadeDeleteAsset(state, 'asset1');
    expect(result.propertyAssets).toHaveLength(1);
    expect(result.propertyAssets[0].id).toBe('asset2');
  });

  it('clears assetId on maintenance records that linked to the asset', () => {
    const state = makeState({
      propertyAssets:      [{ id: 'asset1' }],
      propertyMaintenance: [
        { id: 'm1', assetId: 'asset1' },
        { id: 'm2', assetId: 'asset2' },
      ],
    });
    const result = cascadeDeleteAsset(state, 'asset1');
    expect(result.propertyMaintenance.find(m => m.id === 'm1').assetId).toBe('');
    expect(result.propertyMaintenance.find(m => m.id === 'm2').assetId).toBe('asset2');
  });

  it('does not delete maintenance records, only clears the link', () => {
    const state = makeState({
      propertyAssets:      [{ id: 'asset1' }],
      propertyMaintenance: [{ id: 'm1', assetId: 'asset1' }],
    });
    const result = cascadeDeleteAsset(state, 'asset1');
    expect(result.propertyMaintenance).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cascadeDeletePortfolio
// ─────────────────────────────────────────────────────────────────────────────

describe('cascadeDeletePortfolio', () => {
  it('removes the portfolio', () => {
    const state = makeState({
      investmentPortfolios: [{ id: 'port1' }, { id: 'port2' }],
    });
    const result = cascadeDeletePortfolio(state, 'port1');
    expect(result.investmentPortfolios).toHaveLength(1);
    expect(result.investmentPortfolios[0].id).toBe('port2');
  });

  it('removes all assets belonging to the portfolio', () => {
    const state = makeState({
      investmentPortfolios: [{ id: 'port1' }],
      investmentAssets: [{ id: 'a1', portfolioId: 'port1' }, { id: 'a2', portfolioId: 'port2' }],
    });
    const result = cascadeDeletePortfolio(state, 'port1');
    expect(result.investmentAssets).toHaveLength(1);
    expect(result.investmentAssets[0].id).toBe('a2');
  });

  it('removes all transactions belonging to the portfolio', () => {
    const state = makeState({
      investmentPortfolios:    [{ id: 'port1' }],
      investmentTransactions: [{ portfolioId: 'port1' }, { portfolioId: 'port2' }],
    });
    const result = cascadeDeletePortfolio(state, 'port1');
    expect(result.investmentTransactions).toHaveLength(1);
    expect(result.investmentTransactions[0].portfolioId).toBe('port2');
  });

  it('removes price cache entries for assets belonging to the portfolio', () => {
    const state = makeState({
      investmentPortfolios: [{ id: 'port1' }],
      investmentAssets:     [{ id: 'a1', portfolioId: 'port1' }, { id: 'a2', portfolioId: 'port2' }],
      priceCache:           [{ assetId: 'a1', price: 100 }, { assetId: 'a2', price: 200 }],
    });
    const result = cascadeDeletePortfolio(state, 'port1');
    expect(result.priceCache).toHaveLength(1);
    expect(result.priceCache[0].assetId).toBe('a2');
  });

  it('sets selectedPortfolioId to another portfolio when the selected one is deleted', () => {
    const state = makeState({
      investmentPortfolios: [{ id: 'port1' }, { id: 'port2' }],
      selectedPortfolioId:  'port1',
    });
    const result = cascadeDeletePortfolio(state, 'port1');
    expect(result.selectedPortfolioId).toBe('port2');
  });

  it('selects first remaining portfolio (not last) when deleting the selected one', () => {
    const state = makeState({
      investmentPortfolios: [{ id: 'port1' }, { id: 'port2' }, { id: 'port3' }],
      selectedPortfolioId:  'port1',
    });
    const result = cascadeDeletePortfolio(state, 'port1');
    expect(result.selectedPortfolioId).toBe('port2');
  });

  it('sets selectedPortfolioId to null when no portfolios remain', () => {
    const state = makeState({
      investmentPortfolios: [{ id: 'port1' }],
      selectedPortfolioId:  'port1',
    });
    const result = cascadeDeletePortfolio(state, 'port1');
    expect(result.selectedPortfolioId).toBeNull();
  });

  it('leaves selectedPortfolioId unchanged when a different portfolio was selected', () => {
    const state = makeState({
      investmentPortfolios: [{ id: 'port1' }, { id: 'port2' }],
      selectedPortfolioId:  'port2',
    });
    const result = cascadeDeletePortfolio(state, 'port1');
    expect(result.selectedPortfolioId).toBe('port2');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cascadeDeletePerson
// ─────────────────────────────────────────────────────────────────────────────

describe('cascadeDeletePerson', () => {
  it('removes the person', () => {
    const state = makeState({ people: [{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }] });
    const result = cascadeDeletePerson(state, 'p1');
    expect(result.people).toHaveLength(1);
    expect(result.people[0].id).toBe('p2');
  });

  it('clears forPerson on expenses assigned to the person (does not delete them)', () => {
    const state = makeState({
      people: [{ id: 'p1' }],
      expenses: [
        { id: 'e1', forPerson: 'p1' },
        { id: 'e2', forPerson: 'p2' },
        { id: 'e3', forPerson: '' },
      ],
    });
    const result = cascadeDeletePerson(state, 'p1');
    expect(result.expenses).toHaveLength(3);
    expect(result.expenses.find(e => e.id === 'e1').forPerson).toBe('');
    expect(result.expenses.find(e => e.id === 'e2').forPerson).toBe('p2');
    expect(result.expenses.find(e => e.id === 'e3').forPerson).toBe('');
  });

  it('does not alter expenses with no person assignment', () => {
    const state = makeState({
      people:   [{ id: 'p1' }],
      expenses: [{ id: 'e1', forPerson: '' }],
    });
    const result = cascadeDeletePerson(state, 'p1');
    expect(result.expenses[0].forPerson).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Confirmation-message helpers
// ─────────────────────────────────────────────────────────────────────────────

describe('propertyDeleteMessage', () => {
  it('returns a message without dependents section when counts are all zero', () => {
    const msg = propertyDeleteMessage('My Home', { tasks: 0, maintenance: 0, assets: 0, projects: 0 });
    expect(msg).toBe('Delete "My Home"?');
  });

  it('lists singular and plural dependents correctly', () => {
    const msg = propertyDeleteMessage('Rental', { tasks: 1, maintenance: 3, assets: 2, projects: 0 });
    expect(msg).toContain('1 task');
    expect(msg).not.toContain('1 tasks');
    expect(msg).toContain('3 maintenance records');
    expect(msg).toContain('2 assets');
  });
});

describe('areaDeleteMessage', () => {
  it('returns a simple message when no dependents exist', () => {
    const msg = areaDeleteMessage('Kitchen', { tasks: 0, maintenance: 0, assets: 0 });
    expect(msg).toBe('Delete area "Kitchen"?');
  });

  it('mentions the clearing (not deletion) of dependent records', () => {
    const msg = areaDeleteMessage('Roof', { tasks: 2, maintenance: 0, assets: 0 });
    expect(msg).toContain('cleared');
    expect(msg).toContain('2 tasks');
  });
});

describe('taskDeleteMessage', () => {
  it('returns a plain message when no maintenance is linked', () => {
    expect(taskDeleteMessage({ maintenance: 0 })).toBe('Delete this task?');
  });

  it('mentions maintenance link clearing when maintenance count is non-zero', () => {
    const msg = taskDeleteMessage({ maintenance: 2 });
    expect(msg).toContain('2 maintenance records');
    expect(msg).toContain('cleared');
  });
});

describe('assetDeleteMessage', () => {
  it('returns a simple message when no maintenance is linked', () => {
    expect(assetDeleteMessage('Heatpump', { maintenance: 0 })).toBe('Delete "Heatpump"?');
  });

  it('mentions maintenance link clearing', () => {
    const msg = assetDeleteMessage('Oven', { maintenance: 1 });
    expect(msg).toContain('1 maintenance record');
    expect(msg).not.toContain('1 maintenance records');
    expect(msg).toContain('cleared');
  });
});

describe('portfolioDeleteMessage', () => {
  it('returns a plain message when portfolio has no dependent records', () => {
    const msg = portfolioDeleteMessage('Growth', { assets: 0, transactions: 0 });
    expect(msg).toBe('Delete portfolio "Growth"?');
  });

  it('lists all dependency types', () => {
    const msg = portfolioDeleteMessage('Income', { assets: 3, transactions: 5 });
    expect(msg).toContain('3 assets');
    expect(msg).toContain('5 transactions');
  });

  it('uses singular for a count of 1', () => {
    const msg = portfolioDeleteMessage('Test', { assets: 1, transactions: 1 });
    expect(msg).toContain('1 asset');
    expect(msg).not.toContain('1 assets');
    expect(msg).toContain('1 transaction');
    expect(msg).not.toContain('1 transactions');
  });
});

describe('personDeleteMessage', () => {
  it('returns a plain message when no expenses are assigned', () => {
    expect(personDeleteMessage('Alice', { expenses: 0 })).toBe('Remove "Alice"?');
  });

  it('mentions expense link clearing', () => {
    const msg = personDeleteMessage('Bob', { expenses: 3 });
    expect(msg).toContain('3 expenses');
    expect(msg).toContain('cleared');
  });

  it('uses singular for a count of 1', () => {
    const msg = personDeleteMessage('Carol', { expenses: 1 });
    expect(msg).toContain('1 expense');
    expect(msg).not.toContain('1 expenses');
  });
});
