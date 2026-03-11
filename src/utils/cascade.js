/**
 * @fileoverview Cascade-delete utilities for all parent→child entity relationships.
 *
 * Each function is pure: it receives the current app state and an id, and returns
 * a partial state object (slices) that can be merged atomically via cascadeDelete()
 * from the store context.
 *
 * Relationship map
 * ────────────────
 * Property      ──▶  PropertyTask[]        (propertyId)     cascade DELETE
 * Property      ──▶  PropertyMaintenance[] (propertyId)     cascade DELETE
 * Property      ──▶  PropertyAsset[]       (propertyId)     cascade DELETE
 * Property      ──▶  PropertyProject[]     (propertyId)     cascade DELETE
 *
 * PropertyArea  ──▶  PropertyTask[]        (areaId)         cascade CLEAR (nullify)
 * PropertyArea  ──▶  PropertyMaintenance[] (areaId)         cascade CLEAR
 * PropertyArea  ──▶  PropertyAsset[]       (areaId)         cascade CLEAR
 *
 * PropertyTask  ──▶  PropertyMaintenance[] (linkedTaskId)   cascade CLEAR
 *
 * PropertyAsset ──▶  PropertyMaintenance[] (assetId)        cascade CLEAR
 *
 * Portfolio     ──▶  Holding[]             (portfolioId)    cascade DELETE
 * Portfolio     ──▶  Contribution[]        (portfolioId)    cascade DELETE
 * Portfolio     ──▶  Dividend[]            (portfolioId)    cascade DELETE
 *
 * Holding       ──▶  Contribution[]        (holdingId)      cascade CLEAR
 * Holding       ──▶  Dividend[]            (holdingId)      cascade CLEAR
 *
 * Person        ──▶  Expense[]             (forPerson)      cascade CLEAR
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

const arr = (x) => x || [];

// ── Dependent-count queries ────────────────────────────────────────────────────

/**
 * Return counts of records that will be affected by deleting a property.
 * @param {object} state
 * @param {string} propertyId
 * @returns {{ tasks: number, maintenance: number, assets: number, projects: number }}
 */
export function getPropertyDependents(state, propertyId) {
  return {
    tasks:       arr(state.propertyTasks).filter(t => t.propertyId === propertyId).length,
    maintenance: arr(state.propertyMaintenance).filter(m => m.propertyId === propertyId).length,
    assets:      arr(state.propertyAssets).filter(a => a.propertyId === propertyId).length,
    projects:    arr(state.propertyProjects).filter(p => p.propertyId === propertyId).length,
  };
}

/**
 * Return counts of records that will be affected by deleting a property area.
 * @param {object} state
 * @param {string} propertyId
 * @param {string} areaId
 * @returns {{ tasks: number, maintenance: number, assets: number }}
 */
export function getAreaDependents(state, propertyId, areaId) {
  return {
    tasks:       arr(state.propertyTasks).filter(t => t.propertyId === propertyId && t.areaId === areaId).length,
    maintenance: arr(state.propertyMaintenance).filter(m => m.propertyId === propertyId && m.areaId === areaId).length,
    assets:      arr(state.propertyAssets).filter(a => a.propertyId === propertyId && a.areaId === areaId).length,
  };
}

/**
 * Return count of maintenance records linked to a task.
 * @param {object} state
 * @param {string} taskId
 * @returns {{ maintenance: number }}
 */
export function getTaskDependents(state, taskId) {
  return {
    maintenance: arr(state.propertyMaintenance).filter(m => m.linkedTaskId === taskId).length,
  };
}

/**
 * Return count of maintenance records linked to an asset.
 * @param {object} state
 * @param {string} assetId
 * @returns {{ maintenance: number }}
 */
export function getAssetDependents(state, assetId) {
  return {
    maintenance: arr(state.propertyMaintenance).filter(m => m.assetId === assetId).length,
  };
}

/**
 * Return count of holdings, contributions, dividends in a portfolio.
 * @param {object} state
 * @param {string} portfolioId
 * @returns {{ holdings: number, contributions: number, dividends: number }}
 */
export function getPortfolioDependents(state, portfolioId) {
  return {
    holdings:      arr(state.investments).filter(h => h.portfolioId === portfolioId).length,
    contributions: arr(state.investmentContributions).filter(c => c.portfolioId === portfolioId).length,
    dividends:     arr(state.investmentDividends).filter(d => d.portfolioId === portfolioId).length,
  };
}

