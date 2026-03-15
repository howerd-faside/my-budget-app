/**
 * PortfolioStrip — compact persistent header for the Investments section.
 *
 * Replaces the old full-card PortfolioBar with a slim strip showing:
 *   • selected portfolio name + dropdown switcher
 *   • meta summary (asset count, portfolio value)
 *   • quick-create and manage actions
 *
 * Rendered between the tab bar and page content in App.jsx.
 */
import { useState, useRef, useEffect } from 'react';
import { useInvestment, usePortfolioAnalytics } from '../../store/hooks';
import { useNavigate } from '../../contexts/NavigationContext';
import { today } from '../../utils/finance/dates';
import { fmtCurrency as fmt } from '../../utils/format';
import Icon from '../Icon';

export default function PortfolioStrip() {
  const {
    investmentPortfolios,
    selectedPortfolioId,
    investmentAssets,
    setInvestment,
  } = useInvestment();

  const { assets, overview } = usePortfolioAnalytics();
  const goTab = useNavigate();

  const portfolios = (investmentPortfolios || []).filter(p => !p.archived);
  const selected = portfolios.find(p => p.id === selectedPortfolioId);

  // ── Dropdown state ──────────────────────────────────────────────────────

  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // ── Inline create state ─────────────────────────────────────────────────

  const [creating, setCreating] = useState(false);
  const [newName, setNewName]   = useState('');
  const createRef = useRef(null);

  const startCreate = () => {
    setCreating(true);
    setNewName('');
    setOpen(true);
    setTimeout(() => createRef.current?.focus(), 0);
  };

  const confirmCreate = () => {
    const name = newName.trim();
    if (!name) { setCreating(false); return; }
    const id = crypto.randomUUID();
    const allPortfolios = investmentPortfolios || [];
    setInvestment('investmentPortfolios', [
      ...allPortfolios,
      { id, name, currency: 'NZD', costBasisMethod: 'average', archived: false, createdAt: today() },
    ]);
    setInvestment('selectedPortfolioId', id);
    setCreating(false);
    setOpen(false);
  };

  const cancelCreate = () => {
    setCreating(false);
  };

  // ── Helpers ─────────────────────────────────────────────────────────────

  const selectPortfolio = (id) => {
    setInvestment('selectedPortfolioId', id);
    setOpen(false);
  };

  const assetCountFor = (portfolioId) =>
    (investmentAssets || []).filter(a => a.portfolioId === portfolioId).length;

  // ── Empty state ─────────────────────────────────────────────────────────

  if (portfolios.length === 0 && !creating) {
    return (
      <div className="portfolio-strip">
        <div className="ps-trigger-wrap">
          <span className="ps-empty-label">
            <Icon name="layers" size={14} />
            No portfolio
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <div className="ps-actions">
          <button className="btn-ghost small" onClick={startCreate}>+ New Portfolio</button>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="portfolio-strip" ref={wrapRef}>

      {/* Trigger */}
      <button
        className="ps-trigger"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Icon name="layers" size={14} />
        <span className="ps-name">{selected?.name || 'Select portfolio'}</span>
        <Icon name="chevronD" size={10} />
      </button>

      {/* Meta summary */}
      <div className="ps-meta">
        <span className="tag sm">{assets.length} {assets.length === 1 ? 'asset' : 'assets'}</span>
        {overview.totalValue > 0 && (
          <span className="tag sm mono">{fmt(overview.totalValue)}</span>
        )}
      </div>

      {/* Actions */}
      <div className="ps-actions">
        <button className="btn-ghost small" onClick={startCreate}>+ New</button>
        <button
          className="btn-icon small"
          title="Manage portfolios"
          onClick={() => goTab('inv-manage')}
        >
          <Icon name="settings" size={14} />
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="ps-dropdown" role="listbox" aria-label="Portfolio list">
          {portfolios.map(p => {
            const isSel = p.id === selectedPortfolioId;
            const count = assetCountFor(p.id);
            return (
              <button
                key={p.id}
                className={`ps-dropdown-item${isSel ? ' active' : ''}`}
                role="option"
                aria-selected={isSel}
                onClick={() => selectPortfolio(p.id)}
              >
                <span className="ps-dd-name">{p.name}</span>
                <span className="ps-dd-right">
                  {isSel && <Icon name="check" size={12} />}
                  <span className="tag sm">{count}a</span>
                </span>
              </button>
            );
          })}

          {creating && (
            <div className="ps-dropdown-item ps-creating">
              <input
                ref={createRef}
                className="ps-create-input"
                placeholder="Portfolio name…"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onBlur={confirmCreate}
                onKeyDown={e => {
                  if (e.key === 'Enter') confirmCreate();
                  if (e.key === 'Escape') cancelCreate();
                }}
              />
            </div>
          )}

          <div className="ps-dropdown-divider" />

          <button
            className="ps-dropdown-item ps-manage-link"
            onClick={() => { setOpen(false); goTab('inv-manage'); }}
          >
            Manage Portfolios…
          </button>
        </div>
      )}
    </div>
  );
}
