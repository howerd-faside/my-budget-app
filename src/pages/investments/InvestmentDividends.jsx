import { useState, useMemo } from 'react';
import { useInvestment } from '../../store/hooks';
import Icon from '../../components/Icon';
import Portal from '../../components/Portal';
import { createDividend } from '../../models/Dividend';
import { transactionFromDividend } from '../../models/Transaction';
import { sumTransactions, sumField } from '../../utils/finance/transactions';

function today() { return new Date().toISOString().slice(0, 10); }

const fmt = (n) =>
  `$${Math.abs(+n || 0).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const EMPTY = createDividend({ date: today() });

function DividendModal({ dividend, holdings, onSave, onClose }) {
  const [form, setForm] = useState(dividend ? { ...dividend } : { ...EMPTY });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto-calc net when gross and tax are entered
  const autoNet = (+form.grossAmount || 0) - (+form.taxAmount || 0);
  const canSave = form.date && (+form.grossAmount || 0) > 0;

  return (
    <Portal>
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal wide">
        <div className="modal-header">
          <h3>{dividend?.id ? 'Edit Dividend' : 'Add Dividend'}</h3>
          <button className="btn-icon" onClick={onClose}><Icon name="close" size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label>Date</label>
              <input
                className="input mono" type="date"
                value={form.date} onChange={e => set('date', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Gross Amount ($)</label>
              <input
                className="input mono" type="number" step="0.01" placeholder="0.00"
                value={form.grossAmount} onChange={e => set('grossAmount', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Tax Withheld ($)</label>
              <input
                className="input mono" type="number" step="0.01" placeholder="0.00"
                value={form.taxAmount} onChange={e => set('taxAmount', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Net Amount ($)</label>
              <input
                className="input mono" type="number" step="0.01"
                placeholder={autoNet > 0 ? autoNet.toFixed(2) : '0.00'}
                value={form.netAmount} onChange={e => set('netAmount', e.target.value)}
              />
            </div>
            <div className="form-group full">
              <label>Holding {holdings.length > 0 ? '(optional)' : ''}</label>
              {holdings.length > 0 ? (
                <select className="input" value={form.holdingId} onChange={e => set('holdingId', e.target.value)}>
                  <option value="">— Unlinked / Other —</option>
                  {holdings.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.name}{h.ticker ? ` (${h.ticker})` : ''}{h.platform ? ` · ${h.platform}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input className="input" placeholder="No holdings added yet" disabled value="" />
              )}
            </div>
            <div className="form-group full">
              <label>Platform / Broker</label>
              <input
                className="input" placeholder="e.g. Sharesies, ASB Securities"
                value={form.platform} onChange={e => set('platform', e.target.value)}
              />
            </div>
            <div className="form-group full">
              <label>Notes</label>
              <input
                className="input" placeholder="Optional notes"
                value={form.notes} onChange={e => set('notes', e.target.value)}
              />
            </div>
          </div>
          {form.grossAmount && (
            <div className="calc-preview">
              <span>Gross: <strong>{fmt(form.grossAmount)}</strong></span>
              <span style={{ color: 'var(--red)' }}>Tax: <strong>{form.taxAmount ? fmt(form.taxAmount) : '$0.00'}</strong></span>
              <span style={{ color: 'var(--green)' }}>
                Net: <strong>{form.netAmount ? fmt(form.netAmount) : fmt(autoNet)}</strong>
              </span>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-ghost small" onClick={onClose}>Cancel</button>
          <button className="btn-primary small" disabled={!canSave} onClick={() => {
            // If netAmount blank, auto-fill from gross - tax
            const saved = { ...form };
            if (!saved.netAmount) saved.netAmount = String(autoNet > 0 ? autoNet : +saved.grossAmount || 0);
            onSave(saved);
          }}>
            {dividend?.id ? 'Save Changes' : 'Add Dividend'}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}

export default function InvestmentDividends() {
  const { selectedPortfolioId: pid, investments, investmentDividends, setInvestment } = useInvestment();
  const allDividends  = investmentDividends || [];
  const dividends     = allDividends.filter(d => d.portfolioId === pid);
  const holdings      = (investments || []).filter(h => h.portfolioId === pid);

  const [showModal,  setShowModal]  = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const sorted = useMemo(() =>
    [...dividends].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [dividends],
  );

  const stats = useMemo(() => {
    const txs = dividends.map(transactionFromDividend);
    return {
      totalGross: sumField(txs, 'grossAmount'),
      totalTax:   sumField(txs, 'taxAmount'),
      totalNet:   sumTransactions(txs),
    };
  }, [dividends]);

  const handleSave = (form) => {
    if (form.id) {
      setInvestment('investmentDividends', allDividends.map(d => d.id === form.id ? { ...form } : d));
    } else {
      setInvestment('investmentDividends', [...allDividends, { ...form, id: crypto.randomUUID(), portfolioId: pid, createdAt: today() }]);
    }
    setShowModal(false);
    setEditTarget(null);
  };

  const handleDelete = (id) => {
    if (window.confirm('Remove this dividend record?'))
      setInvestment('investmentDividends', allDividends.filter(d => d.id !== id));
  };

  const openEdit = (d) => { setEditTarget(d); setShowModal(true); };
  const openAdd  = ()  => { setEditTarget(null); setShowModal(true); };

  return (
    <div className="page-content">
      {dividends.length > 0 && (
        <div className="fn-summary">
          <div className="fns-item">
            <span>Gross Total</span>
            <div className="fns-val-row"><span className="mono">{fmt(stats.totalGross)}</span></div>
          </div>
          <div className="fns-item">
            <span>Tax Withheld</span>
            <div className="fns-val-row">
              <span className="mono" style={{ color: 'var(--red)' }}>{fmt(stats.totalTax)}</span>
            </div>
          </div>
          <div className="fns-item">
            <span>Net Received</span>
            <div className="fns-val-row">
              <span className="mono" style={{ color: 'var(--green)' }}>{fmt(stats.totalNet)}</span>
            </div>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="empty-state">
          <div className="es-icon"><Icon name="money" size={38} /></div>
          <div className="es-text">No dividends recorded yet. Log income payments from your investments here.</div>
          <button className="btn-ghost small" onClick={openAdd}>+ Add Dividend</button>
        </div>
      ) : (
        <div className="dash-section">
          <div className="section-header">
            <h3>History</h3>
            <button className="btn-ghost small" onClick={openAdd}>+ Add Dividend</button>
          </div>
          <div className="fn-list">
          {sorted.map(d => {
            const holding = holdings.find(h => h.id === d.holdingId);
            return (
              <div key={d.id} className="fn-row">
                <div className="fn-main" style={{ cursor: 'default' }}>
                  <div className="fn-left">
                    <div className="fn-dates">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="fn-label">
                          {holding ? holding.name : (d.platform || 'Dividend')}
                        </span>
                        <span className="dpill green">Dividend</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{d.date}</span>
                        {d.platform && <span className="tag">{d.platform}</span>}
                        {d.taxAmount && +d.taxAmount > 0 && (
                          <span className="dpill red">Tax {fmt(d.taxAmount)}</span>
                        )}
                      </div>
                      {d.notes && (
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{d.notes}</div>
                      )}
                    </div>
                  </div>
                  <div className="fn-right" style={{ alignItems: 'flex-end', gap: 6 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: 'var(--green)' }}>
                        {fmt(d.netAmount || d.grossAmount)}
                      </div>
                      {d.grossAmount && d.netAmount && +d.grossAmount !== +d.netAmount && (
                        <div className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>
                          gross {fmt(d.grossAmount)}
                        </div>
                      )}
                    </div>
                    <div className="exp-actions">
                      <button className="btn-icon small" onClick={() => openEdit(d)}>
                        <Icon name="pencil" size={12} />
                      </button>
                      <button className="btn-icon small danger" onClick={() => handleDelete(d.id)}>
                        <Icon name="trash" size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {showModal && (
        <DividendModal
          dividend={editTarget}
          holdings={holdings}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
        />
      )}
    </div>
  );
}
