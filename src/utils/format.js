/**
 * Shared formatting utilities used across multiple pages.
 * Keeps presentation helpers out of page components.
 */

/** Format number as $X,XXX.XX (absolute value, 2 decimal places). */
export const fmtCurrency = (n) =>
  `$${Math.abs(+n || 0).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Format number as $Xk (rounded, for chart axes / compact display). */
export const fmtK = (v) => `$${(v / 1000).toFixed(0)}k`;

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

/** Shared chart tooltip style object — Apple-style frosted panel. */
export const TOOLTIP_STYLE = {
  background: 'rgba(255,255,255,0.97)',
  border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: 12,
  fontSize: 11,
  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
};
