/** Today's date as a YYYY-MM-DD string. */
export function today(): string { return new Date().toISOString().slice(0, 10); }

export interface FortnightRange {
  start: Date;
  end: Date;
}

/**
 * Monday-aligned fortnight date range.
 * Finds the first Monday on or after Jan 1 of the given year,
 * then advances by idx * 14 days.
 */
export function getFortnight(year: number, idx: number): FortnightRange {
  const jan1 = new Date(year, 0, 1);
  const dow = jan1.getDay(); // 0=Sun … 6=Sat
  const daysToMonday = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
  const firstMonday = new Date(year, 0, 1 + daysToMonday);
  const start = new Date(firstMonday);
  start.setDate(start.getDate() + idx * 14);
  const end = new Date(start);
  end.setDate(end.getDate() + 13);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Whole-day difference between two ISO date strings (b − a).
 * Positive when b is after a, negative when b is before a.
 */
export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

/**
 * Calendar-month difference between two dates (b − a), truncated.
 * Accepts Date objects or ISO date strings.
 */
export function monthsBetween(dateA: Date | string, dateB: Date | string): number {
  const a = typeof dateA === 'string' ? new Date(dateA) : dateA;
  const b = typeof dateB === 'string' ? new Date(dateB) : dateB;
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}
