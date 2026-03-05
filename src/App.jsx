import { useState } from 'react';
import { AppProvider, useApp, totalBalance } from './store';
import Dashboard from './pages/Dashboard';
import People from './pages/People';
import Expenses from './pages/Expenses';
import FinancialTracking from './pages/FinancialTracking';
import Wishlist from './pages/Wishlist';
import Mortgage from './pages/Mortgage';
import Icon from './components/Icon';
import fasideLogo from './assets/faside-logo.png';
import './App.css';

const FINANCES_TABS = [
  { id: 'overview',  label: 'Overview',  icon: 'home'     },
  { id: 'tracking',  label: 'Tracking',  icon: 'calendar' },
  { id: 'income',    label: 'Incomes',   icon: 'person'   },
  { id: 'expenses',  label: 'Expenses',  icon: 'money'    },
  { id: 'mortgage',  label: 'Mortgage',  icon: 'mortgage' },
  { id: 'wishlist',  label: 'Wishlist',  icon: 'star'     },
];

const ACCOUNT_COLORS = { main: '#0071E3', emergency: '#FF9F0A', travel: '#AF52DE' };

function HomePage() {
  return <div className="home-blank" />;
}

function Shell() {
  const [tab, setTab]             = useState('overview');
  const [finOpen, setFinOpen]     = useState(true);
  const { state }                 = useApp();

  const accounts = state.accounts || [];
  const netWorth = totalBalance(accounts);

  const fmtShort = (n) => {
    if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
    return `$${Math.round(n).toLocaleString('en-NZ')}`;
  };

  return (
    <div className="app">
      <aside className="sidebar">
        {/* Brand header */}
        <div className="sidebar-brand">
          <img src={fasideLogo} alt="Fa'Side" className="sidebar-logo" />
          <div className="sidebar-brand-name">Fa'Side</div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${tab === 'home' ? 'active' : ''}`}
            onClick={() => setTab('home')}
          >
            <span className="nav-icon"><Icon name="home" size={15} /></span>
            <span className="nav-label">Home</span>
          </button>

          <button className="nav-group-header" onClick={() => setFinOpen(f => !f)}>
            <span>Finances</span>
            <span className={`nav-chevron ${finOpen ? 'open' : ''}`}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 4 L5 7 L8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          </button>

          {finOpen && FINANCES_TABS.map(t => (
            <button
              key={t.id}
              className={`nav-item nav-sub-item ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span className="nav-icon"><Icon name={t.icon} size={15} /></span>
              <span className="nav-label">{t.label}</span>
            </button>
          ))}
        </nav>

        {/* Accounts panel — pinned to bottom */}
        <div className="sidebar-accounts" onClick={() => setTab('overview')}>
          <div className="sa-label">Total Savings</div>
          <div className="sa-big-total">
            ${netWorth.toLocaleString('en-NZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>

          {netWorth > 0 && (
            <div className="sa-alloc-bar">
              {accounts.map(a => (
                <div
                  key={a.id}
                  className="sa-alloc-seg"
                  style={{
                    flex: Math.max(0.02, (a.balance || 0) / netWorth),
                    background: ACCOUNT_COLORS[a.id] || '#0071E3',
                  }}
                  title={`${a.name}: ${fmtShort(a.balance)}`}
                />
              ))}
            </div>
          )}

          <div className="sa-accounts">
            {accounts.map(a => {
              const color = ACCOUNT_COLORS[a.id] || '#0071E3';
              const pct   = netWorth > 0 ? Math.round(a.balance / netWorth * 100) : 0;
              return (
                <div key={a.id} className="sa-account">
                  <div className="sa-dot" style={{ background: color }} />
                  <span className="sa-name">{a.name}</span>
                  <div className="sa-right">
                    <span className="sa-bal" style={{ color }}>{fmtShort(a.balance)}</span>
                    <span className="sa-pct">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      <main className="main-content">
        <div className="content-wrap">
          {tab === 'home'     && <HomePage />}
          {tab === 'overview' && <Dashboard />}
          {tab === 'tracking' && <FinancialTracking />}
          {tab === 'income'   && <People />}
          {tab === 'expenses' && <Expenses />}
          {tab === 'mortgage' && <Mortgage />}
          {tab === 'wishlist' && <Wishlist />}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
