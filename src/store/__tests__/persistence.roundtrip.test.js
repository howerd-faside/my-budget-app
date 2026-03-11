/**
 * Round-trip persistence tests using real domain configurations.
 *
 * Verifies that createBudgetStorage with the actual domain slice keys and
 * migration arrays correctly writes, reads back, and migrates data end-to-end.
 * These tests differ from budgetStorage.test.js (which uses synthetic configs)
 * and from the migrations.*.test.js suite (which calls migration functions
 * directly) — here we exercise the full setItem → localStorage → getItem chain
 * with real domain modules.
 *
 * Persistence scenarios covered:
 *   - Finance: write v1 state → read back, all slice keys preserved
 *   - Finance: read v0 legacy payload → currentBalance backfilled via real migration
 *   - Finance: read v0 payload with string balances → coerced to numbers
 *   - Finance: read v0 partial payload → missing slices initialised to defaults
 *   - People: write v1 state → read back, people/expenses/wishlist preserved
 *   - People: read v0 payload with missing expense startDate → backfilled to 2025-11-10
 *   - People: read v0 payload with legacy expense type 'fixed' → migrated to standard/fixed
 *   - People: read v0 partial payload → missing slices initialised to []
 *   - Property: write v1 state → read back, all property slice keys preserved
 *   - Property: read v0 payload with unnormalised project → arrays initialised
 *   - Property: read v0 payload missing insulation field → defaulted to 'unknown'
 *   - Property: read v0 payload without selectedPropertyId → null
 *   - Investment: write v1 state → read back, all investment slice keys preserved
 *   - Investment: read v0 payload without selectedPortfolioId → null
 *   - Investment: read v0 holding with missing fields → defaults applied
 *   - Multi-domain: all four stores write independently → each reads only its slice
 *   - Multi-domain: all four domain version keys stamped in the same budget_v1 entry
 *
 * Migration scenarios covered:
 *   Finance v0 → v1: accounts normalised, legacy currentBalance backfilled,
 *                    missing slices initialised (transfers/goals/assetIncomes/
 *                    fortnightlyData/settings).
 *   People  v0 → v1: people normalised (sub-arrays added), expenses normalised
 *                    (startDate backfill, type 'fixed'/'variable' → standard),
 *                    wishlist normalised.
 *   Property v0 → v1: properties normalised (insulation/areas/valuation),
 *                     tasks/maintenance/assets normalised, projects normalised
 *                     (areas/taskIds/notes/status), selectedPropertyId initialised.
 *   Investment v0 → v1: portfolios/holdings/contributions/dividends normalised,
 *                       selectedPortfolioId initialised.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createBudgetStorage } from '../budgetStorage';

import { FINANCE_KEYS }    from '../financeStore';
import { PEOPLE_KEYS }     from '../peopleStore';
import { PROPERTY_KEYS }   from '../propertyStore';
import { INVESTMENT_KEYS } from '../investmentStore';

import { FINANCE_VERSION,    FINANCE_VERSION_KEY,    FINANCE_MIGRATIONS    } from '../migrations/finance';
import { PEOPLE_VERSION,     PEOPLE_VERSION_KEY,     PEOPLE_MIGRATIONS     } from '../migrations/people';
import { PROPERTY_VERSION,   PROPERTY_VERSION_KEY,   PROPERTY_MIGRATIONS   } from '../migrations/property';
import { INVESTMENT_VERSION, INVESTMENT_VERSION_KEY, INVESTMENT_MIGRATIONS } from '../migrations/investment';

// ── localStorage mock ────────────────────────────────────────────────────────

const storageMap = new Map();
global.localStorage = {
  getItem:    (k) => storageMap.get(k) ?? null,
  setItem:    (k, v) => storageMap.set(k, v),
  removeItem: (k) => storageMap.delete(k),
  clear:      () => storageMap.clear(),
};

const KEY = 'budget_v1';
function readStorage() {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : {};
}
function writeStorage(obj) {
  localStorage.setItem(KEY, JSON.stringify(obj));
}

beforeEach(() => {
  storageMap.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// ── Domain storage factories ─────────────────────────────────────────────────

const makeFinance    = () => createBudgetStorage(FINANCE_KEYS,    FINANCE_VERSION_KEY,    FINANCE_VERSION,    FINANCE_MIGRATIONS);
const makePeople     = () => createBudgetStorage(PEOPLE_KEYS,     PEOPLE_VERSION_KEY,     PEOPLE_VERSION,     PEOPLE_MIGRATIONS);
const makeProperty   = () => createBudgetStorage(PROPERTY_KEYS,   PROPERTY_VERSION_KEY,   PROPERTY_VERSION,   PROPERTY_MIGRATIONS);
const makeInvestment = () => createBudgetStorage(INVESTMENT_KEYS, INVESTMENT_VERSION_KEY, INVESTMENT_VERSION, INVESTMENT_MIGRATIONS);

// Shorthand: write state via setItem, read it back via getItem
function roundTrip(adapter, state) {
  adapter.setItem('_', { state, version: adapter._version });
  return adapter.getItem('_');
}

// ── Finance ──────────────────────────────────────────────────────────────────

describe('finance round-trip (v1 → write → read)', () => {
  it('preserves all finance slice keys', () => {
    const finance = makeFinance();
    const state = {
      accounts:        [{ id: 'main', name: 'Savings', balance: 5000 }, { id: 'emergency', name: 'Emergency', balance: 1000 }, { id: 'travel', name: 'Travel', balance: 200 }],
      transfers:       [{ id: 'tx1', fromId: 'main', toId: 'emergency', amount: 100, note: '', date: '2026-01-01' }],
      fortnightlyData: { 2026: { fortnights: { 0: { adhocTransactions: [] } } } },
      goals:           [{ id: 'g1', name: 'Holiday', amount: 5000, targetDate: '2026-12-01' }],
      assetIncomes:    [{ id: 'ai1', name: 'Rental', type: 'rental', amount: 1200, frequency: 'monthly', notes: '' }],
      settings:        { currentBalance: 0 },
    };
    finance.setItem('_', { state, version: FINANCE_VERSION });
    const result = finance.getItem('_');

    expect(result.state.accounts[0].balance).toBe(5000);
    expect(result.state.transfers[0].id).toBe('tx1');
    expect(result.state.fortnightlyData[2026].fortnights[0].adhocTransactions).toEqual([]);
    expect(result.state.goals[0].name).toBe('Holiday');
    expect(result.state.assetIncomes[0].amount).toBe(1200);
  });

  it('stamps _financeVersion in shared budget_v1 storage', () => {
    const finance = makeFinance();
    finance.setItem('_', { state: { accounts: [], transfers: [], fortnightlyData: {}, goals: [], assetIncomes: [], settings: { currentBalance: 0 } }, version: FINANCE_VERSION });
    expect(readStorage()._financeVersion).toBe(FINANCE_VERSION);
  });
});

describe('finance migration (v0 → v1 via adapter)', () => {
  it('backfills legacy currentBalance into first account', () => {
    writeStorage({ accounts: [], settings: { currentBalance: 7500 } }); // v0 — no _financeVersion
    const result = makeFinance().getItem('_');
    expect(result.state.accounts[0].id).toBe('main');
    expect(result.state.accounts[0].balance).toBe(7500);
    expect(result.state.accounts[1].balance).toBe(0); // others untouched
  });

  it('coerces string account balances to numbers', () => {
    writeStorage({ accounts: [{ id: 'main', name: 'Savings', balance: '3000' }] });
    const result = makeFinance().getItem('_');
    expect(typeof result.state.accounts[0].balance).toBe('number');
    expect(result.state.accounts[0].balance).toBe(3000);
  });

  it('initialises all missing slices to empty defaults', () => {
    writeStorage({ accounts: [{ id: 'main', name: 'Savings', balance: 0 }] });
    const result = makeFinance().getItem('_');
    expect(Array.isArray(result.state.transfers)).toBe(true);
    expect(Array.isArray(result.state.goals)).toBe(true);
    expect(Array.isArray(result.state.assetIncomes)).toBe(true);
    expect(typeof result.state.fortnightlyData).toBe('object');
    expect(result.state.settings).toBeDefined();
  });

  it('does not overwrite non-zero account balances with legacy currentBalance', () => {
    writeStorage({ accounts: [{ id: 'main', name: 'Savings', balance: 2000 }], settings: { currentBalance: 9999 } });
    const result = makeFinance().getItem('_');
    expect(result.state.accounts[0].balance).toBe(2000); // untouched
  });
});

// ── People ───────────────────────────────────────────────────────────────────

describe('people round-trip (v1 → write → read)', () => {
  it('preserves people, expenses, and wishlist', () => {
    const people = makePeople();
    const state = {
      people:   [{ id: 'p1', name: 'Alice', grossAnnual: 80000, taxCode: 'M', kiwiSaverRate: 3, payFrequency: 'fortnightly', secondaryIncomes: [], incomeEvents: [], employmentHistory: [] }],
      expenses: [{ id: 'e1', name: 'Rent', type: 'standard', subtype: 'fixed', amount: 2000, frequency: 'monthly', group: 'Housing', category: 'Rent', startDate: '2026-01-01', endDate: '', facilities: [] }],
      wishlist: [{ id: 'w1', name: 'Bike', estimatedCost: 800, priority: 'Medium', purchased: false, notes: '' }],
    };
    people.setItem('_', { state, version: PEOPLE_VERSION });
    const result = people.getItem('_');

    expect(result.state.people[0].name).toBe('Alice');
    expect(result.state.expenses[0].name).toBe('Rent');
    expect(result.state.wishlist[0].name).toBe('Bike');
  });

  it('stamps _peopleVersion in shared budget_v1 storage', () => {
    makePeople().setItem('_', { state: { people: [], expenses: [], wishlist: [] }, version: PEOPLE_VERSION });
    expect(readStorage()._peopleVersion).toBe(PEOPLE_VERSION);
  });
});

describe('people migration (v0 → v1 via adapter)', () => {
  it('backfills missing expense startDate to 2025-11-10', () => {
    writeStorage({ expenses: [{ id: 'e1', name: 'Rent', type: 'standard', amount: 1000, frequency: 'monthly' }] }); // no startDate, no _peopleVersion
    const result = makePeople().getItem('_');
    expect(result.state.expenses[0].startDate).toBe('2025-11-10');
  });

  it("migrates legacy expense type='fixed' to type='standard', subtype='fixed'", () => {
    writeStorage({ expenses: [{ id: 'e1', name: 'Rent', type: 'fixed', amount: 1000, frequency: 'monthly', startDate: '2026-01-01' }] });
    const result = makePeople().getItem('_');
    expect(result.state.expenses[0].type).toBe('standard');
    expect(result.state.expenses[0].subtype).toBe('fixed');
  });

  it("migrates legacy expense type='variable' to type='standard', subtype='variable'", () => {
    writeStorage({ expenses: [{ id: 'e1', name: 'Food', type: 'variable', amount: 300, frequency: 'weekly', startDate: '2026-01-01' }] });
    const result = makePeople().getItem('_');
    expect(result.state.expenses[0].type).toBe('standard');
    expect(result.state.expenses[0].subtype).toBe('variable');
  });

  it('ensures person sub-arrays are present when missing', () => {
    writeStorage({ people: [{ id: 'p1', name: 'Bob', grossAnnual: 80000 }] }); // no sub-arrays
    const result = makePeople().getItem('_');
    expect(Array.isArray(result.state.people[0].secondaryIncomes)).toBe(true);
    expect(Array.isArray(result.state.people[0].incomeEvents)).toBe(true);
    expect(Array.isArray(result.state.people[0].employmentHistory)).toBe(true);
  });

  it('initialises missing people/expenses/wishlist to empty arrays', () => {
    writeStorage({ _somethingElse: true }); // nothing relevant in storage
    const result = makePeople().getItem('_');
    expect(result.state.people).toEqual([]);
    expect(result.state.expenses).toEqual([]);
    expect(result.state.wishlist).toEqual([]);
  });
});

// ── Property ─────────────────────────────────────────────────────────────────

describe('property round-trip (v1 → write → read)', () => {
  it('preserves all property slice keys', () => {
    const property = makeProperty();
    const state = {
      properties:          [{ id: 'prop1', name: 'Home', type: 'Primary Home' }],
      propertyTasks:       [{ id: 't1', propertyId: 'prop1', title: 'Fix tap', notes: [] }],
      propertyMaintenance: [],
      propertyProjects:    [],
      propertyAssets:      [],
      selectedPropertyId:  'prop1',
    };
    property.setItem('_', { state, version: PROPERTY_VERSION });
    const result = property.getItem('_');

    expect(result.state.properties[0].id).toBe('prop1');
    expect(result.state.selectedPropertyId).toBe('prop1');
    expect(result.state.propertyTasks[0].title).toBe('Fix tap');
  });

  it('stamps _propertyVersion in shared budget_v1 storage', () => {
    makeProperty().setItem('_', { state: { properties: [], propertyTasks: [], propertyMaintenance: [], propertyProjects: [], propertyAssets: [], selectedPropertyId: null }, version: PROPERTY_VERSION });
    expect(readStorage()._propertyVersion).toBe(PROPERTY_VERSION);
  });
});

describe('property migration (v0 → v1 via adapter)', () => {
  it('normalises project with missing array fields (areas/taskIds/notes) to empty arrays', () => {
    writeStorage({ propertyProjects: [{ id: 'proj1', propertyId: 'p1', title: 'Deck' }] });
    const result = makeProperty().getItem('_');
    const proj = result.state.propertyProjects[0];
    expect(Array.isArray(proj.areas)).toBe(true);
    expect(Array.isArray(proj.taskIds)).toBe(true);
    expect(Array.isArray(proj.notes)).toBe(true);
    expect(proj.status).toBe('Planning');
  });

  it("defaults missing insulation to 'unknown' for all three sub-fields", () => {
    writeStorage({ properties: [{ id: 'p1', name: 'Home', type: 'Primary Home' }] }); // no insulation
    const result = makeProperty().getItem('_');
    expect(result.state.properties[0].insulation).toEqual({ ceiling: 'unknown', underfloor: 'unknown', walls: 'unknown' });
  });

  it('initialises selectedPropertyId to null when absent', () => {
    writeStorage({ properties: [] }); // no selectedPropertyId key
    const result = makeProperty().getItem('_');
    expect(result.state.selectedPropertyId).toBeNull();
  });

  it('preserves existing selectedPropertyId', () => {
    writeStorage({ properties: [], selectedPropertyId: 'prop1' });
    const result = makeProperty().getItem('_');
    expect(result.state.selectedPropertyId).toBe('prop1');
  });

  it('initialises all missing property slice arrays', () => {
    writeStorage({}); // completely empty
    const result = makeProperty().getItem('_');
    expect(result.state.properties).toEqual([]);
    expect(result.state.propertyTasks).toEqual([]);
    expect(result.state.propertyMaintenance).toEqual([]);
    expect(result.state.propertyProjects).toEqual([]);
    expect(result.state.propertyAssets).toEqual([]);
  });
});

// ── Investment ────────────────────────────────────────────────────────────────

describe('investment round-trip (v1 → write → read)', () => {
  it('preserves all investment slice keys', () => {
    const investment = makeInvestment();
    const state = {
      investmentPortfolios:    [{ id: 'port1', name: 'Main', createdAt: '2026-01-01T00:00:00.000Z' }],
      selectedPortfolioId:     'port1',
      investments:             [{ id: 'h1', portfolioId: 'port1', name: 'Apple', ticker: 'AAPL', platform: 'Sharesies', category: 'Shares', units: '10', avgCost: '200', currentPrice: '250', notes: '', createdAt: '2026-01-01T00:00:00.000Z' }],
      investmentContributions: [],
      investmentDividends:     [],
    };
    investment.setItem('_', { state, version: INVESTMENT_VERSION });
    const result = investment.getItem('_');

    expect(result.state.investmentPortfolios[0].name).toBe('Main');
    expect(result.state.selectedPortfolioId).toBe('port1');
    expect(result.state.investments[0].ticker).toBe('AAPL');
  });

  it('stamps _investmentVersion in shared budget_v1 storage', () => {
    makeInvestment().setItem('_', { state: { investmentPortfolios: [], selectedPortfolioId: null, investments: [], investmentContributions: [], investmentDividends: [] }, version: INVESTMENT_VERSION });
    expect(readStorage()._investmentVersion).toBe(INVESTMENT_VERSION);
  });
});

describe('investment migration (v0 → v1 via adapter)', () => {
  it('initialises missing selectedPortfolioId to null', () => {
    writeStorage({ investmentPortfolios: [{ id: 'port1', name: 'Main' }], investments: [], investmentContributions: [], investmentDividends: [] }); // no _investmentVersion, no selectedPortfolioId
    const result = makeInvestment().getItem('_');
    expect(result.state.selectedPortfolioId).toBeNull();
  });

  it('applies default category to holding with missing fields', () => {
    writeStorage({ investments: [{ id: 'h1', portfolioId: 'port1', name: 'Tesla' }] }); // minimal
    const result = makeInvestment().getItem('_');
    expect(result.state.investments[0].category).toBe('Shares');
    expect(result.state.investments[0].ticker).toBe('');
  });

  it('initialises all missing investment slice arrays', () => {
    writeStorage({}); // nothing
    const result = makeInvestment().getItem('_');
    expect(result.state.investmentPortfolios).toEqual([]);
    expect(result.state.investments).toEqual([]);
    expect(result.state.investmentContributions).toEqual([]);
    expect(result.state.investmentDividends).toEqual([]);
  });
});

// ── Multi-domain ──────────────────────────────────────────────────────────────

describe('multi-domain round-trip', () => {
  it('all four domains write independently and each reads back only its own slice', () => {
    const finance    = makeFinance();
    const people     = makePeople();
    const property   = makeProperty();
    const investment = makeInvestment();

    finance.setItem('_',    { state: { accounts: [{ id: 'main', name: 'Savings', balance: 9999 }], transfers: [], fortnightlyData: {}, goals: [], assetIncomes: [], settings: { currentBalance: 0 } }, version: FINANCE_VERSION });
    people.setItem('_',     { state: { people: [{ id: 'p1', name: 'Alice' }], expenses: [], wishlist: [] }, version: PEOPLE_VERSION });
    property.setItem('_',   { state: { properties: [{ id: 'prop1', name: 'Home' }], propertyTasks: [], propertyMaintenance: [], propertyProjects: [], propertyAssets: [], selectedPropertyId: 'prop1' }, version: PROPERTY_VERSION });
    investment.setItem('_', { state: { investmentPortfolios: [{ id: 'port1', name: 'Main' }], selectedPortfolioId: 'port1', investments: [], investmentContributions: [], investmentDividends: [] }, version: INVESTMENT_VERSION });

    expect(finance.getItem('_').state.accounts[0].balance).toBe(9999);
    expect(people.getItem('_').state.people[0].name).toBe('Alice');
    expect(property.getItem('_').state.selectedPropertyId).toBe('prop1');
    expect(investment.getItem('_').state.selectedPortfolioId).toBe('port1');
  });

  it('finance read does not include people keys, and vice versa', () => {
    const finance = makeFinance();
    const people  = makePeople();
    finance.setItem('_',  { state: { accounts: [{ id: 'main', balance: 500 }], transfers: [], fortnightlyData: {}, goals: [], assetIncomes: [], settings: { currentBalance: 0 } }, version: FINANCE_VERSION });
    people.setItem('_',   { state: { people: [{ id: 'p1' }], expenses: [], wishlist: [] }, version: PEOPLE_VERSION });

    expect(finance.getItem('_').state).not.toHaveProperty('people');
    expect(people.getItem('_').state).not.toHaveProperty('accounts');
  });

  it('all four domain version keys stamped in the same budget_v1 entry', () => {
    makeFinance().setItem('_',    { state: { accounts: [], transfers: [], fortnightlyData: {}, goals: [], assetIncomes: [], settings: { currentBalance: 0 } }, version: FINANCE_VERSION });
    makePeople().setItem('_',     { state: { people: [], expenses: [], wishlist: [] }, version: PEOPLE_VERSION });
    makeProperty().setItem('_',   { state: { properties: [], propertyTasks: [], propertyMaintenance: [], propertyProjects: [], propertyAssets: [], selectedPropertyId: null }, version: PROPERTY_VERSION });
    makeInvestment().setItem('_', { state: { investmentPortfolios: [], selectedPortfolioId: null, investments: [], investmentContributions: [], investmentDividends: [] }, version: INVESTMENT_VERSION });

    const saved = readStorage();
    expect(saved._financeVersion).toBe(FINANCE_VERSION);
    expect(saved._peopleVersion).toBe(PEOPLE_VERSION);
    expect(saved._propertyVersion).toBe(PROPERTY_VERSION);
    expect(saved._investmentVersion).toBe(INVESTMENT_VERSION);
  });

  it('writing one domain does not disturb other domains already in storage', () => {
    // Pre-populate finance data, then write people — finance must survive
    makeFinance().setItem('_', { state: { accounts: [{ id: 'main', name: 'Savings', balance: 4200 }], transfers: [], fortnightlyData: {}, goals: [], assetIncomes: [], settings: { currentBalance: 0 } }, version: FINANCE_VERSION });
    makePeople().setItem('_',  { state: { people: [{ id: 'p1', name: 'Bob' }], expenses: [], wishlist: [] }, version: PEOPLE_VERSION });

    // Finance accounts must still be in storage
    expect(readStorage().accounts[0].balance).toBe(4200);
    // People data must also be present
    expect(readStorage().people[0].name).toBe('Bob');
  });

  it('migrating v0 data for one domain does not wipe another domain in storage', () => {
    // Pre-seed with v1 people data + v0 finance data in the same key
    writeStorage({
      people:         [{ id: 'p1', name: 'Alice' }],
      expenses:       [],
      wishlist:       [],
      _peopleVersion: 1,
      // Finance v0 data (no _financeVersion)
      accounts:       [],
      settings:       { currentBalance: 5000 },
    });

    // Reading finance triggers migration; people data must be untouched in storage
    const financeResult = makeFinance().getItem('_');
    expect(financeResult.state.accounts[0].balance).toBe(5000); // finance migrated
    // People slice still intact in underlying storage
    expect(readStorage().people[0].name).toBe('Alice');
  });
});