/**
 * Return count of contributions and dividends linked to a holding.
 * @param {object} state
 * @param {string} holdingId
 * @returns {{ contributions: number, dividends: number }}
 */
export function getHoldingDependents(state, holdingId) {
  return {
    contributions: arr(state.investmentContributions).filter(c => c.holdingId === holdingId).length,
    dividends:     arr(state.investmentDividends).filter(d => d.holdingId === holdingId).length,
  };
}

/**
 * Return count of expenses assigned to a person.
 * @param {object} state
 * @param {string} personId
 * @returns {{ expenses: number }}
 */
export function getPersonDependents(state, personId) {
  return {
    expenses: arr(state.expenses).filter(e => e.forPerson === personId).length,
  };
}

// ── Cascade-delete functions ──────────────────────────────────────────────────

/**
 * Build confirmation message for property deletion.
 * @param {string} name
 * @param {{ tasks:number, maintenance:number, assets:number, projects:number }} deps
 * @returns {string}
 */
export function propertyDeleteMessage(name, deps) {
  const parts = [];
  if (deps.tasks       > 0) parts.push(`${deps.tasks} task${deps.tasks       !== 1 ? 's' : ''}`);
  if (deps.maintenance > 0) parts.push(`${deps.maintenance} maintenance record${deps.maintenance !== 1 ? 's' : ''}`);
  if (deps.assets      > 0) parts.push(`${deps.assets} asset${deps.assets    !== 1 ? 's' : ''}`);
  if (deps.projects    > 0) parts.push(`${deps.projects} project${deps.projects !== 1 ? 's' : ''}`);
  const suffix = parts.length > 0 ? ` This will also permanently delete ${parts.join(', ')}.` : '';
  return `Delete "${name}"?${suffix}`;
}

/**
 * Cascade-delete a property and all its dependent records.
 * @param {object} state
 * @param {string} propertyId
 * @returns {Partial<object>} Partial state slices to merge
 */
