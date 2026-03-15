import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildSavingsTrajectory } from './savings';

// Pin the clock so trajectory anchoring is deterministic.
// 2026-03-14 is a Saturday; the fortnight containing it is anchored by getFortnight(2026, idx).
const TODAY = new Date(2026, 2, 14, 12, 0, 0); // local noon, Sat 14 Mar 2026

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Minimal state factory with sensible defaults.
 */
function makeState(overrides = {}) {
  return {
    people: [],
    expenses: [],
    fortnightlyData: {},
    accounts: [{ id: 'main', balance: 5000 }],
    assetIncomes: [],
    ...overrides,
  };
}

// ── Structure & basic properties ──────────────────────────────────────────────

describe('buildSavingsTrajectory — structure', () => {
  it('returns an array of objects with date, balance, year, idx', () => {
    const rows = buildSavingsTrajectory(makeState());
    expect(rows.length).toBeGreaterThan(0);
    const row = rows[0];
    expect(row).toHaveProperty('date');
    expect(row).toHaveProperty('balance');
    expect(row).toHaveProperty('year');
    expect(row).toHaveProperty('idx');
  });

  it('produces 26 rows per year × 100 years = 2600 rows', () => {
    const rows = buildSavingsTrajectory(makeState());
    expect(rows).toHaveLength(2600);
  });

  it('dates are ISO YYYY-MM-DD strings', () => {
    const rows = buildSavingsTrajectory(makeState());
    for (const r of rows) {
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('rows are chronologically ordered', () => {
    const rows = buildSavingsTrajectory(makeState());
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].date >= rows[i - 1].date).toBe(true);
    }
  });

  it('years span currentYear-1 to currentYear+98 (100-year window)', () => {
    const rows = buildSavingsTrajectory(makeState());
    const years = [...new Set(rows.map(r => r.year))];
    // Pinned clock: 2026-03-14 → window is [2025..2124]
    const expectedYears = Array.from({ length: 100 }, (_, i) => 2025 + i);
    expect(years).toEqual(expectedYears);
    expect(years).toHaveLength(100);
  });

  it('idx values cycle 0–25 within each year', () => {
    const rows = buildSavingsTrajectory(makeState());
    for (let y = 2025; y < 2125; y++) {
      const yearRows = rows.filter(r => r.year === y);
      expect(yearRows.map(r => r.idx)).toEqual(Array.from({ length: 26 }, (_, i) => i));
    }
  });
});

// ── Anchoring ─────────────────────────────────────────────────────────────────

describe('buildSavingsTrajectory — anchoring', () => {
  it('anchors the current fortnight to totalBalance(accounts)', () => {
    const state = makeState({ accounts: [{ id: 'main', balance: 12345 }] });
    const rows = buildSavingsTrajectory(state);
    // Find the row that contains "today" (2026-03-14)
    const todayStr = '2026-03-14';
    // The anchor row should be in early-mid March 2026
    const anchorRow = rows.find(r => {
      const rowDate = new Date(r.date);
      const rowEnd = new Date(rowDate);
      rowEnd.setDate(rowEnd.getDate() + 13);
      return TODAY >= rowDate && TODAY <= rowEnd;
    });
    expect(anchorRow).toBeDefined();
    expect(anchorRow.balance).toBe(12345);
  });

  it('uses sum of all account balances as anchor', () => {
    const state = makeState({
      accounts: [
        { id: 'main', balance: 3000 },
        { id: 'emergency', balance: 2000 },
        { id: 'travel', balance: 500 },
      ],
    });
    const rows = buildSavingsTrajectory(state);
    const anchorRow = rows.find(r => {
      const rowDate = new Date(r.date);
      const rowEnd = new Date(rowDate);
      rowEnd.setDate(rowEnd.getDate() + 13);
      return TODAY >= rowDate && TODAY <= rowEnd;
    });
    expect(anchorRow.balance).toBe(5500);
  });
});

// ── Zero income/expense (flat projection) ─────────────────────────────────────

describe('buildSavingsTrajectory — zero cashflow', () => {
  it('all balances equal the anchor when no income or expenses exist', () => {
    const state = makeState({ accounts: [{ id: 'main', balance: 10000 }] });
    const rows = buildSavingsTrajectory(state);
    for (const r of rows) {
      expect(r.balance).toBe(10000);
    }
  });

  it('zero balance stays at zero with no income or expenses', () => {
    const state = makeState({ accounts: [{ id: 'main', balance: 0 }] });
    const rows = buildSavingsTrajectory(state);
    for (const r of rows) {
      expect(r.balance).toBe(0);
    }
  });
});

// ── Forward/backward projection with income & expenses ───────────────────────

