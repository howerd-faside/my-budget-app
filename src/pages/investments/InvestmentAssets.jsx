import { useState, useMemo, memo, useCallback } from 'react';
import { usePortfolioAnalytics, useInvestment } from '../../store/hooks';
import Icon from '../../components/Icon';
import { SectionHeader, EmptyState, Card, Modal, ConfirmDialog, ExpandableRow } from '../../components/ui';
import AssetDetail from './AssetDetail';
import { createAsset, ASSET_CATEGORIES } from '../../models/Asset';
import { INV_TX_TYPE_PILL } from '../../models/InvestmentTransaction';
import { CATEGORY_COLORS } from '../../utils/colors';
import {
  getInvestmentAssetDependents,
  cascadeDeleteInvestmentAsset,
  investmentAssetDeleteMessage,
} from '../../utils/cascade';
import { validate, assetSchema } from '../../utils/validation';
import { today } from '../../utils/finance/dates';
import { fmtCurrency as fmt } from '../../utils/format';

const CATEGORIES = ASSET_CATEGORIES;
const CAT_FILTER = ['All', ...CATEGORIES];
const CAT_COLOR  = CATEGORY_COLORS;

const EMPTY = createAsset();

// ── Asset row ────────────────────────────────────────────────────────────────

const AssetRow = memo(function AssetRow({ enriched, transactions, onEdit, onDelete, onSelect }) {
  const { asset, position, currentPrice, currentValue, unrealisedGL, unrealisedGLPct } = enriched;
  const isGain = unrealisedGL >= 0;
  const color  = CAT_COLOR[asset.category] || '#86868B';

  // Recent transactions for this asset (most recent 5)
  const recentTxs = useMemo(() =>
    transactions
      .filter(t => t.assetId === asset.id && t.date)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5),
    [transactions, asset.id],
  );

  return (
    <ExpandableRow
      summary={
        <div className="fn-main">
          <div className="fn-left">
            <div className="fn-dates">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="fn-label" style={{ fontSize: 13, fontWeight: 500 }}>{asset.name}</span>
                {asset.ticker && (
                  <span className="tag" style={{ fontFamily: 'var(--mono)', letterSpacing: 0 }}>{asset.ticker}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="tag" style={{ color, borderColor: `${color}40`, background: `${color}12` }}>
                  {asset.category}
                </span>
                {asset.platform && <span className="tag">{asset.platform}</span>}
              </div>
            </div>
          </div>
          <div className="fn-right" style={{ alignItems: 'flex-end', gap: 6 }}>
            <div style={{ textAlign: 'right' }}>
              <div className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{fmt(currentValue)}</div>
              {position.units > 0 && (
                <div className="mono" style={{ fontSize: 11, color: isGain ? 'var(--green)' : 'var(--red)' }}>
                  {isGain ? '+' : '−'}{fmt(unrealisedGL)} ({isGain ? '+' : ''}{unrealisedGLPct.toFixed(1)}%)
                </div>
              )}
            </div>
          </div>
        </div>
      }
    >
      <div className="exp-detail" style={{ paddingBottom: 12 }} onClick={e => e.stopPropagation()}>
        <div className="exp-detail-grid">
          <div className="edg-item">
            <span className="edg-label">Units</span>
            <span className="edg-val mono">{position.units.toLocaleString('en-NZ', { maximumFractionDigits: 6 })}</span>
          </div>
          <div className="edg-item">
            <span className="edg-label">Avg Cost</span>
            <span className="edg-val mono">{fmt(position.avgCost)}</span>
          </div>
          <div className="edg-item">
            <span className="edg-label">Current Price</span>
            <span className="edg-val mono">{fmt(currentPrice)}</span>
          </div>
          <div className="edg-item">
            <span className="edg-label">Cost Basis</span>
            <span className="edg-val mono">{fmt(position.totalCost)}</span>
          </div>
          <div className="edg-item">
            <span className="edg-label">Market Value</span>
            <span className="edg-val mono">{fmt(currentValue)}</span>
          </div>
          <div className="edg-item">
            <span className="edg-label">Unrealised G/L</span>
            <span className={`edg-val mono ${isGain ? 'green' : 'red'}`}>
              {isGain ? '+' : '−'}{fmt(unrealisedGL)}
            </span>
          </div>
          {position.realisedGL !== 0 && (
            <div className="edg-item">
              <span className="edg-label">Realised G/L</span>
              <span className={`edg-val mono ${position.realisedGL >= 0 ? 'green' : 'red'}`}>
                {position.realisedGL >= 0 ? '+' : '−'}{fmt(position.realisedGL)}
              </span>
            </div>
          )}
        </div>

        {recentTxs.length > 0 && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--sep)' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Recent Transactions
            </div>
            {recentTxs.map(tx => (
              <div key={tx.id} style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text2)', marginBottom: 3, alignItems: 'center' }}>
                <span style={{ color: 'var(--text3)', minWidth: 80 }}>{tx.date}</span>
                <span className={`dpill ${INV_TX_TYPE_PILL[tx.type] || ''}`} style={{ fontSize: 10 }}>{tx.type}</span>
                {tx.units != null && (
                  <span className="mono">{tx.units.toLocaleString('en-NZ', { maximumFractionDigits: 4 })} units</span>
                )}
                <span className="mono" style={{ marginLeft: 'auto' }}>{fmt(tx.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {asset.notes && (
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--sep)' }}>
            {asset.notes}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--sep)' }}>
          <button className="btn-ghost small" onClick={() => onSelect(asset.id)} aria-label="View asset detail">
            View Detail
          </button>
          <button className="btn-ghost small" onClick={() => onEdit(asset)} aria-label="Edit asset">
            <Icon name="pencil" size={12} /> Edit
          </button>
          <button className="btn-ghost small danger" onClick={() => onDelete(asset.id)} aria-label="Delete asset">
            <Icon name="trash" size={12} /> Delete
          </button>
        </div>
      </div>
    </ExpandableRow>
  );
});

// ── Asset modal ──────────────────────────────────────────────────────────────

function AssetModal({ asset, onSave, onClose }) {
  const [form, setForm] = useState(() => asset ? { ...asset } : { ...EMPTY });
  const [errors, setErrors] = useState({});
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    const { ok, errors: errs } = validate(assetSchema, form);
    if (!ok) { setErrors(errs); return; }
    setErrors({});
    onSave(form);
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={asset?.id ? 'Edit Asset' : 'Add Asset'}
      bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
      footer={
        <>
          <button className="btn-ghost small" onClick={onClose}>Cancel</button>
          <button className="btn-primary small" onClick={handleSave}>
            {asset?.id ? 'Save Changes' : 'Add Asset'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="form-group full">
          <label>Asset Name</label>
          <input className={`input${errors.name ? ' input-error' : ''}`} placeholder="e.g. Vanguard Total World ETF"
            value={form.name} onChange={e => setField('name', e.target.value)} />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </div>
        <div className="form-group">
          <label>Ticker / Code</label>
          <input className="input mono" placeholder="VT"
            value={form.ticker} onChange={e => setField('ticker', e.target.value.toUpperCase())} />
        </div>
        <div className="form-group">
          <label>Category</label>
          <select className="input" value={form.category} onChange={e => setField('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Platform / Broker</label>
          <input className="input" placeholder="e.g. Sharesies, Hatch"
            value={form.platform} onChange={e => setField('platform', e.target.value)} />
        </div>
        <div className="form-group">
          <label>Currency</label>
          <input className="input mono" placeholder="NZD"
            value={form.currency} onChange={e => setField('currency', e.target.value.toUpperCase())} />
        </div>
        <div className="form-group full">
          <label>Notes</label>
          <input className="input" placeholder="Optional notes"
            value={form.notes} onChange={e => setField('notes', e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function InvestmentAssets() {
  const {
    investmentAssets, investmentTransactions, priceCache,
    setInvestment, mergeInvestment,
  } = useInvestment();
  const { assets, enrichedAssets, transactions } = usePortfolioAnalytics();

  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const [catFilter,  setCatFilter]  = useState('All');
  const [platFilter, setPlatFilter] = useState('All');
  const [search,     setSearch]     = useState('');
  const [showModal,  setShowModal]  = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);

  // Distinct platforms for the filter dropdown
  const platforms = useMemo(() => {
    const set = new Set(assets.map(a => a.platform).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [assets]);

  // Apply filters
  const filtered = useMemo(() => {
    let list = enrichedAssets;
    if (catFilter !== 'All')  list = list.filter(ea => ea.asset.category === catFilter);
    if (platFilter !== 'All') list = list.filter(ea => ea.asset.platform === platFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(ea =>
        ea.asset.name.toLowerCase().includes(q) ||
        ea.asset.ticker.toLowerCase().includes(q)
      );
    }
    return list;
  }, [enrichedAssets, catFilter, platFilter, search]);

  const hasActiveFilters = catFilter !== 'All' || platFilter !== 'All' || search.trim() !== '';

  // ── CRUD handlers ────────────────────────────────────────────────────────

  const allAssets = investmentAssets || [];

  const handleSave = (form) => {
    if (form.id) {
      // Update
      setInvestment('investmentAssets', allAssets.map(a => a.id === form.id ? { ...form } : a));
    } else {
      // Create
      const pid = assets.length > 0 ? assets[0].portfolioId : '';
      setInvestment('investmentAssets', [
        ...allAssets,
        { ...form, id: crypto.randomUUID(), portfolioId: pid, createdAt: today() },
      ]);
    }
    setShowModal(false);
    setEditTarget(null);
  };

  const handleDelete = useCallback((id) => {
    const asset = allAssets.find(a => a.id === id);
    if (!asset) return;
    const deps = getInvestmentAssetDependents(
      { investmentTransactions, priceCache },
      id,
    );
    setConfirmTarget({
      id,
      message: investmentAssetDeleteMessage(asset.name, deps),
      state: { investmentAssets, investmentTransactions, priceCache },
    });
  }, [allAssets, investmentAssets, investmentTransactions, priceCache]);

  const executeDelete = () => {
    if (confirmTarget) {
      mergeInvestment(cascadeDeleteInvestmentAsset(confirmTarget.state, confirmTarget.id));
    }
    setConfirmTarget(null);
  };

  const openEdit = useCallback((asset) => { setEditTarget(asset); setShowModal(true); }, []);
  const openAdd  = () => { setEditTarget(null); setShowModal(true); };

  const clearFilters = () => { setCatFilter('All'); setPlatFilter('All'); setSearch(''); };

  // ── Render ─────────────────────────────────────────────────────────────────

  // Detail view
  if (selectedAssetId) {
    return <AssetDetail assetId={selectedAssetId} onBack={() => setSelectedAssetId(null)} />;
  }

  return (
    <div className="page-content">

      {/* Filter bar */}
      {assets.length > 0 && (
        <Card variant="section">
          <SectionHeader
            title={<><Icon name="filter" size={15} /> Filters</>}
            actions={<button className="btn-ghost small" onClick={openAdd}>+ Add Asset</button>}
          />

          {/* Category tabs */}
          <div className="filter-tabs">
            {CAT_FILTER.map(c => (
              <button key={c} className={`filter-tab ${catFilter === c ? 'active' : ''}`} onClick={() => setCatFilter(c)}>
                {c}
              </button>
            ))}
          </div>

          {/* Platform + Search row */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {platforms.length > 2 && (
              <select
                className="input"
                style={{ maxWidth: 180, fontSize: 12 }}
                value={platFilter}
                onChange={e => setPlatFilter(e.target.value)}
              >
                {platforms.map(p => (
                  <option key={p} value={p}>{p === 'All' ? 'All Platforms' : p}</option>
                ))}
              </select>
            )}
            <input
              className="input"
              style={{ maxWidth: 220, fontSize: 12 }}
              placeholder="Search name or ticker…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {hasActiveFilters && (
              <button className="btn-ghost small" onClick={clearFilters}>Clear</button>
            )}
          </div>
        </Card>
      )}

      {/* Asset list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Icon name="trend" size={38} />}
          title={
            assets.length === 0
              ? 'No assets yet. Add your first investment asset.'
              : 'No assets match your filters.'
          }
          action={assets.length === 0 && <button className="btn-ghost small" onClick={openAdd}>+ Add Asset</button>}
        />
      ) : (
        <div className="fn-list">
          {filtered.map(ea => (
            <AssetRow
              key={ea.asset.id}
              enriched={ea}
              transactions={transactions}
              onEdit={openEdit}
              onDelete={handleDelete}
              onSelect={setSelectedAssetId}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <AssetModal
          asset={editTarget}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
        />
      )}

      {/* Confirm delete */}
      <ConfirmDialog
        open={!!confirmTarget}
        title="Delete asset"
        message={confirmTarget?.message || ''}
        onConfirm={executeDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