export function cascadeDeleteProperty(state, propertyId) {
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

/**
 * Build confirmation message for area deletion.
 * @param {string} name
 * @param {{ tasks:number, maintenance:number, assets:number }} deps
 * @returns {string}
 */
export function areaDeleteMessage(name, deps) {
  const parts = [];
  if (deps.tasks       > 0) parts.push(`${deps.tasks} task${deps.tasks       !== 1 ? 's' : ''}`);
  if (deps.maintenance > 0) parts.push(`${deps.maintenance} maintenance record${deps.maintenance !== 1 ? 's' : ''}`);
  if (deps.assets      > 0) parts.push(`${deps.assets} asset${deps.assets    !== 1 ? 's' : ''}`);
  const suffix = parts.length > 0
    ? ` The area field on ${parts.join(', ')} will be cleared.`
    : '';
  return `Delete area "${name}"?${suffix}`;
}

/**
 * Remove a property area and clear the areaId on any referencing records.
 * @param {object} state
 * @param {string} propertyId
 * @param {string} areaId
 * @returns {Partial<object>}
 */
export function cascadeDeleteArea(state, propertyId, areaId) {
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

/**
 * Build confirmation message for task deletion.
 * @param {{ maintenance:number }} deps
 * @returns {string}
 */
export function taskDeleteMessage(deps) {
  const suffix = deps.maintenance > 0
    ? ` The task link on ${deps.maintenance} maintenance record${deps.maintenance !== 1 ? 's' : ''} will be cleared.`
    : '';
  return `Delete this task?${suffix}`;
}

/**
 * Delete a property task and clear its linkedTaskId on maintenance records.
 * @param {object} state
 * @param {string} taskId
 * @returns {Partial<object>}
 */
export function cascadeDeleteTask(state, taskId) {
  return {
    propertyTasks: arr(state.propertyTasks).filter(t => t.id !== taskId),
    propertyMaintenance: arr(state.propertyMaintenance).map(m =>
      m.linkedTaskId === taskId ? { ...m, linkedTaskId: '' } : m
    ),
  };
}

/**
 * Build confirmation message for asset deletion.
 * @param {string} name
 * @param {{ maintenance:number }} deps
 * @returns {string}
 */
export function assetDeleteMessage(name, deps) {
  const suffix = deps.maintenance > 0
    ? ` The asset link on ${deps.maintenance} maintenance record${deps.maintenance !== 1 ? 's' : ''} will be cleared.`
    : '';
  return `Delete "${name}"?${suffix}`;
}

/**
 * Delete a property asset and clear its assetId on maintenance records.
 * @param {object} state
 * @param {string} assetId
 * @returns {Partial<object>}
 */
export function cascadeDeleteAsset(state, assetId) {
  return {
    propertyAssets: arr(state.propertyAssets).filter(a => a.id !== assetId),
    propertyMaintenance: arr(state.propertyMaintenance).map(m =>
      m.assetId === assetId ? { ...m, assetId: '' } : m
    ),
  };
}

/**
 * Build confirmation message for portfolio deletion.
 * @param {string} name
 * @param {{ holdings:number, contributions:number, dividends:number }} deps
 * @returns {string}
 */
export function portfolioDeleteMessage(name, deps) {
  const parts = [];
  if (deps.holdings      > 0) parts.push(`${deps.holdings} holding${deps.holdings           !== 1 ? 's' : ''}`);
  if (deps.contributions > 0) parts.push(`${deps.contributions} contribution${deps.contributions !== 1 ? 's' : ''}`);
  if (deps.dividends     > 0) parts.push(`${deps.dividends} dividend record${deps.dividends  !== 1 ? 's' : ''}`);
  const suffix = parts.length > 0 ? ` This will also permanently delete ${parts.join(', ')}.` : '';
  return `Delete portfolio "${name}"?${suffix}`;
}

/**
 * Delete a portfolio and all its holdings, contributions, and dividends.
 * @param {object} state
 * @param {string} portfolioId
 * @returns {Partial<object>}
 */
export function cascadeDeletePortfolio(state, portfolioId) {
  const remaining = arr(state.investmentPortfolios).filter(p => p.id !== portfolioId);
  return {
    investmentPortfolios: remaining,
    investments:             arr(state.investments).filter(h => h.portfolioId !== portfolioId),
    investmentContributions: arr(state.investmentContributions).filter(c => c.portfolioId !== portfolioId),
    investmentDividends:     arr(state.investmentDividends).filter(d => d.portfolioId !== portfolioId),
    selectedPortfolioId:
      state.selectedPortfolioId === portfolioId
        ? (remaining.length > 0 ? remaining[remaining.length - 1].id : null)
        : state.selectedPortfolioId,
  };
}

/**
 * Build confirmation message for holding deletion.
 * @param {string} name
 * @param {{ contributions:number, dividends:number }} deps
 * @returns {string}
 */
export function holdingDeleteMessage(name, deps) {
  const parts = [];
  if (deps.contributions > 0) parts.push(`${deps.contributions} contribution${deps.contributions !== 1 ? 's' : ''}`);
  if (deps.dividends     > 0) parts.push(`${deps.dividends} dividend record${deps.dividends     !== 1 ? 's' : ''}`);
  const suffix = parts.length > 0
    ? ` The holding link on ${parts.join(' and ')} will be cleared.`
    : '';
  return `Remove "${name}"?${suffix}`;
}

/**
 * Delete a holding and clear its holdingId on linked contributions and dividends.
 * @param {object} state
 * @param {string} holdingId
 * @returns {Partial<object>}
 */
export function cascadeDeleteHolding(state, holdingId) {
  return {
    investments: arr(state.investments).filter(h => h.id !== holdingId),
    investmentContributions: arr(state.investmentContributions).map(c =>
      c.holdingId === holdingId ? { ...c, holdingId: '' } : c
    ),
    investmentDividends: arr(state.investmentDividends).map(d =>
      d.holdingId === holdingId ? { ...d, holdingId: '' } : d
    ),
  };
}

/**
 * Build confirmation message for person deletion.
 * @param {string} name
 * @param {{ expenses:number }} deps
 * @returns {string}
 */
export function personDeleteMessage(name, deps) {
  const suffix = deps.expenses > 0
    ? ` The person assignment on ${deps.expenses} expense${deps.expenses !== 1 ? 's' : ''} will be cleared.`
    : '';
  return `Remove "${name}"?${suffix}`;
}

/**
 * Delete a person and clear their id from any assigned expenses.
 * @param {object} state
 * @param {string} personId
 * @returns {Partial<object>}
 */
export function cascadeDeletePerson(state, personId) {
  return {
    people: arr(state.people).filter(p => p.id !== personId),
    expenses: arr(state.expenses).map(e =>
      e.forPerson === personId ? { ...e, forPerson: '' } : e
    ),
  };
}
