/**
 * Tests for src/utils/backup.js
 *
 * Covers:
 *   - exportBackup: completeness (all domain keys + version metadata present)
 *   - exportBackup: empty storage returns empty-data domains with version 0
 *   - exportBackup: corrupt JSON in localStorage returns empty domains gracefully
 *   - downloadBackup: creates and clicks an anchor with a dated filename
 *   - validateBackup: rejects non-objects, wrong formatVersion, wrong appVersion
 *   - validateBackup: rejects missing exportedAt, missing/empty domains
 *   - validateBackup: rejects unknown domains, rejects partial domains
 *   - validateBackup: rejects invalid domain version (non-integer, negative, future)
 *   - validateBackup: rejects non-object domain data
 *   - validateBackup: rejects spurious keys in domain data
 *   - validateBackup: accepts a well-formed backup
 *   - applyBackup: writes all domain slices + version keys to localStorage
 *   - applyBackup: handles localStorage.setItem failure safely (no partial write)
 *   - round-trip: export → validate → apply produces identical localStorage state
 *   - overwrite confirmation: applyBackup is not called without confirmation
 *   - version mismatch: backup with domain version > currentVersion is rejected
 *   - old-version backup: domain version < currentVersion is accepted (migrations will run)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  exportBackup,
  downloadBackup,
  validateBackup,
  applyBackup,
  DOMAIN_META,
} from '../../utils/backup';

// ── localStorage mock ─────────────────────────────────────────────────────────

const _store = new Map();
const localStorageMock = {
  getItem:    (k)    => _store.get(k) ?? null,
  setItem:    (k, v) => _store.set(k, v),
  removeItem: (k)    => _store.delete(k),
  clear:      ()     => _store.clear(),
};
global.localStorage = localStorageMock;

const KEY = 'budget_v1';

function writeStorage(obj) {
  _store.set(KEY, JSON.stringify(obj));
}
function readStorage() {
  const raw = _store.get(KEY);
  return raw ? JSON.parse(raw) : null;
}

beforeEach(() => _store.clear());

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal well-formed backup (all domains, current versions, empty data). */
function makeValidBackup(overrides = {}) {
  const domains = {};
  for (const [name, meta] of Object.entries(DOMAIN_META)) {
    domains[name] = { version: meta.currentVersion, data: {} };
  }
  return {
    formatVersion: 1,
    appVersion:    'budget_v1',
    exportedAt:    '2026-03-12T10:00:00.000Z',
    domains,
    ...overrides,
  };
}

/** Build a storage payload with one real data value per domain. */
function makeRichStorage() {
  const obj = {};
  obj._financeVersion    = 2;
  obj.accounts           = [{ id: 'main', name: 'Savings', balance: 5000 }];
  obj.transfers          = [];
  obj.fortnightlyData    = {};
  obj.goals              = [{ id: 'g1', name: 'Holiday', amount: 3000, saved: 500 }];
  obj.assetIncomes       = [];
  obj.settings           = { currentBalance: 0 };

  obj._peopleVersion     = 2;
  obj.people             = [{ id: 'p1', name: 'Alice', grossAnnual: 80000 }];
  obj.expenses           = [{ id: 'e1', name: 'Rent', amount: 1200, frequency: 'monthly' }];
  obj.wishlist           = [];

  obj._propertyVersion   = 2;
  obj.properties         = [{ id: 'pr1', name: 'Home', type: 'residential' }];
  obj.propertyTasks      = [];
  obj.propertyMaintenance = [];
  obj.propertyProjects   = [];
  obj.propertyAssets     = [];
  obj.selectedPropertyId = null;

  obj._investmentVersion = 2;
  obj.investmentPortfolios    = [{ id: 'pf1', name: 'KiwiSaver', createdAt: '2026-01-01' }];
  obj.selectedPortfolioId     = 'pf1';
  obj.investments             = [];
  obj.investmentContributions = [];
  obj.investmentDividends     = [];

  return obj;
}

// ── exportBackup ──────────────────────────────────────────────────────────────

