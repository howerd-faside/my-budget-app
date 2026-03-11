# Fa'Side Budget App — Technical Architecture

> Generated 2026-03-12. Describes the system as it stands at `master`.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Repository Layout](#2-repository-layout)
3. [Major Subsystems](#3-major-subsystems)
4. [Store Architecture](#4-store-architecture)
5. [Persistence Strategy](#5-persistence-strategy)
6. [Migration & Versioning Strategy](#6-migration--versioning-strategy)
7. [Backup & Restore System](#7-backup--restore-system)
8. [Transaction Model](#8-transaction-model)
9. [Cascade Deletion System](#9-cascade-deletion-system)
10. [Validation Layer](#10-validation-layer)
11. [UI Architecture](#11-ui-architecture)
12. [Finance Utilities](#12-finance-utilities)
13. [Test Strategy](#13-test-strategy)
14. [Deprecated & Compatibility Layers](#14-deprecated--compatibility-layers)
15. [Design Decisions](#15-design-decisions)
16. [Data Flow Diagrams](#16-data-flow-diagrams)

---

## 1. System Overview

Fa'Side is a personal finance management SPA for NZ households. It tracks income, expenses, savings trajectory, property portfolio, and investment portfolio. There is no backend — all state is stored in the browser's `localStorage`. The UI is built with React 19 + Vite. State management uses Zustand v5 with a custom persistence layer that supports independent, versioned schema migrations per domain.

**Tech stack**

| Layer | Technology |
|---|---|
| UI | React 19.2 + Vite 6 |
| State | Zustand 5.0 with `persist` middleware |
| Persistence | localStorage (single key `budget_v1`) |
| Charts | Recharts 3.7 |
| Validation | Zod 4.3 |
| Testing | Vitest + jsdom + Testing Library |
| AI features | Anthropic API (wishlist timing, property web lookup) |

---

## 2. Repository Layout

```
src/
├── App.jsx                   — Root layout: sidebar, tab bar, page mounting
├── main.jsx                  — React entry point
├── store.jsx                 — DEPRECATED compatibility bridge (useApp / AppProvider)
│
├── store/                    — Zustand domain stores
│   ├── index.js              — Re-exports all domain hooks
│   ├── budgetStorage.js      — Shared storage adapter (migrations, slice isolation)
│   ├── financeStore.js       — Finance domain store
│   ├── peopleStore.js        — People domain store
│   ├── propertyStore.js      — Property domain store
│   ├── investmentStore.js    — Investment domain store
│   ├── uiStore.js            — UI preferences store (empty placeholder)
│   ├── hooks/
│   │   ├── index.js
│   │   ├── useFinance.js
│   │   ├── usePeople.js
│   │   ├── useProperty.js
│   │   ├── useInvestment.js
│   │   └── useUI.js
│   ├── migrations/
│   │   ├── finance.js        — v0→v1→v2 finance migrations
│   │   ├── people.js         — v0→v1→v2 people migrations
│   │   ├── property.js       — v0→v1→v2 property migrations
│   │   └── investment.js     — v0→v1→v2 investment migrations
│   └── __tests__/            — 15 test files (unit + integration)
│
├── models/                   — Plain-object shape constructors (not classes)
│   ├── Account.js, Person.js, Expense.js, WishlistItem.js
│   ├── Property.js, PropertyTask.js, PropertyMaintenance.js
│   ├── PropertyProject.js, PropertyAsset.js
│   ├── Portfolio.js, Holding.js, InvestmentContribution.js, Dividend.js
│   └── Transaction.js        — Canonical internal money-movement model
│
├── pages/                    — Feature pages (one per tab)
│   ├── Dashboard.jsx, People.jsx, Expenses.jsx
│   ├── FinancialTracking.jsx, Wishlist.jsx, Mortgage.jsx
│   ├── property/             — 6 property sub-pages
│   └── investments/          — 6 investment sub-pages
│
├── components/
│   ├── DataManagement.jsx    — Backup/restore UI
│   ├── ErrorBoundary.jsx
│   ├── Icon.jsx              — Inline SVG icon set
│   ├── Portal.jsx
│   ├── Toast.jsx
│   └── __tests__/            — 6 integration test files
│
└── utils/
    ├── backup.js             — Export / validate / restore backup logic
    ├── cascade.js            — Cascade-delete & dependent-count utilities
    ├── categories.js         — Shared expense groups/categories (10 groups, 48 cats)
    ├── tax.js                — NZ tax / ACC / KiwiSaver (legacy; use finance/tax.js)
    ├── mortgage.js           — Amortisation math (legacy; use finance/mortgage.js)
    ├── priceService.js       — Yahoo Finance proxy for live prices
    ├── retry.js              — Exponential back-off helper
    ├── finance/
    │   ├── dates.js          — Monday-aligned fortnight helpers
    │   ├── frequency.js      — Normalise any frequency to fortnightly
    │   ├── mortgage.js       — Amortisation (annual NZ compounding)
    │   ├── savings.js        — Savings trajectory, portfolio stats
    │   ├── tax.js            — NZ income tax / ACC / KiwiSaver / Student Loan
    │   └── transactions.js   — Transaction query helpers
    └── validation/
        ├── index.js
        ├── accountSchema.js, expenseSchema.js, holdingSchema.js
        ├── propertyAssetSchema.js, propertyTaskSchema.js, wishlistItemSchema.js
```

---

## 3. Major Subsystems

| Subsystem | Purpose | Key Files |
|---|---|---|
| **State layer** | Zustand domain stores, slice isolation, persistence | `store/`, `store/budgetStorage.js` |
| **Migrations** | Schema versioning per domain | `store/migrations/` |
| **Models** | Shape constructors + normalisers | `models/` |
| **Transaction model** | Cross-domain money-movement abstraction | `models/Transaction.js`, `utils/finance/transactions.js` |
| **Backup system** | Export, validate, restore `budget_v1` snapshot | `utils/backup.js`, `components/DataManagement.jsx` |
| **Cascade deletion** | Referential integrity across domains | `utils/cascade.js` |
| **Finance utils** | Tax, fortnight math, savings trajectory | `utils/finance/` |
| **Validation** | Zod schemas for user-entered data | `utils/validation/` |
| **UI pages** | Feature pages mounted by App.jsx | `pages/` |
| **Compatibility bridge** | Legacy `useApp()` / `AppProvider` API | `store.jsx` |

---

## 4. Store Architecture

### Domain boundary model

Each of the four domains owns a disjoint set of `budget_v1` localStorage keys. No domain reads another domain's raw store; cross-domain data access happens only through hooks or derived helpers.

```
┌─────────────────────────────────────────────────────────┐
│                   React Component Tree                  │
│                                                         │
│  useFinance()   usePeople()   useProperty()  useInvestment()
└────┬────────────────┬──────────────┬──────────────┬─────┘
     │                │              │              │
     ▼                ▼              ▼              ▼
┌──────────┐  ┌──────────┐  ┌────────────┐  ┌─────────────┐
│ finance  │  │  people  │  │  property  │  │ investment  │
│  Store   │  │  Store   │  │   Store    │  │   Store     │
└────┬─────┘  └────┬─────┘  └─────┬──────┘  └──────┬──────┘
     │              │              │                │
     └──────────────┴──────────────┴────────────────┘
                          │
                  budgetStorage.js
                  (shared adapter)
                          │
                  localStorage: budget_v1
                  ┌────────────────────┐
                  │  _financeVersion   │
                  │  accounts          │
                  │  transfers         │
                  │  fortnightlyData   │
                  │  goals             │
                  │  assetIncomes      │
                  │  settings          │
                  │  _peopleVersion    │
                  │  people            │
                  │  expenses          │
                  │  wishlist          │
                  │  _propertyVersion  │
                  │  properties        │
                  │  propertyTasks     │
                  │  propertyMaint..   │
                  │  propertyProjects  │
                  │  propertyAssets    │
                  │  selectedProperty  │
                  │  _investVersion    │
                  │  investPortfolios  │
                  │  selectedPortfolio │
                  │  investments       │
                  │  investContribs    │
                  │  investDividends   │
                  └────────────────────┘
```

### Store interface

Each domain store exposes:

```js
// Read
state.accounts, state.transfers, ...

// Write
setSlice(key, val)          — replace a single top-level key
mergeSlices(partialState)   — batch replace multiple keys

// Finance-specific
updateFortnight(year, idx, data)
updateAccount(id, balance)
addTransfer({ fromId, toId, amount, note })
removeTransfer(txId)
```

### Domain hooks (preferred API)

```js
// Component usage
const { accounts, updateAccount, addTransfer } = useFinance()
const { people, expenses }                     = usePeople()
const { properties, propertyTasks }            = useProperty()
const { investments, investmentPortfolios }    = useInvestment()
```

---

## 5. Persistence Strategy

### Shared key, slice isolation

All four Zustand stores persist to the same `localStorage` key (`budget_v1`), but through a custom storage adapter (`budgetStorage.js`) that enforces strict slice isolation:

- **`getItem`** — reads the full `budget_v1` JSON object, then returns only the keys registered to the calling domain.
- **`setItem`** — reads the current full object, merges only the calling domain's keys, writes back atomically.
- **`removeItem`** — removes only the calling domain's keys + its version key from the shared object.

This means stores cannot accidentally overwrite each other's data, even though they share a key.

### Adapter creation signature

```js
createBudgetStorage(
  sliceKeys,       // string[] — keys this domain owns
  domainVersionKey,// string   — e.g. '_financeVersion'
  currentVersion,  // number   — e.g. 2
  migrations       // Migration[] — { toVersion, description, migrate(slice) }
)
```

The adapter validates the migration chain at creation time: `toVersion` values must be strictly contiguous integers (1, 2, 3, …) with no gaps.

### Hydration flow

```
App boots
    │
    ▼
Zustand calls storage.getItem('budget_v1')
    │
    ├─► Read JSON from localStorage
    ├─► Extract domain's slice keys
    ├─► Read _domainVersion (absent = 0)
    ├─► savedVersion < currentVersion?
    │       Yes → run migrations[savedVersion..currentVersion]
    │       No  → use slice as-is
    │   savedVersion > currentVersion?
    │       → console.warn, return slice unchanged (future-version guard)
    │
    └─► Return migrated slice to Zustand
```

### Error handling

- If a migration throws, the pre-migration slice is returned as-is — no data is lost.
- If `localStorage` is empty or corrupt, `getItem` returns `null`, allowing Zustand to use its default state.
- All migration errors are logged to `console.error`.

---

## 6. Migration & Versioning Strategy

### Version numbers

Each domain has its own independent integer version, stored inside `budget_v1`:

| Domain | Key | Current Version |
|---|---|---|
| Finance | `_financeVersion` | 2 |
| People | `_peopleVersion` | 2 |
| Property | `_propertyVersion` | 2 |
| Investment | `_investmentVersion` | 2 |

Absent version key = v0 (first install or pre-versioning data).

### Migration structure

```js
export const FINANCE_MIGRATIONS = [
  {
    toVersion: 1,
    description: 'Normalise accounts; backfill currentBalance',
    migrate(slice) { /* returns new slice */ }
  },
  {
    toVersion: 2,
    description: 'Coerce numeric fields to numbers',
    migrate(slice) { /* returns new slice */ }
  }
]
```

Migrations are applied incrementally: if stored data is at v0 and current is v2, migration 1 runs first, then migration 2 runs on its output. Each migration is a pure function over the slice.

### Migration pattern per version

| Version | Theme |
|---|---|
| v0 → v1 | Entity normalisation — run model constructors over raw stored objects; initialise missing slice arrays to `[]`; backfill structural gaps (e.g. default accounts, `expense.startDate`) |
| v1 → v2 | Numeric coercion — re-run normalisers; ensure all amount/rate/cost fields are stored as `number` not `string` |

### Adding a new migration

1. Increment `DOMAIN_VERSION` in the store file.
2. Add `{ toVersion: N, description, migrate }` entry to the migrations array.
3. Add a test in `store/__tests__/migrations.domain.test.js` for the new migration path.
4. Update `backup.js` `DOMAIN_META.domain.currentVersion` to match.

---

## 7. Backup & Restore System

### Export format

```json
{
  "formatVersion": 1,
  "appVersion": "budget_v1",
  "exportedAt": "2026-03-12T04:00:00.000Z",
  "domains": {
    "finance":    { "version": 2, "data": { "accounts": [...], ... } },
    "people":     { "version": 2, "data": { "people": [...], ... } },
    "property":   { "version": 2, "data": { "properties": [...], ... } },
    "investment": { "version": 2, "data": { "investmentPortfolios": [...], ... } }
  }
}
```

File naming: `faside-backup-YYYY-MM-DD.json`

### Validation rules (18+ checks)

Before any restore, `validateBackup()` enforces:

- Top-level: `formatVersion === 1`, `appVersion === 'budget_v1'`, `exportedAt` is string, `domains` is non-empty object.
- Domain presence: all four known domains must be present — partial restores are rejected.
- No unknown domains allowed.
- Per domain: `version` is a non-negative integer ≤ current app version (rejects backups from a newer app version).
- Per domain data: only allowed `sliceKeys` may be present — no spurious keys.

### Restore flow

```
User selects .json file
    │
    ▼
FileReader.readAsText()
    │
    ▼
JSON.parse()
    │
    ▼
validateBackup()  ──fail──► toast error, stop
    │ pass
    ▼
setPendingBackup (show confirmation modal)
    │ user confirms
    ▼
applyBackup()
  ├─ Read current budget_v1 (to preserve any unrelated keys)
  ├─ For each domain: write data keys + version key
  └─ Single setItem('budget_v1', merged)
    │
    ▼
window.location.reload()
  └─ Zustand re-hydrates; migrations run on any version delta
```

### Key design decision: version preserved in backup

The backup stores the version number at export time. On restore, the original version is written back, then Zustand re-hydrates and runs any pending migrations forward. This means a backup from v1 restored into a v2 app will automatically upgrade cleanly on boot.

---

## 8. Transaction Model

### Purpose

The Transaction model is a **derived, never-persisted** abstraction. Domain models (Expense, Transfer, Contribution, Dividend, AssetIncome) remain the source of truth. The Transaction model provides a canonical shape for cross-domain financial queries — activity feeds, summaries, reporting — without coupling components to each domain's raw shape.

### Shape

```js
{
  id,                  // source entity id
  date,                // ISO date string or null (recurring flows have no event date)
  amount,              // always non-negative
  direction,           // 'INFLOW' | 'OUTFLOW' | 'TRANSFER'
  type,                // 'expense' | 'transfer' | 'contribution' | 'dividend' | 'asset_income'
  domain,              // 'finance' | 'people' | 'investment' | 'property'
  sourceEntityType,    // e.g. 'Expense'
  sourceEntityId,
  targetEntityType,    // e.g. 'Account' (for transfers)
  targetEntityId,
  category,
  notes,
  createdAt,
  frequency,           // only on recurring flows (expense, asset_income)
}
```

### Adapters

```
Domain model          Adapter                     Transaction.direction
─────────────────────────────────────────────────────────────────────
Expense           →   transactionFromExpense      →  OUTFLOW
Transfer          →   transactionFromTransfer     →  TRANSFER
Contribution      →   transactionFromContribution →  OUTFLOW
Dividend          →   transactionFromDividend     →  INFLOW  (amount = netAmount)
AssetIncome       →   transactionFromAssetIncome  →  INFLOW
```

### Transaction flow

```
Domain store                Adapter                  Consumer
────────────────────────────────────────────────────────────
investmentContributions ─► transactionFromContribution ─┐
investmentDividends     ─► transactionFromDividend      ─┼─► getPortfolioActivity()
investments (holdings)  ─► (for name lookups)           ─┘        │
                                                                   ▼
                                                         Chronological activity feed
                                                         (InvestmentDashboard)

assetIncomes     ─► transactionFromAssetIncome ─► calcPortfolioStats() (savings.js)
expenses         ─► transactionFromExpense     ─► future cross-domain reporting
transfers        ─► transactionFromTransfer    ─► future audit trail
```

### Query helpers (`utils/finance/transactions.js`)

```js
getPortfolioActivity(contributions, dividends, holdings, limit=8)
filterByYear(transactions, year)
filterByDateRange(transactions, from, to)
filterByYearMonth(transactions, yearMonth)
sumTransactions(transactions)
sumField(transactions, field)          // e.g. 'grossAmount', 'taxAmount'
groupSumByCategory(transactions)
```

---

## 9. Cascade Deletion System

### Relationship map

```
Property ──────────────── CASCADE DELETE ──► PropertyTask[]
                                         ──► PropertyMaintenance[]
                                         ──► PropertyAsset[]
                                         ──► PropertyProject[]

PropertyArea ──────────── CASCADE CLEAR ──► PropertyTask[].areaId = null
                                        ──► PropertyMaintenance[].areaId = null
                                        ──► PropertyAsset[].areaId = null

PropertyTask ──────────── CASCADE CLEAR ──► PropertyMaintenance[].linkedTaskId = null

PropertyAsset ─────────── CASCADE CLEAR ──► PropertyMaintenance[].assetId = null

Portfolio ─────────────── CASCADE DELETE ──► Holding[]
                                         ──► Contribution[]
                                         ──► Dividend[]

Holding ───────────────── CASCADE CLEAR ──► Contribution[].holdingId = null
                                        ──► Dividend[].holdingId = null

Person ────────────────── CASCADE CLEAR ──► Expense[].forPerson = null
```

**CASCADE DELETE** = parent and all children are removed.
**CASCADE CLEAR** = parent is removed; children remain with the FK field nullified.

### Cascade operation flow

```
User clicks Delete on entity X
    │
    ▼
getXxxDependents(state, id)
  └─► returns { taskCount, maintCount, ... }
    │
    ▼
xxxDeleteMessage(name, deps)
  └─► "Delete 'Maple St'? This will also remove 3 tasks, 2 maintenance records."
    │
    ▼
window.confirm(message)  ──cancel──► stop
    │ confirm
    ▼
cascadeDeleteXxx(state, id)
  └─► returns partial slices: { properties, propertyTasks, ... }
    │
    ▼
cascadeDelete(slices)  [in store.jsx bridge]
  └─► calls mergeSlices() on each affected domain store
```

### Selection reset

When deleting the currently-selected property or portfolio, `cascadeDeleteProperty` / `cascadeDeletePortfolio` resets `selectedPropertyId` / `selectedPortfolioId` to the first remaining item or `null`.

---

## 10. Validation Layer

Zod schemas guard user-entered data at form submission boundaries:

| Schema | Validates |
|---|---|
| `accountSchema` | Account name, balance (number) |
| `expenseSchema` | Amount, frequency, category, group |
| `holdingSchema` | Ticker, units, avgCost, currentPrice (all numeric) |
| `propertyAssetSchema` | Asset name, type, dates, warrantyExpiry, expectedLifespan |
| `propertyTaskSchema` | Title, priority, status, dueDate, effort |
| `wishlistItemSchema` | Item name, estimatedCost |

Schemas are colocated in `utils/validation/` and imported by the relevant page components. Internal store operations do not re-validate (trust is placed at the boundary).

---

## 11. UI Architecture

### Navigation model

```
App.jsx
├── Sidebar
│   ├── Brand (logo + "Fa'Side")
│   ├── Home  (no sub-tabs → Dashboard.jsx)
│   ├── Finances  [collapsible]
│   │   └── Tabs: Overview · Tracking · Income · Expenses · Mortgage · Wishlist
│   ├── Investments
│   │   ├── PortfolioBar (create / rename / cascade-delete portfolio)
│   │   └── Tabs: Dashboard · Holdings · Contributions · Dividends · Performance · Tax
│   └── Property  [collapsible]
│       └── Tabs: Overview · Register · Tasks · Maintenance · Projects · Assets
└── Account Panel (bottom of sidebar — balance per account)
```

### Page mounting pattern

Pages are mounted conditionally; there is no router. `activeSection` + `activeTab` determine which component renders:

```jsx
{activeSection === 'finances' && activeTab === 'overview' && <Dashboard />}
{activeSection === 'finances' && activeTab === 'tracking' && <FinancialTracking />}
// ...
```

### Layout conventions

- `.main-content` — full-width scrollable area.
- `.content-wrap` — centred content column, `max-width: 960px`, `margin: auto`.
- `.dash-section` — white card wrapper; contains `.section-header` + body.
- `.fn-summary` — CSS grid `repeat(auto-fit, minmax(148px, 1fr))` summary tiles.
- `.fn-list` / `.fn-row` — list/row pattern used across all domain pages.
- `.filter-tabs` / `.filter-tab` — pill filter bar.
- `.dpill` — coloured status badge (green/teal/amber/red).
- `.tag` — small category/type label.

### UI → Domain interaction

```
User action (e.g. "Add expense")
    │
    ▼
Page component (e.g. Expenses.jsx)
    │  calls
    ▼
Domain hook (e.g. usePeople)
    │  calls
    ▼
Domain store action (e.g. peopleStore.setSlice('expenses', [...]))
    │
    ▼
Zustand triggers re-render of all subscribed components
    │
    ▼
budgetStorage.setItem merges domain keys back to localStorage
```

---

## 12. Finance Utilities

### NZ-specific calculations (`utils/finance/tax.js`)

- **Tax brackets**: 10.5% / 17.5% / 30% / 33% / 39%
- **ACC levy**: 1.60%, capped at income of $142,283 (2024–25)
- **KiwiSaver**: Employee rates 0/3/4/6/8/10%; `??` operator used so rate=0 (not enrolled) is correctly distinguished from `undefined`
- **Student Loan**: 12% on income above $22,828 threshold, only for `SL` tax codes

### Fortnight model (`utils/finance/dates.js`)

- 26 fortnights per year, Monday-aligned: first Monday on or after Jan 1 = fortnight 0.
- `getFortnight(year, idx)` returns the Monday start date.
- Savings trajectory: `todayIdx` found by scanning forward while `date <= todayStr` (not `findIndex` with `>=`).

### Frequency normalisation (`utils/finance/frequency.js`)

All financial flows are normalised to fortnightly before arithmetic:

```
weekly      × 2    = fortnightly
fortnightly × 1
monthly     × 12/26
quarterly   × 4/26
annually    × 1/26
```

### Mortgage amortisation (`utils/finance/mortgage.js`)

NZ annual compounding converted to effective fortnightly rate:

```
effective rate = (1 + annual_rate)^(1/26) - 1
```

`buildAmortSchedule` produces annual amortisation table; `buildMonthlySchedule` produces monthly P&I for charts.

### Savings trajectory (`utils/finance/savings.js`)

- Anchored to `totalBalance(accounts)` at the current fortnight.
- Projects backward and forward using date-aware income (respects `incomeEvents[]`).
- `calcPortfolioStats` uses Transaction adapters internally for contribution/dividend totals.

---

## 13. Test Strategy

### Test framework

- **Vitest** with **jsdom** environment (configured in `vite.config.js`).
- **@testing-library/react** for component-level integration tests.
- **localStorage** mocked via `src/test/setup.js`.

### Test categories

| Category | Location | Count | Focus |
|---|---|---|---|
| Storage adapter | `store/__tests__/budgetStorage.test.js` | 1 file | getItem/setItem/removeItem; migration chain validation; slice isolation |
| Migrations | `store/__tests__/migrations.*.test.js` | 4 files | v0→v1→v2 paths for each domain; field coercion; missing-data safety |
| Numeric normalisation | `store/__tests__/numeric.normalization.test.js` | 1 file | String-to-number coercion edge cases |
| Slice isolation | `store/__tests__/sliceIsolation.test.js` | 1 file | Domain writes don't pollute other domains |
| Store actions | `store/__tests__/financeStore.actions.test.js` | 1 file | updateFortnight, addTransfer, removeTransfer, updateAccount |
| Derived helpers | `store/__tests__/derivedHelpers.test.js` | 1 file | totalBalance, calcFortnightlyIncome, etc. |
| Hydration | `store/__tests__/hydration.store.test.js` | 1 file | Store initialisation and persistence |
| Persistence round-trip | `store/__tests__/persistence.roundtrip.test.js` | 1 file | Export → persist → reload cycle |
| Backup | `store/__tests__/backup.test.js` | 1 file | Export, validate, apply, version-mismatch handling |
| Transaction model | `store/__tests__/transactions.test.js` | 1 file | Adapters, query helpers |
| Transaction adoption | `store/__tests__/transactionAdoption.test.js` | 1 file | Adapter usage within stores/utils |
| User flows | `store/__tests__/userFlows.integration.test.js` | 1 file | End-to-end multi-store scenarios |
| Cascade deletion | `utils/cascade.test.js` | 1 file | Dependent counts, cascade functions, message builders |
| Finance utils | `utils/finance/*.test.js` | 4 files | dates, frequency, savings, tax |
| Component integration | `components/__tests__/*.test.jsx` | 6 files | DataManagement, Expenses, People, Property, Investment, Backup UI |

### Testing philosophy

- Domain store tests operate directly on store state (no React mounting).
- Component integration tests mount pages with a real Zustand store backed by a mocked `localStorage`.
- No mock databases; persistence tests exercise the real `budgetStorage` adapter with mocked `localStorage`.
- Migration tests always test the full chain from v0 → current version, not just the latest delta.

---

## 14. Previously Deprecated — Removed

### `useApp()`, `KEY_STORE`, `AppProvider` — removed 2026-03-12

These were the last remnants of the original monolithic state API:

- `useApp()` — assembled a flat cross-domain state object and routed `set(key, val)` calls via a `KEY_STORE` lookup. Never called by any component; all pages use domain hooks directly.
- `KEY_STORE` — the key→domain routing table used only by `useApp()` and the internal `cascadeDelete` shim.
- `AppProvider` — a no-op React wrapper (`return children`); Zustand stores are module-level singletons and need no context provider.
- `cascadeDelete(slices)` shim inside `useApp()` — superseded by purpose-built functions in `utils/cascade.js` which call `mergeSlices()` on domain stores directly.

`src/store.jsx` now contains only the pure derived helpers (`totalBalance`, `calcFortnightlyIncome`, `buildSavingsTrajectory`, etc.) that are shared across pages. These are not store-coupled and remain until a dedicated utils module is created.

### `src/utils/tax.js` and `src/utils/mortgage.js`

**Status: Actively used. Not deprecated.**

These root-level files were previously described as superseded, but audit confirms all their exports are imported by current pages (`calcNetPay`, `fmtMoney`, `buildAmortSchedule`, etc.). `utils/finance/` provides overlapping but not identical functionality. New code should prefer `utils/finance/` where coverage exists.

---

## 15. Design Decisions

### Domain-separated stores over a single monolithic store

**Decision**: Four independent Zustand stores (finance, people, property, investment) rather than one.

**Rationale**:
- Clear ownership boundaries prevent accidental cross-domain state mutation.
- Independent versioning: the property schema can be bumped without touching finance migrations.
- Smaller re-render surface: a change in `investmentDividends` does not trigger re-renders in components that only subscribe to `accounts`.
- Easier to test each domain in isolation.

### Shared `localStorage` key with slice isolation

**Decision**: All four stores persist to a single `budget_v1` key, not four separate keys.

**Rationale**:
- `localStorage` is limited to ~5MB per origin; a single structured object is more storage-efficient and avoids key proliferation.
- Atomic export/restore: a single `getItem` / `setItem` captures or replaces the full app state.
- Slice isolation in the storage adapter maintains the same safety guarantees as separate keys, at the cost of a slightly more complex adapter.

### Transaction model as a derived layer

**Decision**: `Transaction` is never stored; adapters convert domain models on demand.

**Rationale**:
- Domain models (Expense, Dividend, etc.) have their own shape requirements and are already persisted. Duplicating data as Transactions would create sync problems.
- Adapters are pure functions — easy to test, easy to extend, no side effects.
- Components that need cross-domain summaries (e.g. a unified activity feed) get a consistent interface without coupling to each domain's internals.

### Versioned migrations per domain

**Decision**: Each domain runs its own independent migration chain on hydration.

**Rationale**:
- Schema changes in one domain don't force all other domains to re-migrate.
- The incrementally-applied, pure-function migration pattern is straightforward to reason about and test.
- Storing the version number inside `budget_v1` (rather than separately) means the version travels with the data — backups always carry their version, enabling forward-migration on restore.

### Cascade deletion with explicit confirmation

**Decision**: Deleting a parent entity (property, portfolio, person) cascades to children but requires an explicit `window.confirm()` showing dependent counts.

**Rationale**:
- Accidental deletion of a property with dozens of tasks and maintenance records is catastrophic in a personal finance app with no server-side undo.
- Showing dependent counts ("This will also remove 5 tasks and 3 maintenance records") gives the user full awareness before a destructive action.
- The distinction between CASCADE DELETE (children removed) and CASCADE CLEAR (FK nullified, record kept) reflects the semantic difference between "this record only makes sense in context of the parent" vs. "this record has independent value".

### Backup rejects partial restores and future-version backups

**Decision**: All four domains must be present in a backup; domain versions may not exceed the current app version.

**Rationale**:
- Partial restores could leave the app in an inconsistent cross-domain state (e.g. a holding that references a portfolio that no longer exists).
- Future-version backups could contain fields or shapes the current migration chain doesn't understand, leading to silent data corruption.

---

## 16. Data Flow Diagrams

### Persistence flow (boot)

```
Browser loads app
        │
        ▼
React renders App.jsx
        │
        ▼ (Zustand initialises each store)
budgetStorage.getItem('budget_v1')
        │
        ├─► Parse JSON from localStorage
        ├─► Extract domain slice keys
        ├─► Read _domainVersion
        │
        ├── [savedVersion < currentVersion] ──► run migrations
        ├── [savedVersion = currentVersion] ──► use as-is
        └── [savedVersion > currentVersion] ──► warn + use as-is
                │
                ▼
        Zustand state populated
                │
                ▼
        Components re-render with hydrated state
```

### Write flow (user action)

```
User submits form
        │
        ▼
Page component validates with Zod schema
        │ pass
        ▼
Domain hook action called
  (e.g. usePeople → peopleStore.setSlice('expenses', newExpenses))
        │
        ▼
Zustand updates in-memory state
        │
        ├─► All subscribed components re-render
        │
        └─► budgetStorage.setItem('budget_v1', newState)
                │
                ├─► Read current budget_v1
                ├─► Merge only this domain's keys
                └─► Write merged object back to localStorage
```

### Backup export flow

```
User clicks "Export Backup"
        │
        ▼
exportBackup()
  ├─► Read budget_v1 from localStorage
  └─► Package each domain: { version, data }
        │
        ▼
downloadBackup(backup)
  └─► Blob → <a download> → browser file save
              faside-backup-YYYY-MM-DD.json
```

### Backup restore flow

```
User selects .json file
        │
        ▼
FileReader.readAsText() → JSON.parse()
        │
        ▼
validateBackup()
  ├─ format/app version check
  ├─ all domains present
  ├─ no unknown domains
  ├─ each domain version ≤ currentVersion
  └─ each domain data has only allowed keys
        │ fail → toast error, stop
        │ pass
        ▼
Show confirmation modal
        │ confirm
        ▼
applyBackup()
  ├─► Read current budget_v1
  ├─► For each domain: overwrite domain keys + version key
  └─► Single setItem write (atomic)
        │
        ▼
window.location.reload()
  └─► Zustand re-hydrates; migrations forward if version delta
```

### Transaction flow (investment activity feed)

```
investmentContributions[]  ─►  transactionFromContribution()  ─┐
investmentDividends[]      ─►  transactionFromDividend()       ─┼─► getPortfolioActivity()
investments[] (name lookup)─►  (enrichment)                    ─┘        │
                                                                          ▼
                                                               Sorted Transaction[]
                                                                          │
                                                                          ▼
                                                               InvestmentDashboard
                                                               (activity feed section)
```

### Cascade delete flow (property example)

```
User clicks "Delete Property"
        │
        ▼
getPropertyDependents(state, propertyId)
  → { taskCount: 3, maintCount: 2, assetCount: 1, projectCount: 0 }
        │
        ▼
propertyDeleteMessage('Maple St', deps)
  → "Delete 'Maple St'? Also removes 3 tasks, 2 records, 1 asset."
        │
        ▼
window.confirm(message)
        │ cancel → stop
        │ confirm
        ▼
cascadeDeleteProperty(state, propertyId)
  → { properties, propertyTasks, propertyMaintenance,
      propertyAssets, propertyProjects, selectedPropertyId }
        │
        ▼
cascadeDelete(slices)  [store.jsx bridge]
  ├─► propertyStore.mergeSlices({ properties, propertyTasks, ... })
  └─► (selectedPropertyId reset if was selected)
```
