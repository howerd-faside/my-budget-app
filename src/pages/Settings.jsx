import { useState, useEffect } from 'react';
import { getStoredTheme, applyTheme } from '../utils/theme';
import Icon from '../components/Icon';
import DataManagement from '../components/DataManagement';

// ── Settings page ──────────────────────────────────────────────────────────
export default function Settings() {
  const [theme, setTheme] = useState(getStoredTheme);

  useEffect(() => { applyTheme(theme); }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  return (
    <div className="dm-page">

      <div className="dm-header">
        <div className="dm-header-icon">
          <Icon name="settings" size={22} strokeWidth={1.4} />
        </div>
        <div>
          <h1 className="dm-title">Settings</h1>
          <p className="dm-subtitle">Manage your app preferences and data.</p>
        </div>
      </div>

      {/* ── Appearance ──────────────────────────────────────────────────── */}
      <div className="dash-section dm-card">
        <div className="dm-card-icon dm-card-icon--teal">
          <Icon name="sparkle" size={20} strokeWidth={1.5} />
        </div>
        <h2 className="dm-card-title">Appearance</h2>
        <p className="dm-card-desc">
          Choose how the app looks. Your preference is saved automatically.
        </p>

        <div className="settings-row">
          <div className="settings-row-label">
            <span className="settings-row-title">Dark Mode</span>
            <span className="settings-row-desc">Switch between light and dark themes</span>
          </div>
          <button
            className={`toggle-switch${theme === 'dark' ? ' on' : ''}`}
            role="switch"
            aria-checked={theme === 'dark'}
            onClick={toggleTheme}
          >
            <span className="toggle-knob" />
          </button>
        </div>
      </div>

      {/* ── Backup ──────────────────────────────────────────────────────── */}
      <DataManagement />
    </div>
  );
}
