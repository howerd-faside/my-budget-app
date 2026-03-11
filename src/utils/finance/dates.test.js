import { describe, it, expect } from 'vitest';
import { getFortnight, monthsBetween } from './dates';

/** Format a Date using local timezone components (avoids UTC shift on UTC+N systems). */
function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Returns the difference in calendar days between two Date objects using
 * UTC-normalised date components. This avoids DST hour-shifts distorting
 * millisecond arithmetic (e.g. a 23-hour "day" returning 12 instead of 13).
 */
function calendarDayDiff(a, b) {
  const aMs = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bMs = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return (bMs - aMs) / 86_400_000;
}

// ── getFortnight ──────────────────────────────────────────────────────────────
describe('getFortnight', () => {
  // Each fortnight must start on a Monday and span exactly 14 calendar days.

  it('start date is always a Monday (getDay() === 1)', () => {
    for (const year of [2024, 2025, 2026, 2027, 2028]) {
      for (let idx = 0; idx < 26; idx++) {
        const { start } = getFortnight(year, idx);
        expect(start.getDay(), `year=${year} idx=${idx}`).toBe(1);
      }
    }
  });

  it('end date is 13 calendar days after start', () => {
    // Use UTC-normalised calendar-day arithmetic to avoid DST distortion.
    for (const year of [2024, 2025, 2026]) {
      for (let idx = 0; idx < 26; idx++) {
        const { start, end } = getFortnight(year, idx);
        expect(calendarDayDiff(start, end), `year=${year} idx=${idx}`).toBe(13);
      }
    }
  });

  it('fortnight 0 starts on the first Monday of or after Jan 1 (2025)', () => {
    // 2025-01-01 is a Wednesday → first Monday is 2025-01-06
    const { start } = getFortnight(2025, 0);
    expect(localDateStr(start)).toBe('2025-01-06');
  });

  it('fortnight 1 starts exactly 14 calendar days after fortnight 0', () => {
    const f0 = getFortnight(2025, 0);
    const f1 = getFortnight(2025, 1);
    expect(calendarDayDiff(f0.start, f1.start)).toBe(14);
  });

  it('26 consecutive fortnights span roughly a full year', () => {
    const f0  = getFortnight(2025, 0);
    const f25 = getFortnight(2025, 25);
    // 26 × 14 = 364 calendar days (start to start); add 13 for the final end
    const totalDays = calendarDayDiff(f0.start, f25.end) + 1;
    expect(totalDays).toBeGreaterThanOrEqual(363);
    expect(totalDays).toBeLessThanOrEqual(366);
  });

  it('returns distinct Date objects (not shared references)', () => {
    const { start, end } = getFortnight(2025, 0);
    expect(start).not.toBe(end);
  });

  it('idx 0 start is in January of the same year', () => {
    for (const year of [2024, 2025, 2026, 2027]) {
      const { start } = getFortnight(year, 0);
      expect(start.getFullYear()).toBe(year);
      expect(start.getMonth()).toBe(0); // January
    }
  });

  // Year starting on different days of the week — compare local date components.
  it('handles a year starting on Sunday (2023-01-01 is Sunday → Monday 2023-01-02)', () => {
    const { start } = getFortnight(2023, 0);
    expect(localDateStr(start)).toBe('2023-01-02');
    expect(start.getDay()).toBe(1);
  });

  it('handles a year starting on Monday (2024-01-01 is Monday — first fortnight starts Jan 1)', () => {
    const { start } = getFortnight(2024, 0);
    expect(localDateStr(start)).toBe('2024-01-01');
    expect(start.getDay()).toBe(1);
  });

  it('each fortnight start is exactly 14 calendar days after the previous', () => {
    for (let idx = 1; idx < 26; idx++) {
      const prev = getFortnight(2025, idx - 1);
      const curr = getFortnight(2025, idx);
      expect(calendarDayDiff(prev.start, curr.start), `idx=${idx}`).toBe(14);
    }
  });
});

// ── monthsBetween ─────────────────────────────────────────────────────────────
describe('monthsBetween', () => {
  it('same date returns 0', () => {
    expect(monthsBetween('2025-01-15', '2025-01-15')).toBe(0);
  });

  it('returns positive value when b is after a', () => {
    expect(monthsBetween('2025-01-01', '2025-07-01')).toBe(6);
  });

  it('returns negative value when b is before a', () => {
    expect(monthsBetween('2025-07-01', '2025-01-01')).toBe(-6);
  });

  it('spans a year boundary correctly', () => {
    expect(monthsBetween('2024-11-01', '2025-02-01')).toBe(3);
  });

  it('spans multiple years', () => {
    expect(monthsBetween('2022-01-01', '2025-01-01')).toBe(36);
  });

  it('uses year and month components only — day of month is not considered', () => {
    // Any day in Jan to any day in Feb = 1 month; same month = 0
    expect(monthsBetween('2025-01-01', '2025-02-28')).toBe(1);
    expect(monthsBetween('2025-01-31', '2025-02-01')).toBe(1);
    expect(monthsBetween('2025-01-01', '2025-01-31')).toBe(0);
  });

  it('accepts Date objects', () => {
    const a = new Date(2025, 0, 1);  // Jan 2025
    const b = new Date(2025, 5, 1);  // Jun 2025
    expect(monthsBetween(a, b)).toBe(5);
  });

  it('accepts mixed Date and string inputs', () => {
    const a = new Date(2025, 0, 1);
    expect(monthsBetween(a, '2025-04-01')).toBe(3);
  });

  it('large range: 10 years', () => {
    expect(monthsBetween('2015-06-01', '2025-06-01')).toBe(120);
  });
});
