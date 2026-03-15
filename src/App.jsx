import { useState, useRef } from 'react';
import './utils/theme'; // init theme before first render
import { totalBalance } from './utils/finance/savings';
import { useFinance }    from './store/hooks';
import { useInvestment } from './store/hooks';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import FinancesOverview from './pages/FinancesOverview';
import People from './pages/People';
import Expenses from './pages/Expenses';
import FinancialTracking from './pages/FinancialTracking';
import Wishlist from './pages/Wishlist';
import MortgageOverview from './pages/MortgageOverview';
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
import InvestmentAssets from './pages/investments/InvestmentAssets';
import InvestmentTransactions from './pages/investments/InvestmentTransactions';
import InvestmentPerformance from './pages/investments/InvestmentPerformance';
import InvestmentTaxSummary from './pages/investments/InvestmentTaxSummary';
import InvestmentPortfolios from './pages/investments/InvestmentPortfolios';
import InvestmentDiscovery from './pages/investments/InvestmentDiscovery';
import { getPortfolioDependents, cascadeDeletePortfolio, portfolioDeleteMessage } from './utils/cascade';
import Settings from './pages/Settings';
import Icon from './components/Icon';
import { Card, SectionHeader, ConfirmDialog } from './components/ui';
import fasideLogo from './assets/faside-logo.png';
import { useProperty } from './store/hooks';
import { NavigationProvider } from './contexts/NavigationContext';
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
    { id: 'inv-discovery',   label: 'Discovery'     },
    { id: 'inv-assets',        label: 'Assets'        },
    { id: 'inv-transactions', label: 'Transactions'  },
    { id: 'inv-holdings',     label: 'Holdings'      },
    { id: 'inv-contrib',      label: 'Contributions' },
    { id: 'inv-dividends',    label: 'Dividends'     },
    { id: 'inv-performance', label: 'Performance'   },
    { id: 'inv-tax',         label: 'Tax & Reports' },
    { id: 'inv-manage',      label: 'Manage'        },
  ],
};

const SECTION_DEFAULT = { finances: 'overview', property: 'prop-overview', investments: 'inv-dashboard' };

const SIDEBAR_SECTIONS = [
  { id: 'home',        label: 'Home',        icon: 'home'     },
  { id: 'finances',    label: 'Finances',    icon: 'wallet'   },
  { id: 'investments', label: 'Investments', icon: 'trend'    },
  { id: 'property',    label: 'Property',    icon: 'building' },
  { id: 'settings',    label: 'Settings',    icon: 'settings' },
];

import { ACCOUNT_COLORS } from './utils/colors';
import { today } from './utils/finance/dates';

// ── Portfolio switcher ─────────────────────────────────────────────────────

