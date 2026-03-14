/**
 * Theme persistence — stores user theme preference in localStorage
 * and applies it via a data-theme attribute on <html>.
 */

const THEME_KEY = 'faside_theme';

export function getStoredTheme() {
  try { return localStorage.getItem(THEME_KEY) || 'light'; }
  catch { return 'light'; }
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem(THEME_KEY, theme); }
  catch { /* quota errors etc */ }
}

// Apply saved theme immediately on first import (call-site: App.jsx)
applyTheme(getStoredTheme());