describe('buildSavingsTrajectory — projection with income & expenses', () => {
  it('balance grows when income exceeds expenses', () => {
    const state = makeState({
      accounts: [{ id: 'main', balance: 5000 }],
      people: [{ grossAnnual: 80000, taxCode: 'M', kiwiSaverRate: 3, secondaryIncomes: [], incomeEvents: [], employmentHistory: [] }],
      expenses: [{ amount: 500, frequency: 'fortnightly', startDate: '', endDate: '' }],
    });
    const rows = buildSavingsTrajectory(state);
    const anchorIdx = rows.findIndex(r => r.balance === 5000);
    // Future balances should grow
    if (anchorIdx < rows.length - 1) {
      expect(rows[anchorIdx + 1].balance).toBeGreaterThan(5000);
    }
    // Past balances should be lower
    if (anchorIdx > 0) {
      expect(rows[anchorIdx - 1].balance).toBeLessThan(5000);
    }
  });

  it('balance declines when expenses exceed income', () => {
    const state = makeState({
      accounts: [{ id: 'main', balance: 50000 }],
      people: [],
      expenses: [{ amount: 2000, frequency: 'fortnightly', startDate: '', endDate: '' }],
    });
    const rows = buildSavingsTrajectory(state);
    const anchorIdx = rows.findIndex(r => r.balance === 50000);
    // Future balances decline
    if (anchorIdx < rows.length - 1) {
      expect(rows[anchorIdx + 1].balance).toBeLessThan(50000);
    }
  });

  it('forward projection is additive (each row = prev + cashflow)', () => {
    const state = makeState({
      accounts: [{ id: 'main', balance: 5000 }],
      people: [{ grossAnnual: 52000, taxCode: 'M', kiwiSaverRate: 0, secondaryIncomes: [], incomeEvents: [], employmentHistory: [] }],
      expenses: [],
    });
    const rows = buildSavingsTrajectory(state);
    const anchorIdx = rows.findIndex(r => r.balance === 5000);
    // Check a few forward rows: each differs by a consistent cashflow amount
    if (anchorIdx < rows.length - 2) {
      const delta1 = rows[anchorIdx + 1].balance - rows[anchorIdx].balance;
      const delta2 = rows[anchorIdx + 2].balance - rows[anchorIdx + 1].balance;
      // When income is constant and no date-varying events, deltas should be equal
      expect(delta1).toBeCloseTo(delta2, 0);
    }
  });
});

// ── Ad-hoc transactions ──────────────────────────────────────────────────────

describe('buildSavingsTrajectory — ad-hoc transactions', () => {
  it('includes ad-hoc income in the fortnight it belongs to', () => {
    const baseState = makeState({ accounts: [{ id: 'main', balance: 10000 }] });
    const withAdhoc = makeState({
      accounts: [{ id: 'main', balance: 10000 }],
      fortnightlyData: {
        2026: {
          fortnights: {
            5: { adhocTransactions: [{ amount: 1000 }] },
          },
        },
      },
    });

    const baseRows = buildSavingsTrajectory(baseState);
    const adhocRows = buildSavingsTrajectory(withAdhoc);

    // The row for 2026, idx 5 should differ by 1000
    const baseRow = baseRows.find(r => r.year === 2026 && r.idx === 5);
    const adhocRow = adhocRows.find(r => r.year === 2026 && r.idx === 5);

    // The ad-hoc transaction ripples through all subsequent balances
    const baseAfter = baseRows.filter(r => r.year > 2026 || (r.year === 2026 && r.idx > 5));
    const adhocAfter = adhocRows.filter(r => r.year > 2026 || (r.year === 2026 && r.idx > 5));

    // Every row after the adhoc fortnight should be $1000 higher
    for (let i = 0; i < baseAfter.length; i++) {
      expect(adhocAfter[i].balance - baseAfter[i].balance).toBeCloseTo(1000, 0);
    }
  });

  it('includes ad-hoc expense (negative amount) in the fortnight it belongs to', () => {
    const withExpense = makeState({
      accounts: [{ id: 'main', balance: 10000 }],
      fortnightlyData: {
        2026: {
          fortnights: {
            10: { adhocTransactions: [{ amount: -500 }] },
          },
        },
      },
    });
    const baseRows = buildSavingsTrajectory(makeState({ accounts: [{ id: 'main', balance: 10000 }] }));
    const expenseRows = buildSavingsTrajectory(withExpense);

    const afterBase = baseRows.filter(r => r.year > 2026 || (r.year === 2026 && r.idx > 10));
    const afterExpense = expenseRows.filter(r => r.year > 2026 || (r.year === 2026 && r.idx > 10));

    for (let i = 0; i < afterBase.length; i++) {
      expect(afterExpense[i].balance - afterBase[i].balance).toBeCloseTo(-500, 0);
    }
  });
});