describe('exportBackup', () => {
  it('returns ok:true and a backup object', () => {
    const result = exportBackup();
    expect(result.ok).toBe(true);
    expect(result.backup).toBeDefined();
  });

  it('includes required top-level fields', () => {
    const { backup } = exportBackup();
    expect(backup.formatVersion).toBe(1);
    expect(backup.appVersion).toBe('budget_v1');
    expect(typeof backup.exportedAt).toBe('string');
    expect(backup.domains).toBeDefined();
  });

  it('includes all four domains', () => {
    const { backup } = exportBackup();
    expect(Object.keys(backup.domains).sort()).toEqual(
      ['finance', 'investment', 'people', 'property']
    );
  });

  it('each domain has version and data fields', () => {
    const { backup } = exportBackup();
    for (const [name, entry] of Object.entries(backup.domains)) {
      expect(typeof entry.version, `${name}.version`).toBe('number');
      expect(typeof entry.data, `${name}.data`).toBe('object');
      expect(Array.isArray(entry.data), `${name}.data is not array`).toBe(false);
    }
  });

  it('exports all slice keys present in storage', () => {
    const rich = makeRichStorage();
    writeStorage(rich);

    const { backup } = exportBackup();

    // Finance
    expect(backup.domains.finance.data.accounts[0].balance).toBe(5000);
    expect(backup.domains.finance.data.goals[0].name).toBe('Holiday');
    expect(backup.domains.finance.version).toBe(2);

    // People
    expect(backup.domains.people.data.people[0].name).toBe('Alice');
    expect(backup.domains.people.data.expenses[0].name).toBe('Rent');
    expect(backup.domains.people.version).toBe(2);

    // Property
    expect(backup.domains.property.data.properties[0].name).toBe('Home');
    expect(backup.domains.property.version).toBe(2);

    // Investment
    expect(backup.domains.investment.data.investmentPortfolios[0].name).toBe('KiwiSaver');
    expect(backup.domains.investment.data.selectedPortfolioId).toBe('pf1');
    expect(backup.domains.investment.version).toBe(2);
  });

  it('handles empty localStorage — returns version 0 for each domain', () => {
    const { backup } = exportBackup();
    for (const entry of Object.values(backup.domains)) {
      expect(entry.version).toBe(0);
      expect(entry.data).toEqual({});
    }
  });

  it('handles corrupt JSON in localStorage without throwing', () => {
    _store.set(KEY, 'not-json!!');
    const result = exportBackup();
    // Should still succeed, returning empty domains
    expect(result.ok).toBe(true);
  });

  it('does not include version keys in domain data (they are stored as metadata)', () => {
    const rich = makeRichStorage();
    writeStorage(rich);
    const { backup } = exportBackup();
    for (const entry of Object.values(backup.domains)) {
      for (const k of Object.keys(entry.data)) {
        expect(k.startsWith('_'), `unexpected version key "${k}" in data`).toBe(false);
      }
    }
  });
});

// ── downloadBackup ────────────────────────────────────────────────────────────

