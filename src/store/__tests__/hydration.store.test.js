/**
 * Store hydration tests.
 *
 * Verifies that each Zustand domain store initialises correctly when pre-seeded
 * localStorage data is present, including migration of legacy (v0) payloads.
 *
 * Pattern:
 *   1. Seed localStorage with a specific budget_v1 payload.
 *   2. vi.resetModules() — clears the module registry so the next import
 *      re-executes the store file and calls create(persist(...)) fresh.
 *   3. await import(storeFile) — store is created and hydration runs
 *      synchronously (createBudgetStorage.getItem is synchronous, so
 *      Zustand's toThenable chain resolves without deferring).
 *   4. Assert store state matches the expected hydrated / migrated values.
 *
 * Persistence scenarios covered:
 *   - Empty localStorage → every store starts with code defaults
 *   - Corrupt localStorage → stores start with code defaults (no crash)
 *   - Finance store: v1 persisted balances load into accounts correctly
 *   - Finance store: v1 goals and transfers load correctly
 *   - Finance store: v0 legacy currentBalance migrated into first account on boot
 *   - Finance store: v0 missing slices initialised on boot
 *   - People store: v1 people array loads correctly
 *   - People store: v0 expense without startDate → startDate backfilled on boot
 *   - People store: v0 legacy type='fixed' expense → type/subtype migrated on boot
 *   - Property store: v1 selectedPropertyId loads correctly
 *   - Property store: v0 project without array fields → normalised on boot
 *   - Investment store: v1 selectedPortfolioId loads correctly
 *   - Investment store: v0 holding with missing category → default applied on boot
 *   - Multi-store: finance + people pre-seeded → both hydrate from same budget_v1
 *   - Post-hydration write: finance action (updateAccount) persists to localStorage
 *     and does not disturb the adjacent people slice
 *
 * Migration scenarios covered:
 *   Finance  v0 → v1 triggered on store boot (legacy currentBalance, missing slices).
 *   People   v0 → v1 triggered on store boot (startDate backfill, type migration).
 *   Property v0 → v1 triggered on store boot (project array normalisation).
 *   Investment v0 → v1 triggered on store boot (holding defaults, selectedPortfolioId).
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ── localStorage mock ────────────────────────────────────────────────────────
// Must be in place before any dynamic store import so the adapter can read from
// it during the synchronous hydration phase inside create(persist(...)).

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
  vi.resetModules(); // clear module cache → next import creates a fresh store
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// ── Finance store ─────────────────────────────────────────────────────────────

describe('finance store hydration', () => {
  it('starts with three default accounts when localStorage is empty', async () => {
    const { useFinanceStore } = await import('../financeStore');
    const { accounts } = useFinanceStore.getState();
    expect(accounts).toHaveLength(3);
    expect(accounts.map(a => a.id)).toEqual(['main', 'emergency', 'travel']);
    expect(accounts.every(a => a.balance === 0)).toBe(true);
  });

  it('starts with empty goals and transfers when localStorage is empty', async () => {
    const { useFinanceStore } = await import('../financeStore');
    const { goals, transfers, assetIncomes } = useFinanceStore.getState();
    expect(goals).toEqual([]);
    expect(transfers).toEqual([]);
    expect(assetIncomes).toEqual([]);
  });

  it('starts with defaults when localStorage is corrupt JSON', async () => {
    localStorage.setItem(KEY, '{ NOT VALID JSON }');
    const { useFinanceStore } = await import('../financeStore');
    const { accounts } = useFinanceStore.getState();
    expect(accounts).toHaveLength(3);
  });

  it('hydrates v1 account balances from persisted state', async () => {
    writeStorage({
      accounts:        [{ id: 'main', name: 'Savings', balance: 12345 }, { id: 'emergency', name: 'Emergency', balance: 500 }, { id: 'travel', name: 'Travel', balance: 200 }],
      transfers:       [],
      fortnightlyData: {},
      goals:           [],
      assetIncomes:    [],
      settings:        { currentBalance: 0 },
      _financeVersion: 1,
    });
    const { useFinanceStore } = await import('../financeStore');
    const { accounts } = useFinanceStore.getState();
    expect(accounts.find(a => a.id === 'main').balance).toBe(12345);
    expect(accounts.find(a => a.id === 'emergency').balance).toBe(500);
  });

  it('hydrates v1 goals and transfers from persisted state', async () => {
    writeStorage({
      accounts:        [{ id: 'main', name: 'Savings', balance: 0 }, { id: 'emergency', name: 'Emergency', balance: 0 }, { id: 'travel', name: 'Travel', balance: 0 }],
      transfers:       [{ id: 'tx1', fromId: 'main', toId: 'emergency', amount: 100, note: '', date: '2026-01-01' }],
      fortnightlyData: {},
      goals:           [{ id: 'g1', name: 'Holiday', amount: 5000 }],
      assetIncomes:    [],
      settings:        { currentBalance: 0 },
      _financeVersion: 1,
    });
    const { useFinanceStore } = await import('../financeStore');
    const { goals, transfers } = useFinanceStore.getState();
    expect(goals).toHaveLength(1);
    expect(goals[0].name).toBe('Holiday');
    expect(transfers[0].id).toBe('tx1');
  });

  it('migrates v0 legacy currentBalance into first account on hydration', async () => {
    writeStorage({
      accounts: [],                          // empty → migration creates defaults
      settings: { currentBalance: 9000 },   // legacy single-balance field
      // no _financeVersion key → treated as v0
    });
    const { useFinanceStore } = await import('../financeStore');
    const { accounts } = useFinanceStore.getState();
    expect(accounts[0].id).toBe('main');
    expect(accounts[0].balance).toBe(9000); // backfilled
    expect(accounts[1].balance).toBe(0);    // others zero
  });

  it('migrates v0 data: initialises missing goals/transfers/assetIncomes on hydration', async () => {
    writeStorage({ accounts: [{ id: 'main', name: 'Savings', balance: 0 }] }); // no goals etc, no version
    const { useFinanceStore } = await import('../financeStore');
    const { goals, transfers, assetIncomes } = useFinanceStore.getState();
    expect(Array.isArray(goals)).toBe(true);
    expect(Array.isArray(transfers)).toBe(true);
    expect(Array.isArray(assetIncomes)).toBe(true);
  });
});

// ── People store ──────────────────────────────────────────────────────────────

describe('people store hydration', () => {
  it('starts with empty arrays when localStorage is empty', async () => {
    const { usePeopleStore } = await import('../peopleStore');
    const { people, expenses, wishlist } = usePeopleStore.getState();
    expect(people).toEqual([]);
    expect(expenses).toEqual([]);
    expect(wishlist).toEqual([]);
  });

  it('hydrates v1 people data', async () => {
    writeStorage({
      people: [{ id: 'p1', name: 'Alice', grossAnnual: 80000, taxCode: 'M', kiwiSaverRate: 3, payFrequency: 'fortnightly', secondaryIncomes: [], incomeEvents: [], employmentHistory: [] }],
      expenses: [],
      wishlist:  [],
      _peopleVersion: 1,
    });
    const { usePeopleStore } = await import('../peopleStore');
    const { people } = usePeopleStore.getState();
    expect(people).toHaveLength(1);
    expect(people[0].name).toBe('Alice');
    expect(people[0].grossAnnual).toBe(80000);
  });

  it('migrates v0 expense: backfills missing startDate to 2025-11-10 on hydration', async () => {
    writeStorage({
      people:   [],
      expenses: [{ id: 'e1', name: 'Rent', type: 'standard', amount: 1500, frequency: 'monthly' }], // no startDate
      wishlist: [],
      // no _peopleVersion → v0
    });
    const { usePeopleStore } = await import('../peopleStore');
    const { expenses } = usePeopleStore.getState();
    expect(expenses[0].startDate).toBe('2025-11-10');
  });

  it("migrates v0 expense: type='fixed' → type='standard', subtype='fixed' on hydration", async () => {
    writeStorage({
      expenses: [{ id: 'e1', name: 'Insurance', type: 'fixed', amount: 200, frequency: 'monthly', startDate: '2026-01-01' }],
    });
    const { usePeopleStore } = await import('../peopleStore');
    const { expenses } = usePeopleStore.getState();
    expect(expenses[0].type).toBe('standard');
    expect(expenses[0].subtype).toBe('fixed');
  });
});

// ── Property store ────────────────────────────────────────────────────────────

describe('property store hydration', () => {
  it('starts with empty arrays and null selectedPropertyId when localStorage is empty', async () => {
    const { usePropertyStore } = await import('../propertyStore');
    const s = usePropertyStore.getState();
    expect(s.properties).toEqual([]);
    expect(s.selectedPropertyId).toBeNull();
  });

  it('hydrates v1 selectedPropertyId from persisted state', async () => {
    writeStorage({
      properties:          [{ id: 'prop1', name: 'Home', type: 'Primary Home' }],
      propertyTasks:       [],
      propertyMaintenance: [],
      propertyProjects:    [],
      propertyAssets:      [],
      selectedPropertyId:  'prop1',
      _propertyVersion:    1,
    });
    const { usePropertyStore } = await import('../propertyStore');
    expect(usePropertyStore.getState().selectedPropertyId).toBe('prop1');
    expect(usePropertyStore.getState().properties[0].id).toBe('prop1');
  });

  it('migrates v0 project: normalises missing array fields on hydration', async () => {
    writeStorage({ propertyProjects: [{ id: 'proj1', propertyId: 'p1', title: 'Deck rebuild' }] }); // no v, no arrays
    const { usePropertyStore } = await import('../propertyStore');
    const { propertyProjects } = usePropertyStore.getState();
    expect(Array.isArray(propertyProjects[0].areas)).toBe(true);
    expect(Array.isArray(propertyProjects[0].taskIds)).toBe(true);
    expect(Array.isArray(propertyProjects[0].notes)).toBe(true);
    expect(propertyProjects[0].status).toBe('Planning');
  });
});

// ── Investment store ──────────────────────────────────────────────────────────

describe('investment store hydration', () => {
  it('starts with null selectedPortfolioId when localStorage is empty', async () => {
    const { useInvestmentStore } = await import('../investmentStore');
    expect(useInvestmentStore.getState().selectedPortfolioId).toBeNull();
  });

  it('hydrates v1 selectedPortfolioId and portfolios from persisted state', async () => {
    writeStorage({
      investmentPortfolios:    [{ id: 'port1', name: 'Main', createdAt: '2026-01-01T00:00:00.000Z' }],
      selectedPortfolioId:     'port1',
      investments:             [],
      investmentContributions: [],
      investmentDividends:     [],
      _investmentVersion:      1,
    });
    const { useInvestmentStore } = await import('../investmentStore');
    expect(useInvestmentStore.getState().selectedPortfolioId).toBe('port1');
    expect(useInvestmentStore.getState().investmentPortfolios[0].name).toBe('Main');
  });

  it('migrates v0 holding: converts to canonical asset with default category on hydration', async () => {
    writeStorage({ investments: [{ id: 'h1', portfolioId: 'port1', name: 'Apple' }] }); // no category, no version
    const { useInvestmentStore } = await import('../investmentStore');
    const state = useInvestmentStore.getState();
    // v5 converts holdings → investmentAssets; v7 empties legacy investments
    expect(state.investments).toEqual([]);
    expect(state.investmentAssets[0].category).toBe('Shares');
    expect(state.investmentAssets[0].name).toBe('Apple');
  });
});

// ── Multi-store hydration ─────────────────────────────────────────────────────

describe('multi-store hydration', () => {
  it('finance and people both hydrate correctly from the same budget_v1 payload', async () => {
    writeStorage({
      // Finance slice
      accounts:        [{ id: 'main', name: 'Savings', balance: 5000 }, { id: 'emergency', name: 'Emergency', balance: 0 }, { id: 'travel', name: 'Travel', balance: 0 }],
      transfers:       [],
      fortnightlyData: {},
      goals:           [],
      assetIncomes:    [],
      settings:        { currentBalance: 0 },
      _financeVersion: 1,
      // People slice
      people:         [{ id: 'p1', name: 'Bob', grossAnnual: 90000, taxCode: 'M', kiwiSaverRate: 3, payFrequency: 'fortnightly', secondaryIncomes: [], incomeEvents: [], employmentHistory: [] }],
      expenses:       [],
      wishlist:       [],
      _peopleVersion: 1,
    });
    const { useFinanceStore } = await import('../financeStore');
    const { usePeopleStore }  = await import('../peopleStore');

    expect(useFinanceStore.getState().accounts.find(a => a.id === 'main').balance).toBe(5000);
    expect(usePeopleStore.getState().people[0].name).toBe('Bob');
  });

  it('post-hydration finance write does not disturb adjacent people slice in localStorage', async () => {
    writeStorage({
      accounts:        [{ id: 'main', name: 'Savings', balance: 2000 }, { id: 'emergency', name: 'Emergency', balance: 0 }, { id: 'travel', name: 'Travel', balance: 0 }],
      transfers:       [],
      fortnightlyData: {},
      goals:           [],
      assetIncomes:    [],
      settings:        { currentBalance: 0 },
      _financeVersion: 1,
      people:          [{ id: 'p2', name: 'Carol', grossAnnual: 60000, taxCode: 'M', kiwiSaverRate: 3, payFrequency: 'fortnightly', secondaryIncomes: [], incomeEvents: [], employmentHistory: [] }],
      expenses:        [],
      wishlist:        [],
      _peopleVersion:  1,
    });

    const { useFinanceStore } = await import('../financeStore');
    const { usePeopleStore }  = await import('../peopleStore');

    // Mutate finance state via action
    useFinanceStore.getState().updateAccount('main', 3000);

    // People state in the store must still be intact
    expect(usePeopleStore.getState().people[0].name).toBe('Carol');

    // Finance change persisted; people slice untouched in localStorage
    const saved = readStorage();
    expect(saved.accounts.find(a => a.id === 'main').balance).toBe(3000);
    expect(saved.people[0].name).toBe('Carol');
  });
});
