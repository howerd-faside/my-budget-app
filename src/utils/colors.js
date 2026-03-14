/**
 * Shared color constants used across the application.
 * Centralises presentation tokens so pages import rather than duplicate.
 */

// ── Mortgage rate type colours ───────────────────────────────────────────────
export const RATE_COLORS = {
  fixed: '#FF9F0A', floating: '#34C759', revolving: '#AF52DE', default: '#0071E3',
};

// ── Account colours (sidebar balance panel) ──────────────────────────────────
export const ACCOUNT_COLORS = { main: '#0071E3', emergency: '#FF9F0A', travel: '#AF52DE' };

// ── Account colours as CSS vars (for in-page use) ────────────────────────────
export const ACCOUNT_COLORS_VAR = { main: 'var(--teal)', emergency: 'var(--amber)', travel: 'var(--purple)' };

// ── Property priority colours ────────────────────────────────────────────────
export const PRIORITY_COLOR_HEX = { Urgent: '#FF3B30', High: '#FF9F0A', Medium: '#0071E3', Low: '#86868B' };
export const PRIORITY_COLOR     = { Urgent: 'var(--red)', High: 'var(--amber)', Medium: 'var(--teal)', Low: 'var(--text3)' };
export const PRIORITY_DPILL     = { Urgent: 'red', High: 'amber', Medium: 'teal', Low: '' };
export const PRIORITY_BAR       = { Urgent: 'var(--red)', High: 'var(--amber)', Medium: 'var(--teal)', Low: 'var(--sep2)' };

// ── Property type dpill colours ──────────────────────────────────────────────
export const PROPERTY_TYPE_COLOR = {
  'Primary Home': 'teal', 'Rental': 'amber', 'Bach/Holiday': 'green',
  'Investment': 'purple', 'Land/Section': '', 'Other': '',
};

// ── Investment category colours ──────────────────────────────────────────────
export const CATEGORY_COLORS = /** @type {const} */ ({
  'Shares':       '#0071E3',
  'ETF':          '#34C759',
  'Managed Fund': '#AF52DE',
  'Bonds':        '#FF9F0A',
  'Term Deposit': '#FF6B2B',
  'Crypto':       '#32ADE6',
  'Other':        '#86868B',
});