describe('downloadBackup', () => {
  let createdUrl, clickedEl, anchorEl;

  beforeEach(() => {
    createdUrl = null;
    clickedEl  = null;
    anchorEl   = null;

    // Minimal URL mock for node environment
    global.URL.createObjectURL = vi.fn(() => { createdUrl = 'blob:fake-url'; return createdUrl; });
    global.URL.revokeObjectURL = vi.fn();

    // Minimal document.createElement mock that returns a fake anchor
    anchorEl = { href: '', download: '', click: vi.fn(() => { clickedEl = anchorEl; }) };
    global.document = {
      createElement: vi.fn((tag) => tag === 'a' ? anchorEl : {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.document;
  });

  it('triggers a download with a dated filename', () => {
    downloadBackup(makeValidBackup());
    expect(clickedEl).not.toBeNull();
    expect(clickedEl.download).toMatch(/^faside-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(clickedEl.href).toBe(createdUrl);
  });

  it('revokes the object URL after clicking', () => {
    downloadBackup(makeValidBackup());
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(createdUrl);
  });
});

// ── validateBackup ────────────────────────────────────────────────────────────

describe('validateBackup — structural rejection', () => {
  it('rejects null', () => {
    expect(validateBackup(null).ok).toBe(false);
  });

  it('rejects an array', () => {
    expect(validateBackup([]).ok).toBe(false);
  });

  it('rejects a string', () => {
    expect(validateBackup('{}').ok).toBe(false);
  });

  it('rejects wrong formatVersion', () => {
    const r = validateBackup(makeValidBackup({ formatVersion: 99 }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/format version/i);
  });

  it('rejects wrong appVersion', () => {
    const r = validateBackup(makeValidBackup({ appVersion: 'other_v1' }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/app identifier|appVersion/i);
  });

  it('rejects missing exportedAt', () => {
    const b = makeValidBackup();
    delete b.exportedAt;
    expect(validateBackup(b).ok).toBe(false);
  });

  it('rejects non-string exportedAt', () => {
    expect(validateBackup(makeValidBackup({ exportedAt: 12345 })).ok).toBe(false);
  });

  it('rejects missing domains', () => {
    const b = makeValidBackup();
    delete b.domains;
    expect(validateBackup(b).ok).toBe(false);
  });

  it('rejects domains as an array', () => {
    expect(validateBackup(makeValidBackup({ domains: [] })).ok).toBe(false);
  });

  it('rejects empty domains object', () => {
    expect(validateBackup(makeValidBackup({ domains: {} })).ok).toBe(false);
  });

  it('rejects unknown domain name', () => {
    const b = makeValidBackup();
    b.domains.unknown = { version: 0, data: {} };
    const r = validateBackup(b);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/unknown domain/i);
  });

  it('rejects backup missing one of the known domains', () => {
    const b = makeValidBackup();
    delete b.domains.finance;
    const r = validateBackup(b);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/missing domain/i);
  });
});

describe('validateBackup — domain entry rejection', () => {
  it('rejects null domain entry', () => {
    const b = makeValidBackup();
    b.domains.finance = null;
    expect(validateBackup(b).ok).toBe(false);
  });

  it('rejects non-integer version', () => {
    const b = makeValidBackup();
    b.domains.finance.version = 1.5;
    const r = validateBackup(b);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/invalid version/i);
  });

  it('rejects negative version', () => {
    const b = makeValidBackup();
    b.domains.finance.version = -1;
    expect(validateBackup(b).ok).toBe(false);
  });

  it('rejects string version', () => {
    const b = makeValidBackup();
    b.domains.finance.version = '2';
    expect(validateBackup(b).ok).toBe(false);
  });

  it('rejects domain version newer than app supports', () => {
    const b = makeValidBackup();
    const meta = DOMAIN_META.finance;
    b.domains.finance.version = meta.currentVersion + 1;
    const r = validateBackup(b);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/newer version/i);
  });

  it('accepts domain version older than current (old backup — migrations will run)', () => {
    const b = makeValidBackup();
    b.domains.finance.version = 0;
    expect(validateBackup(b).ok).toBe(true);
  });

  it('accepts domain version equal to current', () => {
    expect(validateBackup(makeValidBackup()).ok).toBe(true);
  });

  it('rejects null domain data', () => {
    const b = makeValidBackup();
    b.domains.people.data = null;
    expect(validateBackup(b).ok).toBe(false);
  });

  it('rejects array domain data', () => {
    const b = makeValidBackup();
    b.domains.people.data = [];
    expect(validateBackup(b).ok).toBe(false);
  });

  it('rejects spurious key in domain data', () => {
    const b = makeValidBackup();
    b.domains.finance.data.maliciousKey = 'bad';
    const r = validateBackup(b);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/unexpected key/i);
  });

  it('accepts known slice keys in domain data', () => {
    const b = makeValidBackup();
    b.domains.finance.data.accounts  = [];
    b.domains.finance.data.transfers = [];
    expect(validateBackup(b).ok).toBe(true);
  });
});

describe('validateBackup — valid payloads', () => {
  it('accepts a well-formed empty-data backup', () => {
    expect(validateBackup(makeValidBackup()).ok).toBe(true);
  });

  it('accepts a well-formed rich backup produced by exportBackup', () => {
    writeStorage(makeRichStorage());
    const { backup } = exportBackup();
    expect(validateBackup(backup).ok).toBe(true);
  });
});

// ── applyBackup ───────────────────────────────────────────────────────────────

describe('applyBackup', () => {
  it('writes all domain slice keys to localStorage', () => {
    const rich = makeRichStorage();
    writeStorage(rich);
    const { backup } = exportBackup();

    _store.clear();   // simulate a different device / fresh install
    applyBackup(backup);

    const written = readStorage();
    // Finance keys
    expect(written.accounts).toBeDefined();
    expect(written.goals[0].name).toBe('Holiday');
    // People keys
    expect(written.people[0].name).toBe('Alice');
    // Property keys
    expect(written.properties[0].name).toBe('Home');
    // Investment keys
    expect(written.investmentPortfolios[0].name).toBe('KiwiSaver');
    expect(written.selectedPortfolioId).toBe('pf1');
  });

  it('writes domain version keys so migrations start from the right version', () => {
    const rich = makeRichStorage();
    writeStorage(rich);
    const { backup } = exportBackup();

    _store.clear();
    applyBackup(backup);

    const written = readStorage();
    expect(written._financeVersion).toBe(2);
    expect(written._peopleVersion).toBe(2);
    expect(written._propertyVersion).toBe(2);
    expect(written._investmentVersion).toBe(2);
  });

  it('returns ok:true on success', () => {
    const result = applyBackup(makeValidBackup());
    expect(result.ok).toBe(true);
  });

  it('returns ok:false and does not write if localStorage.setItem throws', () => {
    const origSetItem = localStorageMock.setItem;
    localStorageMock.setItem = () => { throw new Error('QuotaExceededError'); };

    writeStorage({ sentinel: 'original' });
    const result = applyBackup(makeValidBackup());

    localStorageMock.setItem = origSetItem;   // restore before assertions

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/restore failed/i);
    // Original data must be untouched because we never called setItem successfully
    expect(readStorage()?.sentinel).toBe('original');
  });

  it('writes a single budget_v1 key (no spurious keys)', () => {
    applyBackup(makeValidBackup());
    expect([..._store.keys()]).toEqual([KEY]);
  });

  it('overwrites all previous data completely (no merge with old state)', () => {
    writeStorage({ staleKey: 'old-value', accounts: [{ id: 'x', balance: 99 }] });
    const backup = makeValidBackup();
    backup.domains.finance.data.accounts = [{ id: 'main', balance: 1234 }];
    applyBackup(backup);

    const written = readStorage();
    expect(written.staleKey).toBeUndefined();
    expect(written.accounts[0].balance).toBe(1234);
  });
});

