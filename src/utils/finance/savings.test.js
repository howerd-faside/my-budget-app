import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { affordabilityStatus, affordabilityDate, findGoalHit } from './savings';

// ── Trajectory fixture factory ────────────────────────────────────────────────
//
// savings.js calls monthsBetween(new Date(), ...) which depends on wall-clock
// "today". We pin the clock so tests are deterministic.

const TODAY = '2025-06-01';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(TODAY));
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Build a minimal trajectory: balance grows by `step` every fortnight.
 * @param {number} startBalance
 * @param {number} step
 * @param {string} startDate  ISO date of first row
 * @param {number} rows
 */
function makeTrajectory(startBalance, step, startDate = TODAY, rows = 52) {
  const traj = [];
  let balance = startBalance;
  let date = new Date(startDate);
  for (let i = 0; i < rows; i++) {
    traj.push({ date: date.toISOString().slice(0, 10), balance });
    balance += step;
    date = new Date(date);
    date.setDate(date.getDate() + 14);
  }
  return traj;
}

// ── affordabilityStatus ───────────────────────────────────────────────────────
describe('affordabilityStatus', () => {
  it('returns "unknown" when cost is 0', () => {
    expect(affordabilityStatus(0, 5000, [])).toBe('unknown');
  });

  it('returns "unknown" when cost is negative', () => {
    expect(affordabilityStatus(-100, 5000, [])).toBe('unknown');
  });

  it('returns "now" when current balance >= cost', () => {
    expect(affordabilityStatus(1000, 2000, [])).toBe('now');
    expect(affordabilityStatus(1000, 1000, [])).toBe('now');
  });

  it('returns "beyond" when trajectory never reaches cost', () => {
    const traj = makeTrajectory(0, 10); // grows very slowly
    expect(affordabilityStatus(1_000_000, 0, traj)).toBe('beyond');
  });

  it('returns "soon" when affordable within 6 months (~13 fortnights)', () => {
    // $0 balance, need $1 000, saving $200/fn → reached in 5 fortnights ≈ 10 weeks ≈ 2.5 months
    const traj = makeTrajectory(0, 200, TODAY);
    expect(affordabilityStatus(1000, 0, traj)).toBe('soon');
  });

  it('returns "later" when affordable in 7–18 months', () => {
    // $0 balance, need $1 600, saving $100/fn → reached in 16 fortnights
    // 16 × 14 days from 2025-06-01 ≈ 2026-01-10 → monthsBetween = 7 → 'later'
    const traj = makeTrajectory(0, 100, TODAY, 52);
    expect(affordabilityStatus(1600, 0, traj)).toBe('later');
  });

  it('returns "far" when affordable only after 18+ months', () => {
    // $0 balance, need $20 000, saving $50/fn → 400 fortnights ≈ many years
    const traj = makeTrajectory(0, 50, TODAY, 400);
    expect(affordabilityStatus(10_000, 0, traj)).toBe('far');
  });
});

// ── affordabilityDate ─────────────────────────────────────────────────────────
describe('affordabilityDate', () => {
  it('returns null when already affordable', () => {
    expect(affordabilityDate(500, 1000, [])).toBeNull();
  });

  it('returns null when cost is 0 or negative', () => {
    expect(affordabilityDate(0, 100, [])).toBeNull();
    expect(affordabilityDate(-50, 100, [])).toBeNull();
  });

  it('returns null when trajectory never reaches cost', () => {
    const traj = makeTrajectory(0, 1);
    expect(affordabilityDate(1_000_000, 0, traj)).toBeNull();
  });

  it('returns "This month" when affordable within the current month', () => {
    // Reached in < 1 month: trajectory hits cost on the first row (today)
    const traj = [{ date: TODAY, balance: 5000 }];
    expect(affordabilityDate(5000, 4000, traj)).toBe('This month');
  });

  it('returns a month string (e.g. "~3 months") for short-term goals', () => {
    // Need $3 000, have $0, saving $300/fn → 10 fortnights ≈ ~5 months
    const traj = makeTrajectory(0, 300, TODAY);
    const result = affordabilityDate(3000, 0, traj);
    expect(result).toMatch(/~\d+ months?/);
  });

  it('returns a year string (e.g. "~1y 6m") for long-term goals', () => {
    // Need $30 000, saving $100/fn → 300 fortnights ≈ ~6.9 years
    const traj = makeTrajectory(0, 100, TODAY, 400);
    const result = affordabilityDate(30_000, 0, traj);
    expect(result).toMatch(/~\d+y/);
  });

  it('returns a year string without month component when months % 12 === 0', () => {
    // Spike balance at exactly 24 months (2 years) from TODAY.
    // TODAY = 2025-06-01; 2 years later = 2027-06-01.
    // Build a trajectory that first hits the target at 2027-06-01.
    const hitDate = '2027-06-01';
    const traj = [
      { date: TODAY,    balance: 0 },
      { date: hitDate,  balance: 99999 },
    ];
    const result = affordabilityDate(99999, 0, traj);
    // monthsBetween(2025-06-01, 2027-06-01) = 24 → yrs=2, mths=0 → "~2y"
    expect(result).toBe('~2y');
  });
});

// ── findGoalHit ───────────────────────────────────────────────────────────────
describe('findGoalHit', () => {
  it('returns null when trajectory never reaches goal amount', () => {
    const traj = makeTrajectory(0, 10, TODAY, 10);
    expect(findGoalHit(traj, { amount: 1_000_000 })).toBeNull();
  });

  it('returns the YYYY-MM of the first point that meets the goal', () => {
    const traj = makeTrajectory(0, 500, TODAY, 52);
    // Need $5 000 → reached after 10 fortnights (0-indexed hit at idx 10)
    const result = findGoalHit(traj, { amount: 5000 });
    expect(result).toMatch(/^\d{4}-\d{2}$/);
  });

  it('returns the first month when balance already exceeds goal from the start', () => {
    const traj = makeTrajectory(10_000, 100, TODAY);
    expect(findGoalHit(traj, { amount: 5000 })).toBe(TODAY.slice(0, 7));
  });

  it('goal amount 0 is hit immediately', () => {
    const traj = makeTrajectory(0, 100, TODAY);
    const result = findGoalHit(traj, { amount: 0 });
    expect(result).toBe(TODAY.slice(0, 7));
  });

  it('goal with no amount field treated as 0', () => {
    const traj = makeTrajectory(0, 100, TODAY);
    const result = findGoalHit(traj, {});
    expect(result).toBe(TODAY.slice(0, 7));
  });
});