function PortfolioBar() {
  const {
    investmentPortfolios, selectedPortfolioId,
    investments, investmentContributions, investmentDividends,
    investmentAssets,
    setInvestment, mergeInvestment,
  } = useInvestment();
  const portfolios = (investmentPortfolios || []).filter(p => !p.archived);
  const selectedId = selectedPortfolioId;

  const [creating,   setCreating]   = useState(false);
  const [newName,    setNewName]    = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameText, setRenameText] = useState('');
  const [confirmTarget, setConfirmTarget] = useState(null);
  const inputRef  = useRef(null);
  const renameRef = useRef(null);

  const startCreate = () => { setCreating(true); setNewName(''); setTimeout(() => inputRef.current?.focus(), 0); };

  const confirmCreate = () => {
    const name = newName.trim();
    if (!name) { setCreating(false); return; }
    const id = crypto.randomUUID();
    setInvestment('investmentPortfolios', [...portfolios, { id, name, createdAt: today() }]);
    setInvestment('selectedPortfolioId', id);
    setCreating(false);
  };

  const startRename = (p) => {
    setRenamingId(p.id); setRenameText(p.name);
    setTimeout(() => renameRef.current?.focus(), 0);
  };

  const confirmRename = () => {
    const name = renameText.trim();
    if (name && renamingId) {
      setInvestment('investmentPortfolios', portfolios.map(p => p.id === renamingId ? { ...p, name } : p));
    }
    setRenamingId(null);
  };

  const deletePortfolio = (id) => {
    const portfolio = portfolios.find(p => p.id === id);
    if (!portfolio) return;
    const invState = { investmentPortfolios, selectedPortfolioId, investments, investmentContributions, investmentDividends };
    const deps = getPortfolioDependents(invState, id);
    setConfirmTarget({ id, message: portfolioDeleteMessage(portfolio.name, deps), invState });
  };

  const executeDeletePortfolio = () => {
    if (confirmTarget) mergeInvestment(cascadeDeletePortfolio(confirmTarget.invState, confirmTarget.id));
    setConfirmTarget(null);
  };

  const selPortfolio = portfolios.find(p => p.id === selectedId);

  return (
    <Card variant="section" style={{ marginBottom: 24 }}>
      <SectionHeader
        title={<><Icon name="layers" size={15} /> Portfolios</>}
        subtitle={
          portfolios.length === 0
            ? 'No portfolios yet'
            : `${portfolios.length} ${portfolios.length === 1 ? 'portfolio' : 'portfolios'} · click to select`
        }
        actions={
          <button className="btn-ghost small" onClick={startCreate}>+ New Portfolio</button>
        }
      />

      {(portfolios.length > 0 || creating) && (
        <div className="prop-selector">
          {portfolios.map(p => {
            const assetCount = (investmentAssets || []).filter(a => a.portfolioId === p.id).length;
            const isSelected = p.id === selectedId;
            const isRenaming = renamingId === p.id;
            return (
              <div
                key={p.id}
                className={`prop-sel-item${isSelected ? ' selected' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`Select portfolio ${p.name}`}
                onClick={() => !isRenaming && setInvestment('selectedPortfolioId', p.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); !isRenaming && setInvestment('selectedPortfolioId', p.id); } }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                  {isRenaming ? (
                    <input
                      ref={renameRef}
                      className="prop-sel-rename-input"
                      value={renameText}
                      onChange={e => setRenameText(e.target.value)}
                      onBlur={confirmRename}
                      onKeyDown={e => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setRenamingId(null); }}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className="prop-sel-name"
                      title="Click to rename"
                      onClick={e => { e.stopPropagation(); startRename(p); }}
                      style={{ cursor: 'text' }}
                    >{p.name}</span>
                  )}
                  {portfolios.length > 1 && !isRenaming && (
                    <button
                      className="btn-icon small danger prop-sel-del"
                      title="Delete portfolio"
                      aria-label={`Delete portfolio ${p.name}`}
                      onClick={e => { e.stopPropagation(); deletePortfolio(p.id); }}
                    >
                      <Icon name="trash" size={11} />
                    </button>
                  )}
                </div>
                <div className="prop-sel-meta">
                  <span className="tag">{assetCount} {assetCount === 1 ? 'asset' : 'assets'}</span>
                </div>
              </div>
            );
          })}

          {creating && (
            <div className="prop-sel-item prop-sel-creating">
              <input
                ref={inputRef}
                className="prop-sel-new-input"
                placeholder="Portfolio name…"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onBlur={confirmCreate}
                onKeyDown={e => { if (e.key === 'Enter') confirmCreate(); if (e.key === 'Escape') setCreating(false); }}
              />
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmTarget}
        title="Delete portfolio"
        message={confirmTarget?.message || ''}
        onConfirm={executeDeletePortfolio}
        onCancel={() => setConfirmTarget(null)}
      />
    </Card>
  );
}

// ── Property switcher ──────────────────────────────────────────────────────

const ALL_SCOPE_TABS = new Set(['prop-tasks', 'prop-maint', 'prop-projects', 'prop-assets']);

function PropertyBar({ currentTab, onAddProperty }) {
  const { properties, propertyTasks, selectedPropertyId, setProperty } = useProperty();
  const props = properties || [];
  const showAll = ALL_SCOPE_TABS.has(currentTab);

  return (
    <Card variant="section" style={{ marginBottom: 24 }}>
      <SectionHeader
        title={<><Icon name="building" size={15} /> Properties</>}
        subtitle={
          props.length === 0
            ? 'No properties yet'
            : `${props.length} ${props.length === 1 ? 'property' : 'properties'} · click to select`
        }
        actions={
          <button className="btn-ghost small" onClick={onAddProperty}>+ Add Property</button>
        }
      />

      {props.length > 0 && (
        <div className="prop-selector">
          {showAll && props.length > 1 && (
            <div
              className={`prop-sel-item${selectedPropertyId === null ? ' selected' : ''}`}
              role="button"
              tabIndex={0}
              aria-label="Select all properties"
              onClick={() => setProperty('selectedPropertyId', null)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setProperty('selectedPropertyId', null); } }}
            >
              <span className="prop-sel-name">All Properties</span>
              <div className="prop-sel-meta">
                <span className="tag">{props.length} properties</span>
              </div>
            </div>
          )}
          {props.map(p => {
            const openTasks = (propertyTasks || []).filter(t => t.propertyId === p.id && t.status !== 'Done' && t.status !== 'Cancelled').length;
            const isSelected = p.id === selectedPropertyId;
            return (
              <div
                key={p.id}
                className={`prop-sel-item${isSelected ? ' selected' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`Select property ${p.name}`}
                onClick={() => setProperty('selectedPropertyId', p.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setProperty('selectedPropertyId', p.id); } }}
              >
                <span className="prop-sel-name">{p.name}</span>
                {p.address && <span className="prop-sel-addr">{p.address}</span>}
                <div className="prop-sel-meta">
                  {p.type && <span className="tag">{p.type}</span>}
                  <span className="tag">{openTasks} {openTasks === 1 ? 'task' : 'tasks'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function Shell() {
  const [section,  setSection]  = useState('finances');
  const [tab,      setTab]      = useState('overview');
  const [slideDir,      setSlideDir]      = useState(0);   // -1 | 0 | 1
  const [animKey,       setAnimKey]       = useState(0);
  const [propNewTrigger, setPropNewTrigger] = useState(0);

  const { accounts: rawAccounts } = useFinance();
  const accounts  = rawAccounts || [];
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
      case 'overview':       return <FinancesOverview />;
      case 'tracking':       return <FinancialTracking />;
      case 'income':         return <People />;
      case 'expenses':       return <Expenses />;
      case 'mortgage':       return <MortgageOverview />;
      case 'wishlist':       return <Wishlist />;
      case 'prop-overview':  return <PropertyOverview />;
      case 'prop-register':  return <PropertyRegister openNewTrigger={propNewTrigger} onOpenNewHandled={() => setPropNewTrigger(0)} />;
      case 'prop-tasks':     return <PropertyTasks />;
      case 'prop-maint':     return <PropertyMaintenance />;
      case 'prop-projects':  return <PropertyProjects />;
      case 'prop-assets':     return <PropertyAssets />;
      case 'inv-dashboard':   return <InvestmentDashboard />;
      case 'inv-discovery':   return <InvestmentDiscovery />;
      case 'inv-assets':        return <InvestmentAssets />;
      case 'inv-transactions': return <InvestmentTransactions />;
      case 'inv-holdings':     return <InvestmentHoldings />;
      case 'inv-contrib':     return <InvestmentContributions />;
      case 'inv-dividends':   return <InvestmentDividends />;
      case 'inv-performance': return <InvestmentPerformance />;
      case 'inv-tax':         return <InvestmentTaxSummary />;
      case 'inv-manage':      return <InvestmentPortfolios />;
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
        <div className="sidebar-accounts" role="button" tabIndex={0} aria-label="View finances" onClick={() => goSection('finances')} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goSection('finances'); } }}>
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

        {/* Page content */}
        <main className="main-content">
          <NavigationProvider value={goTab}>
          <div className="content-wrap">
            {section === 'investments' && <PortfolioBar />}
            {section === 'property'    && <PropertyBar currentTab={tab} onAddProperty={() => { if (tab !== 'prop-register') goTab('prop-register'); setPropNewTrigger(t => t + 1); }} />}
            <div key={animKey} className={`page-anim ${animClass}`}>
              <ErrorBoundary key={tab} label={currentTabs.find(t => t.id === tab)?.label}>
                {section === 'home' ? null : section === 'settings' ? <Settings /> : renderPage()}
              </ErrorBoundary>
            </div>
          </div>
          </NavigationProvider>
        </main>

      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ErrorBoundary label="Application">
        <Shell />
      </ErrorBoundary>
    </ToastProvider>
  );
}