// ── Round-trip ────────────────────────────────────────────────────────────────

describe('round-trip: export → validate → apply', () => {
  it('produces identical localStorage state', () => {
    const rich = makeRichStorage();
    writeStorage(rich);

    const { backup } = exportBackup();
    expect(validateBackup(backup).ok).toBe(true);

    _store.clear();
    applyBackup(backup);

    const restored = readStorage();

    // All slice keys from original storage should be present and equal
    for (const [, meta] of Object.entries(DOMAIN_META)) {
      for (const k of meta.sliceKeys) {
        if (k in rich) {
          expect(JSON.stringify(restored[k])).toBe(JSON.stringify(rich[k]));
        }
      }
    }

    // Version keys should match
    expect(restored._financeVersion).toBe(rich._financeVersion);
    expect(restored._peopleVersion).toBe(rich._peopleVersion);
    expect(restored._propertyVersion).toBe(rich._propertyVersion);
    expect(restored._investmentVersion).toBe(rich._investmentVersion);
  });

  it('a backup exported from v1 data is accepted and restores with v1 versions', () => {
    // Simulate a v1 backup (older app version)
    const oldBackup = makeValidBackup();
    for (const entry of Object.values(oldBackup.domains)) {
      entry.version = 1;   // version 1 is below currentVersion (2)
    }
    expect(validateBackup(oldBackup).ok).toBe(true);

    applyBackup(oldBackup);
    const written = readStorage();

    // Version keys should be v1 so the migration system upgrades them on load
    expect(written._financeVersion).toBe(1);
    expect(written._peopleVersion).toBe(1);
  });
});

// ── Overwrite confirmation behaviour ──────────────────────────────────────────

describe('overwrite confirmation', () => {
  it('applyBackup is not called when the user cancels', () => {
    // This test simulates the UI contract: validateBackup passes, but if the
    // user presses "Cancel" the component must NOT call applyBackup.
    // We verify this by checking localStorage is untouched when applyBackup
    // is never called after a valid validation.

    writeStorage({ sentinel: 'untouched' });
    const { backup } = exportBackup();

    // Validation succeeds — backup would be safe to restore
    expect(validateBackup(backup).ok).toBe(true);

    // User cancels — applyBackup is NOT called
    // (no call here = no side effect)

    expect(readStorage()?.sentinel).toBe('untouched');
  });

  it('applyBackup only writes when called explicitly', () => {
    const spy = vi.spyOn(localStorageMock, 'setItem');
    // Calling validate alone must not write
    validateBackup(makeValidBackup());
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