// ── Asset income ─────────────────────────────────────────────────────────────

describe('buildSavingsTrajectory — asset income', () => {
  it('asset income increases the final projected balance vs. baseline', () => {
    const base = makeState({ accounts: [{ id: 'main', balance: 5000 }] });
    const withAsset = makeState({
      accounts: [{ id: 'main', balance: 5000 }],
      assetIncomes: [{ amount: 1000, frequency: 'monthly' }],
    });

    const baseRows = buildSavingsTrajectory(base);
    const assetRows = buildSavingsTrajectory(withAsset);

    // With asset income, the final balance should be higher
    const baseFinal = baseRows[baseRows.length - 1].balance;
    const assetFinal = assetRows[assetRows.length - 1].balance;
    expect(assetFinal).toBeGreaterThan(baseFinal);

    // And the last several rows should consistently be higher
    for (let i = baseRows.length - 10; i < baseRows.length; i++) {
      expect(assetRows[i].balance).toBeGreaterThan(baseRows[i].balance);
    }
  });
});

// ── Date-aware income events ──────────────────────────────────────────────────

describe('buildSavingsTrajectory — income events', () => {
  it('income event reduces projected balance during the event period', () => {
    const person = {
      grossAnnual: 80000, taxCode: 'M', kiwiSaverRate: 3,
      secondaryIncomes: [], employmentHistory: [],
      incomeEvents: [{
        id: 'ev1', label: 'Leave',
        startDate: '2027-01-01', endDate: '2027-06-30',
        grossAnnual: 20000,
      }],
    };

    const noEvent = makeState({
      accounts: [{ id: 'main', balance: 10000 }],
      people: [{ ...person, incomeEvents: [] }],
    });
    const withEvent = makeState({
      accounts: [{ id: 'main', balance: 10000 }],
      people: [person],
    });

    const noEventRows = buildSavingsTrajectory(noEvent);
    const withEventRows = buildSavingsTrajectory(withEvent);

    // During the event period (2027 H1), balances should be lower
    const midEvent = withEventRows.filter(r => r.year === 2027 && r.idx >= 10 && r.idx <= 15);
    const midNoEvent = noEventRows.filter(r => r.year === 2027 && r.idx >= 10 && r.idx <= 15);

    for (let i = 0; i < midEvent.length; i++) {
      expect(midEvent[i].balance).toBeLessThan(midNoEvent[i].balance);
    }
  });
});

// ── Balance rounding ──────────────────────────────────────────────────────────

describe('buildSavingsTrajectory — rounding', () => {
  it('balances are rounded to 2 decimal places', () => {
    const state = makeState({
      accounts: [{ id: 'main', balance: 1000.555 }],
      people: [{ grossAnnual: 33333, taxCode: 'M', kiwiSaverRate: 3, secondaryIncomes: [], incomeEvents: [], employmentHistory: [] }],
    });
    const rows = buildSavingsTrajectory(state);
    for (const r of rows) {
      const decimals = (r.balance.toString().split('.')[1] || '').length;
      expect(decimals).toBeLessThanOrEqual(2);
    }
  });
});

// ── Deterministic outputs ─────────────────────────────────────────────────────

describe('buildSavingsTrajectory — determinism', () => {
  it('produces identical output when called twice with the same state', () => {
    const state = makeState({
      accounts: [{ id: 'main', balance: 7500 }],
      people: [{ grossAnnual: 65000, taxCode: 'M', kiwiSaverRate: 3, secondaryIncomes: [], incomeEvents: [], employmentHistory: [] }],
      expenses: [{ amount: 800, frequency: 'fortnightly', startDate: '', endDate: '' }],
    });
    const run1 = buildSavingsTrajectory(state);
    const run2 = buildSavingsTrajectory(state);
    expect(run1).toEqual(run2);
  });
});

// ── Empty/null inputs ─────────────────────────────────────────────────────────

describe('buildSavingsTrajectory — empty inputs', () => {
  it('handles empty accounts array (balance = 0)', () => {
    const state = makeState({ accounts: [] });
    const rows = buildSavingsTrajectory(state);
    expect(rows).toHaveLength(2600);
    // All balances should be 0 with no income/expenses
    for (const r of rows) {
      expect(r.balance).toBe(0);
    }
  });

  it('handles null people and expenses', () => {
    const state = makeState({ people: null, expenses: null });
    expect(() => buildSavingsTrajectory(state)).not.toThrow();
  });

  it('handles missing fortnightlyData gracefully', () => {
    const state = makeState({ fortnightlyData: {} });
    expect(() => buildSavingsTrajectory(state)).not.toThrow();
    expect(buildSavingsTrajectory(state)).toHaveLength(2600);
  });
});
