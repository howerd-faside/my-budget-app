import { useState, useRef } from 'react';
import { AppProvider, useApp, totalBalance } from './store';
import Dashboard from './pages/Dashboard';
import People from './pages/People';
import Expenses from './pages/Expenses';
import FinancialTracking from './pages/FinancialTracking';
import Wishlist from './pages/Wishlist';
import Mortgage from './pages/Mortgage';
import PropertyOverview from './pages/property/PropertyOverview';
import PropertyRegister from './pages/property/PropertyRegister';
import PropertyTasks from './pages/property/PropertyTasks';
import PropertyMaintenance from './pages/property/PropertyMaintenance';
import PropertyProjects from './pages/property/PropertyProjects';
import PropertyAssets from './pages/property/PropertyAssets';
import InvestmentDashboard from './pages/investments/InvestmentDashboard';
import InvestmentHoldings from './pages/investments/InvestmentHoldings';
import InvestmentContributions from './pages/investments/InvestmentContributions';
import InvestmentDividends from './pages/investments/InvestmentDividends';
import InvestmentPerformance from './pages/investments/InvestmentPerformance';
import InvestmentTaxSummary from './pages/investments/InvestmentTaxSummary';
import Icon from './components/Icon';
import fasideLogo from './assets/faside-logo.png';
import './App.css';

const SECTION_TABS = {
  finances: [
    { id: 'overview',  label: 'Overview'    },
    { id: 'tracking',  label: 'Tracking'    },
    { id: 'income',    label: 'Income'       },
    { id: 'expenses',  label: 'Expenses'    },
    { id: 'mortgage',  label: 'Mortgage'    },
    { id: 'wishlist',  label: 'Wishlist'    },
  ],
  property: [
    { id: 'prop-overview',  label: 'Overview'    },
    { id: 'prop-register',  label: 'Properties'  },
    { id: 'prop-tasks',     label: 'Tasks'       },
    { id: 'prop-maint',     label: 'Maintenance' },
    { id: 'prop-projects',  label: 'Projects'    },
    { id: 'prop-assets',    label: 'Assets'      },
  ],
  investments: [
    { id: 'inv-dashboard',   label: 'Overview'      },
    { id: 'inv-holdings',    label: 'Holdings'      },
    { id: 'inv-contrib',     label: 'Contributions' },
    { id: 'inv-dividends',   label: 'Dividends'     },
    { id: 'inv-performance', label: 'Performance'   },
    { id: 'inv-tax',         label: 'Tax Summary'   },
  ],
};

const SECTION_DEFAULT = { finances: 'overview', property: 'prop-overview', investments: 'inv-dashboard' };

const SIDEBAR_SECTIONS = [
  { id: 'home',        label: 'Home',        icon: 'home'     },
  { id: 'finances',    label: 'Finances',    icon: 'wallet'   },
  { id: 'investments', label: 'Investments', icon: 'trend'    },
  { id: 'property',    label: 'Property',    icon: 'building' },
];

const ACCOUNT_COLORS = { main: '#0071E3', emergency: '#FF9F0A', travel: '#AF52DE' };

// ── Portfolio switcher ─────────────────────────────────────────────────────

