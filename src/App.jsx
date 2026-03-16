import { useState, useRef } from 'react';
import './utils/theme'; // init theme before first render
import { totalBalance } from './utils/finance/savings';
import { useFinance, useFortnightSettlement } from './store/hooks';
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
import InvestmentAssets from './pages/investments/InvestmentAssets';
import InvestmentActivity from './pages/investments/InvestmentActivity';
import InvestmentPerformance from './pages/investments/InvestmentPerformance';
import InvestmentTaxSummary from './pages/investments/InvestmentTaxSummary';
import InvestmentPortfolios from './pages/investments/InvestmentPortfolios';
import InvestmentDiscovery from './pages/investments/InvestmentDiscovery';
import PortfolioStrip from './components/investments/PortfolioStrip';
import PropertyStrip from './components/property/PropertyStrip';
import Home from './pages/Home';
import Settings from './pages/Settings';
import Icon from './components/Icon';
import fasideLogo from './assets/faside-logo.png';
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
    { id: 'inv-activity',     label: 'Activity'       },
    { id: 'inv-performance', label: 'Performance'   },
    { id: 'inv-tax',         label: 'Reports'       },
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

function Shell() {
  // Auto-settle completed fortnights into the main account on mount.
  useFortnightSettlement();

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

  /** Cross-section + tab navigation (used by Home drill-downs). */
  const navigateTo = (targetSection, targetTab) => {
    setSection(targetSection);
    setTab(targetTab || SECTION_DEFAULT[targetSection] || '');
    setSlideDir(0);
    setAnimKey(k => k + 1);
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
      case 'inv-activity':     return <InvestmentActivity />;
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
            {section === 'investments' && <PortfolioStrip />}
            {section === 'property'    && <PropertyStrip currentTab={tab} onAddProperty={() => { if (tab !== 'prop-register') goTab('prop-register'); setPropNewTrigger(t => t + 1); }} />}
            <div key={animKey} className={`page-anim ${animClass}`}>
              <ErrorBoundary key={tab} label={currentTabs.find(t => t.id === tab)?.label}>
                {section === 'home' ? <Home navigateTo={navigateTo} /> : section === 'settings' ? <Settings /> : renderPage()}
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
