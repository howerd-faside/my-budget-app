/**
 * Shared formatting utilities used across multiple pages.
 * Keeps presentation helpers out of page components.
 */

/** Format number as $X,XXX.XX (absolute value, 2 decimal places). */
export const fmtCurrency = (n) =>
  `$${Math.abs(+n || 0).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Format number as $Xk or $X for compact display (chart axes, sidebar, etc.). */
export const fmtK = (v) => {
  const abs = Math.abs(+v || 0);
  return abs >= 1000 ? `$${(abs / 1000).toFixed(1)}k` : `$${abs.toFixed(0)}`;
};

/** Format percentage with sign: "+12.34%" or "-5.67%". */
export const fmtPct = (n) => `${n >= 0 ? '+' : ''}${(+n || 0).toFixed(2)}%`;

/**
 * Human-readable relative time string from an ISO timestamp.
 * Returns null if no timestamp provided.
 */
export function timeAgo(isoStr) {
  if (!isoStr) return null;
  const secs = Math.floor((Date.now() - new Date(isoStr)) / 1000);
  if (secs < 60)    return 'just now';
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

/**
 * Format an ISO YYYY-MM-DD date string as "15 Mar" style for chart axes.
 * Used by cashflow trend charts across FinancesOverview and Home.
 */
const DATE_FMT = new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short' });
export function fmtChartDate(yyyyMmDd) {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  return DATE_FMT.format(new Date(y, m - 1, d));
}

/** Shared chart tooltip style object — uses CSS tokens for dark-mode compat. */
export const TOOLTIP_STYLE = {
  background: 'var(--card)',
  border: '1px solid var(--sep2)',
  borderRadius: 12,
  fontSize: 11,
  boxShadow: 'var(--shadow-md)',
};