function PortfolioBar() {
  const { state, set } = useApp();
  const portfolios = state.investmentPortfolios || [];
  const selectedId = state.selectedPortfolioId;

  const [creating,    setCreating]    = useState(false);
  const [newName,     setNewName]     = useState('');
  const [renamingId,  setRenamingId]  = useState(null);
  const [renameText,  setRenameText]  = useState('');
  const inputRef  = useRef(null);
  const renameRef = useRef(null);

  function uid() { return Math.random().toString(36).slice(2, 9); }
  function today() { return new Date().toISOString().slice(0, 10); }

  const startCreate = () => { setCreating(true); setNewName(''); setTimeout(() => inputRef.current?.focus(), 0); };

  const confirmCreate = () => {
    const name = newName.trim();
    if (!name) { setCreating(false); return; }
    const id = uid();
    const newPortfolios = [...portfolios, { id, name, createdAt: today() }];
    set('investmentPortfolios', newPortfolios);
    set('selectedPortfolioId', id);
    setCreating(false);
  };

  const startRename = (p) => {
    setRenamingId(p.id); setRenameText(p.name);
    setTimeout(() => renameRef.current?.focus(), 0);
  };

  const confirmRename = () => {
    const name = renameText.trim();
    if (name && renamingId) {
      set('investmentPortfolios', portfolios.map(p => p.id === renamingId ? { ...p, name } : p));
    }
    setRenamingId(null);
  };

  const deletePortfolio = (id) => {
    if (!window.confirm('Delete this portfolio and all its holdings, contributions, and dividends?')) return;
    const remaining = portfolios.filter(p => p.id !== id);
    set('investmentPortfolios', remaining);
    set('investments',             (state.investments             || []).filter(h => h.portfolioId !== id));
    set('investmentContributions', (state.investmentContributions || []).filter(c => c.portfolioId !== id));
    set('investmentDividends',     (state.investmentDividends     || []).filter(d => d.portfolioId !== id));
    set('selectedPortfolioId', remaining.length > 0 ? remaining[remaining.length - 1].id : null);
  };

  if (portfolios.length === 0 && !creating) {
    return (
      <div className="portfolio-bar">
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>No portfolios yet.</span>
        <button className="portfolio-add-btn" onClick={startCreate}>+ New Portfolio</button>
      </div>
    );
  }

  return (
    <div className="portfolio-bar">
      {portfolios.map(p => {
        const isActive   = p.id === selectedId;
        const isRenaming = renamingId === p.id;
        return (
          <div
            key={p.id}
            className={`portfolio-pill ${isActive ? 'active' : ''}`}
            onClick={() => !isRenaming && set('selectedPortfolioId', p.id)}
          >
            {isRenaming ? (
              <input
                ref={renameRef}
                className="portfolio-rename-input"
                value={renameText}
                onChange={e => setRenameText(e.target.value)}
                onBlur={confirmRename}
                onKeyDown={e => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setRenamingId(null); }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span>{p.name}</span>
            )}
            {isActive && !isRenaming && (
              <>
                <button
                  className="portfolio-pill-action"
                  title="Rename"
                  onClick={e => { e.stopPropagation(); startRename(p); }}
                >
                  <Icon name="pencil" size={9} />
                </button>
                {portfolios.length > 1 && (
                  <button
                    className="portfolio-pill-action danger"
                    title="Delete portfolio"
                    onClick={e => { e.stopPropagation(); deletePortfolio(p.id); }}
                  >
                    <Icon name="trash" size={9} />
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}

      {creating ? (
        <input
          ref={inputRef}
          className="portfolio-new-input"
          placeholder="Portfolio name…"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onBlur={confirmCreate}
          onKeyDown={e => { if (e.key === 'Enter') confirmCreate(); if (e.key === 'Escape') setCreating(false); }}
        />
      ) : (
        <button className="portfolio-add-btn" onClick={startCreate}>+ New</button>
      )}
    </div>
  );
}

function Shell() {
  const [section,  setSection]  = useState('finances');
  const [tab,      setTab]      = useState('overview');
  const [slideDir, setSlideDir] = useState(0);   // -1 | 0 | 1
  const [animKey,  setAnimKey]  = useState(0);

  const { state } = useApp();
  const accounts  = state.accounts || [];
  const netWorth  = totalBalance(accounts);

  const fmtShort = (n) =>
    Math.abs(n) >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n).toLocaleString('en-NZ')}`;

  // ── Navigation ────────────────────────────────────────────────────────────
  const goSection = (newSection) => {
    const defaultTab = SECTION_DEFAULT[newSection];
    if (newSection === section) {
      // Already on this section — go back to its default tab
      if (defaultTab && tab !== defaultTab) goTab(defaultTab);
      return;
    }
    setSection(newSection);
    if (defaultTab) setTab(defaultTab);
    setSlideDir(0);
    setAnimKey(k => k + 1);
  };

  const goTab = (newTab) => {
    if (newTab === tab) return;
    const tabs    = (SECTION_TABS[section] || []).map(t => t.id);
    const oldIdx  = tabs.indexOf(tab);
    const newIdx  = tabs.indexOf(newTab);
    setSlideDir(newIdx > oldIdx ? 1 : -1);
    setAnimKey(k => k + 1);
    setTab(newTab);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const currentTabs = SECTION_TABS[section] || [];
  const animClass   = slideDir === 0 ? 'anim-fade'
                    : slideDir  >  0 ? 'anim-slide-right'
                    :                  'anim-slide-left';

  const renderPage = () => {
    switch (tab) {
      case 'overview':       return <Dashboard />;
      case 'tracking':       return <FinancialTracking />;
      case 'income':         return <People />;
      case 'expenses':       return <Expenses />;
      case 'mortgage':       return <Mortgage />;
      case 'wishlist':       return <Wishlist />;
      case 'prop-overview':  return <PropertyOverview onSelectTab={goTab} />;
      case 'prop-register':  return <PropertyRegister />;
      case 'prop-tasks':     return <PropertyTasks />;
      case 'prop-maint':     return <PropertyMaintenance />;
      case 'prop-projects':  return <PropertyProjects />;
      case 'prop-assets':     return <PropertyAssets />;
      case 'inv-dashboard':   return <InvestmentDashboard onSelectTab={goTab} />;
      case 'inv-holdings':    return <InvestmentHoldings />;
      case 'inv-contrib':     return <InvestmentContributions />;
      case 'inv-dividends':   return <InvestmentDividends />;
      case 'inv-performance': return <InvestmentPerformance />;
      case 'inv-tax':         return <InvestmentTaxSummary />;
      default:                return null;
    }
  };

  return (
    <div className="app">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src={fasideLogo} alt="Fa'Side" className="sidebar-logo" />
          <div className="sidebar-brand-name">Fa'Side</div>
        </div>

        <nav className="sidebar-nav">
          {SIDEBAR_SECTIONS.map(s => (
            <button
              key={s.id}
              className={`nav-item ${section === s.id ? 'active' : ''}`}
              onClick={() => s.id === 'home'
                ? (() => { setSection('home'); setSlideDir(0); setAnimKey(k => k + 1); })()
                : goSection(s.id)
              }
            >
              <span className="nav-icon"><Icon name={s.icon} size={15} /></span>
              <span className="nav-label">{s.label}</span>
            </button>
          ))}
        </nav>

        {/* Accounts panel */}
        <div className="sidebar-accounts" onClick={() => goSection('finances')}>
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

      {/* ── Right panel ─────────────────────────────────────────────────── */}
      <div className="app-right">

        {/* Top tab bar */}
        {currentTabs.length > 0 && (
          <div className="top-tab-bar">
            {currentTabs.map(t => (
              <button
                key={t.id}
                className={`top-tab-btn ${tab === t.id ? 'active' : ''}`}
                onClick={() => goTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Portfolio switcher (investments only) */}
        {section === 'investments' && <PortfolioBar />}

        {/* Page content */}
        <main className="main-content">
          <div className="content-wrap">
            <div key={animKey} className={`page-anim ${animClass}`}>
              {section === 'home' ? <div className="home-blank" /> : renderPage()}
            </div>
          </div>
        </main>

      </div>
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
