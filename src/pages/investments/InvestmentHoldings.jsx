import { useState, useMemo, memo, useCallback } from 'react';
import { useInvestment } from '../../store/hooks';
import Icon from '../../components/Icon';
import { SectionHeader, EmptyState, Card, Modal, ConfirmDialog, ExpandableRow } from '../../components/ui';
import { refreshAllPrices } from '../../utils/priceService';
import { useToast } from '../../components/Toast';
import { createHolding, HOLDING_CATEGORIES } from '../../models/Holding';
import { CATEGORY_COLORS } from '../../utils/colors';
import { getHoldingDependents, cascadeDeleteHolding, holdingDeleteMessage } from '../../utils/cascade';
import { validate, holdingSchema } from '../../utils/validation';
import { today } from '../../utils/finance/dates';

const CATEGORIES = HOLDING_CATEGORIES;
const CAT_FILTER  = ['All', ...CATEGORIES];
const CAT_COLOR   = CATEGORY_COLORS;

const fmt = (n) =>
  `$${Math.abs(+n || 0).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const EMPTY = createHolding();

/** Derive total units + weighted avg cost from a tranches array */
function computeTranches(tranches = []) {
  const totalUnits = tranches.reduce((s, t) => s + (+t.units || 0), 0);
  const totalCost  = tranches.reduce((s, t) => s + (+t.units || 0) * (+t.costPerUnit || 0), 0);
  return { totalUnits, totalCost, avgCost: totalUnits > 0 ? totalCost / totalUnits : 0 };
}

/** Initialise modal form from an existing holding or a blank slate */
function initForm(holding) {
  if (!holding) {
    return { ...EMPTY, tranches: [{ id: crypto.randomUUID(), date: today(), units: '', costPerUnit: '' }] };
  }
  // Convert legacy flat fields to a single tranche if no tranches exist
  const tranches = holding.tranches?.length > 0
    ? holding.tranches.map(t => ({ ...t }))
    : [{ id: crypto.randomUUID(), date: holding.createdAt?.slice(0, 10) || today(), units: holding.units || '', costPerUnit: holding.avgCost || '' }];
  return { ...holding, tranches };
}

function timeAgo(isoStr) {
  if (!isoStr) return null;
  const secs = Math.floor((Date.now() - new Date(isoStr)) / 1000);
  if (secs < 60)   return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

// ── Holding row ───────────────────────────────────────────────────────────────

const HoldingRow = memo(function HoldingRow({ holding, onEdit, onDelete }) {
  // Use flat computed fields (written on save) for display
  const units        = +holding.units        || 0;
  const avgCost      = +holding.avgCost      || 0;
  const currentPrice = +holding.currentPrice || 0;
  const totalCost    = units * avgCost;
  const currentValue = units * currentPrice;
  const gl           = currentValue - totalCost;
  const glPct        = totalCost > 0 ? (gl / totalCost * 100) : 0;
  const isGain       = gl >= 0;
  const color        = CAT_COLOR[holding.category] || '#86868B';
  const ago          = timeAgo(holding.priceUpdatedAt);

  const trancheCount = holding.tranches?.length || 0;

  return (
    <ExpandableRow
      summary={
        <div className="fn-main">
          <div className="fn-left">
            <div className="fn-dates">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="fn-label" style={{ fontSize: 13, fontWeight: 500 }}>{holding.name}</span>
                {holding.ticker && (
                  <span className="tag" style={{ fontFamily: 'var(--mono)', letterSpacing: 0 }}>{holding.ticker}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="tag" style={{ color, borderColor: `${color}40`, background: `${color}12` }}>
                  {holding.category}
                </span>
                {holding.platform && <span className="tag">{holding.platform}</span>}
                {trancheCount > 1 && (
                  <span className="tag">{trancheCount} tranches</span>
                )}
                {ago && (
                  <span style={{ fontSize: 10, color: 'var(--text3)' }}>live · {ago}</span>
                )}
              </div>
            </div>
          </div>
          <div className="fn-right" style={{ alignItems: 'flex-end', gap: 6 }}>
            <div style={{ textAlign: 'right' }}>
              <div className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{fmt(currentValue)}</div>
              <div className="mono" style={{ fontSize: 11, color: isGain ? 'var(--green)' : 'var(--red)' }}>
                {isGain ? '+' : '−'}{fmt(gl)} ({isGain ? '+' : ''}{glPct.toFixed(1)}%)
              </div>
            </div>
            <div className="exp-actions">
              <button className="btn-icon small" onClick={e => { e.stopPropagation(); onEdit(holding); }} aria-label="Edit holding">
                <Icon name="pencil" size={12} />
              </button>
              <button className="btn-icon small danger" onClick={e => { e.stopPropagation(); onDelete(holding.id); }} aria-label="Delete holding">
                <Icon name="trash" size={12} />
              </button>
            </div>
          </div>
        </div>
      }
    >
      <div className="exp-detail" style={{ paddingBottom: 12 }} onClick={e => e.stopPropagation()}>
        <div className="exp-detail-grid">
          <div className="edg-item">
            <span className="edg-label">Total Units</span>
            <span className="edg-val mono">{units.toLocaleString('en-NZ', { maximumFractionDigits: 6 })}</span>
          </div>
          <div className="edg-item">
            <span className="edg-label">Avg Cost / unit</span>
            <span className="edg-val mono">{fmt(avgCost)}</span>
          </div>
          <div className="edg-item">
            <span className="edg-label">Current Price</span>
            <span className="edg-val mono">{fmt(currentPrice)}</span>
          </div>
          <div className="edg-item">
            <span className="edg-label">Total Cost Basis</span>
            <span className="edg-val mono">{fmt(totalCost)}</span>
          </div>
        </div>
        {holding.tranches?.length > 1 && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--sep)' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Purchase Tranches
            </div>
            {holding.tranches.map((t, i) => (
              <div key={t.id} style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text2)', marginBottom: 3 }}>
                <span style={{ color: 'var(--text3)', minWidth: 90 }}>{t.date || '—'}</span>
                <span className="mono">{(+t.units || 0).toLocaleString('en-NZ', { maximumFractionDigits: 4 })} units</span>
                <span className="mono">@ {fmt(t.costPerUnit)}</span>
                <span className="mono" style={{ color: 'var(--text3)' }}>{fmt((+t.units || 0) * (+t.costPerUnit || 0))}</span>
              </div>
            ))}
          </div>
        )}
        {holding.notes && (
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--sep)' }}>
            {holding.notes}
          </div>
        )}
      </div>
    </ExpandableRow>
  );
});

// ── Holding modal ─────────────────────────────────────────────────────────────

function HoldingModal({ holding, onSave, onClose }) {
  const [form, setForm] = useState(() => initForm(holding));
  const [errors, setErrors] = useState({});
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const setTranche = (id, k, v) =>
    setForm(f => ({ ...f, tranches: f.tranches.map(t => t.id === id ? { ...t, [k]: v } : t) }));
  const addTranche = () =>
    setForm(f => ({ ...f, tranches: [...f.tranches, { id: crypto.randomUUID(), date: today(), units: '', costPerUnit: '' }] }));
  const removeTranche = (id) =>
    setForm(f => ({ ...f, tranches: f.tranches.filter(t => t.id !== id) }));

  const { totalUnits, totalCost, avgCost } = computeTranches(form.tranches);
  const currentValue = totalUnits * (+form.currentPrice || 0);
  const gl           = currentValue - totalCost;

  const handleSave = () => {
    const { ok, errors: errs } = validate(holdingSchema, form);
    if (!ok) { setErrors(errs); return; }
    setErrors({});
    onSave(form);
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      wide
      title={holding?.id ? 'Edit Holding' : 'Add Holding'}
      bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
      footer={
        <>
          <button className="btn-ghost small" onClick={onClose}>Cancel</button>
          <button className="btn-primary small" onClick={handleSave}>
            {holding?.id ? 'Save Changes' : 'Add Holding'}
          </button>
        </>
      }
    >

          {/* Asset details */}
          <div className="form-grid">
            <div className="form-group full">
              <label>Asset Name</label>
              <input className={`input${errors.name ? ' input-error' : ''}`} placeholder="e.g. Apple Inc"
                value={form.name} onChange={e => setField('name', e.target.value)} />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>
            <div className="form-group">
              <label>Ticker / Code</label>
              <input className="input mono" placeholder="AAPL"
                value={form.ticker} onChange={e => setField('ticker', e.target.value.toUpperCase())} />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select className="input" value={form.category} onChange={e => setField('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group full">
              <label>Platform / Broker</label>
              <input className="input" placeholder="e.g. Sharesies, Hatch, Coinbase"
                value={form.platform} onChange={e => setField('platform', e.target.value)} />
            </div>
            <div className="form-group full">
              <label>Current Price per Unit (USD)</label>
              <input className={`input mono${errors.currentPrice ? ' input-error' : ''}`} type="number" step="0.0001" placeholder="0.00"
                value={form.currentPrice} onChange={e => setField('currentPrice', e.target.value)} />
              {errors.currentPrice && <span className="field-error">{errors.currentPrice}</span>}
            </div>
          </div>

          {/* Tranches */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)' }}>Purchases</span>
              <button className="btn-ghost small" onClick={addTranche}>+ Add Tranche</button>
            </div>

            {/* Header row */}
            <div className="tranche-grid tranche-header">
              <span>Date</span>
              <span>Units</span>
              <span>Cost / Unit (USD)</span>
              <span>Total</span>
              <span />
            </div>

            {form.tranches.map((t, idx) => {
              const lineTotal  = (+t.units || 0) * (+t.costPerUnit || 0);
              const errUnits   = errors[`tranches.${idx}.units`];
              const errCost    = errors[`tranches.${idx}.costPerUnit`];
              return (
                <div key={t.id}>
                  <div className="tranche-grid">
                    <input className="input mono" type="date"
                      value={t.date} onChange={e => setTranche(t.id, 'date', e.target.value)} />
                    <input className={`input mono${errUnits ? ' input-error' : ''}`} type="number" step="0.000001" placeholder="0"
                      value={t.units} onChange={e => setTranche(t.id, 'units', e.target.value)} />
                    <input className={`input mono${errCost ? ' input-error' : ''}`} type="number" step="0.0001" placeholder="0.00"
                      value={t.costPerUnit} onChange={e => setTranche(t.id, 'costPerUnit', e.target.value)} />
                    <span className="mono tranche-total">{lineTotal > 0 ? fmt(lineTotal) : '—'}</span>
                    <button className="btn-icon small danger" disabled={form.tranches.length === 1}
                      onClick={() => removeTranche(t.id)} aria-label="Remove tranche">
                      <Icon name="close" size={10} />
                    </button>
                  </div>
                  {errUnits && <span className="field-error" style={{ paddingLeft: 2 }}>{errUnits}</span>}
                  {errCost  && !errUnits && <span className="field-error" style={{ paddingLeft: 2 }}>{errCost}</span>}
                </div>
              );
            })}

            {/* Summary */}
            {totalUnits > 0 && (
              <div className="tranche-summary">
                <span>{totalUnits.toLocaleString('en-NZ', { maximumFractionDigits: 6 })} units</span>
                <span>Avg {fmt(avgCost)}</span>
                <span style={{ fontWeight: 600 }}>Cost basis {fmt(totalCost)}</span>
                {form.currentPrice && (
                  <span style={{ color: gl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {gl >= 0 ? '+' : '−'}{fmt(Math.abs(gl))} G/L
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="form-group full" style={{ marginTop: 16 }}>
            <label>Notes</label>
            <input className="input" placeholder="Optional notes"
              value={form.notes} onChange={e => setField('notes', e.target.value)} />
          </div>

    </Modal>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InvestmentHoldings() {
  const { selectedPortfolioId: pid, investments, investmentContributions, investmentDividends, setInvestment, mergeInvestment } = useInvestment();
  const holdings = (investments || []).filter(h => h.portfolioId === pid);

  const toast = useToast();
  const [catFilter,  setCatFilter]  = useState('All');
  const [showModal,  setShowModal]  = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState(null);

  const filtered = useMemo(() =>
    catFilter === 'All' ? holdings : holdings.filter(h => h.category === catFilter),
    [holdings, catFilter],
  );

  const tickerCount = holdings.filter(h => h.ticker?.trim()).length;

  const handleRefresh = async () => {
    if (refreshing || tickerCount === 0) return;
    setRefreshing(true);
    setRefreshMsg(null);
    try {
      const { updated, failed } = await refreshAllPrices(holdings);
      if (updated.length > 0) {
        const updMap = Object.fromEntries(updated.map(u => [u.id, u]));
        setInvestment('investments', allHoldings.map(h =>
          updMap[h.id]
            ? { ...h, currentPrice: String(updMap[h.id].price), priceUpdatedAt: updMap[h.id].priceUpdatedAt }
            : h
        ));
      }
      setRefreshMsg({ updated: updated.length, failedTickers: failed.map(f => f.ticker) });
      if (failed.length > 0) {
        toast(`Could not update: ${failed.map(f => f.ticker).join(', ')}`, 'error');
      }
    } catch (e) {
      const failedTickers = holdings.filter(h => h.ticker).map(h => h.ticker);
      setRefreshMsg({ updated: 0, failedTickers });
      toast(`Price refresh failed — ${e?.message || 'check your connection'}`, 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const allHoldings = investments || [];

  const handleSave = (form) => {
    const { totalUnits, totalCost, avgCost } = computeTranches(form.tranches);
    const toSave = { ...form, units: String(totalUnits), avgCost: String(avgCost) };
    if (form.id) {
      setInvestment('investments', allHoldings.map(h => h.id === form.id ? toSave : h));
    } else {
      setInvestment('investments', [...allHoldings, { ...toSave, id: crypto.randomUUID(), portfolioId: pid, createdAt: today() }]);
    }
    setShowModal(false);
    setEditTarget(null);
  };

  const handleDelete = useCallback((id) => {
    const holding = allHoldings.find(h => h.id === id);
    if (!holding) return;
    const invState = { investments, investmentContributions, investmentDividends };
    const deps = getHoldingDependents(invState, id);
    setConfirmTarget({ id, message: holdingDeleteMessage(holding.name, deps), invState });
  }, [allHoldings, investments, investmentContributions, investmentDividends]);

  const executeDelete = () => {
    if (confirmTarget) mergeInvestment(cascadeDeleteHolding(confirmTarget.invState, confirmTarget.id));
    setConfirmTarget(null);
  };

  const openEdit = useCallback((h) => { setEditTarget(h); setShowModal(true); }, []);
  const openAdd  = ()  => { setEditTarget(null); setShowModal(true); };

  return (
    <div className="page-content">
      {holdings.length > 0 && (
        <Card variant="section">
          <SectionHeader
            title={<><Icon name="filter" size={15} /> Filter by Category</>}
            actions={
              <>
                {refreshMsg && (
                  <span
                    style={{ fontSize: 11, color: refreshMsg.failedTickers?.length > 0 ? 'var(--red)' : 'var(--green)' }}
                    title={refreshMsg.failedTickers?.length > 0 ? `Failed: ${refreshMsg.failedTickers.join(', ')}` : undefined}
                  >
                    {refreshMsg.updated > 0 && `↑ ${refreshMsg.updated} updated`}
                    {refreshMsg.failedTickers?.length > 0 && ` · ${refreshMsg.failedTickers.join(', ')} failed`}
                  </span>
                )}
                {tickerCount > 0 && (
                  <button className="btn-ghost small" onClick={handleRefresh} disabled={refreshing} style={{ minWidth: 110 }}>
                    {refreshing ? 'Refreshing…' : '↻ Refresh Prices'}
                  </button>
                )}
                <button className="btn-ghost small" onClick={openAdd}>+ Add Holding</button>
              </>
            }
          />
          <div className="filter-tabs">
            {CAT_FILTER.map(c => (
              <button key={c} className={`filter-tab ${catFilter === c ? 'active' : ''}`} onClick={() => setCatFilter(c)}>
                {c}
              </button>
            ))}
          </div>
        </Card>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Icon name="trend" size={38} />}
          title={holdings.length === 0 ? 'No holdings yet. Add your first investment to start tracking.' : 'No holdings in this category.'}
          action={holdings.length === 0 && <button className="btn-ghost small" onClick={openAdd}>+ Add Holding</button>}
        />
      ) : (
        <div className="fn-list">
          {filtered.map(h => (
            <HoldingRow key={h.id} holding={h} onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {showModal && (
        <HoldingModal
          holding={editTarget}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
        />
      )}

      <ConfirmDialog
        open={!!confirmTarget}
        title="Delete holding"
        message={confirmTarget?.message || ''}
        onConfirm={executeDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
