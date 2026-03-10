import { useState, useMemo } from 'react';
import { useApp } from '../../store';
import Icon from '../../components/Icon';

function uid() { return Math.random().toString(36).slice(2, 9); }
function today() { return new Date().toISOString().slice(0, 10); }

const CONTRIB_TYPES = ['Regular', 'Lump Sum', 'KiwiSaver', 'Dividend Reinvestment', 'Other'];

const fmt = (n) =>
  `$${Math.abs(+n || 0).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TYPE_DPILL = {
  'Regular':               'teal',
  'Lump Sum':              'amber',
  'KiwiSaver':             'purple',
  'Dividend Reinvestment': 'green',
  'Other':                 '',
};

const EMPTY = { date: today(), holdingId: '', platform: '', amount: '', type: 'Regular', notes: '' };

function ContribModal({ contrib, holdings, onSave, onClose }) {
  const [form, setForm] = useState(contrib ? { ...contrib } : { ...EMPTY });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto-fill platform from linked holding
  const linkedHolding = holdings.find(h => h.id === form.holdingId);
  const canSave = form.date && (+form.amount || 0) > 0;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal wide">
        <div className="modal-header">
          <h3>{contrib?.id ? 'Edit Contribution' : 'Add Contribution'}</h3>
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
              <label>Type</label>
              <select className="input" value={form.type} onChange={e => set('type', e.target.value)}>
                {CONTRIB_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group full">
              <label>Amount ($)</label>
              <input
                className="input mono" type="number" step="0.01" placeholder="0.00"
                value={form.amount} onChange={e => set('amount', e.target.value)}
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
                <input
                  className="input" placeholder="No holdings added yet"
                  disabled value=""
                />
              )}
            </div>
            <div className="form-group full">
              <label>Platform / Broker</label>
              <input
                className="input"
                placeholder={linkedHolding?.platform || 'e.g. Sharesies, InvestNow'}
                value={form.platform}
                onChange={e => set('platform', e.target.value)}
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
        </div>
        <div className="modal-footer">
          <button className="btn-ghost small" onClick={onClose}>Cancel</button>
          <button className="btn-primary small" disabled={!canSave} onClick={() => onSave(form)}>
            {contrib?.id ? 'Save Changes' : 'Add Contribution'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InvestmentContributions() {
  const { state, set } = useApp();
  const pid                = state.selectedPortfolioId;
  const allContributions   = state.investmentContributions || [];
  const contributions      = allContributions.filter(c => c.portfolioId === pid);
  const holdings           = (state.investments || []).filter(h => h.portfolioId === pid);

  const [showModal,  setShowModal]  = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const sorted = useMemo(() =>
    [...contributions].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [contributions],
  );

  const stats = useMemo(() => {
    const thisYear  = new Date().getFullYear().toString();
    const thisMonth = new Date().toISOString().slice(0, 7);
    return {
      total:     contributions.reduce((s, c) => s + (+c.amount || 0), 0),
      thisYear:  contributions.filter(c => c.date?.startsWith(thisYear)).reduce((s, c) => s + (+c.amount || 0), 0),
      thisMonth: contributions.filter(c => c.date?.startsWith(thisMonth)).reduce((s, c) => s + (+c.amount || 0), 0),
    };
  }, [contributions]);

  const handleSave = (form) => {
    if (form.id) {
      set('investmentContributions', allContributions.map(c => c.id === form.id ? { ...form } : c));
    } else {
      set('investmentContributions', [...allContributions, { ...form, id: uid(), portfolioId: pid, createdAt: today() }]);
    }
    setShowModal(false);
    setEditTarget(null);
  };

  const handleDelete = (id) => {
    if (window.confirm('Remove this contribution?'))
      set('investmentContributions', allContributions.filter(c => c.id !== id));
  };

  const openEdit = (c) => { setEditTarget(c); setShowModal(true); };
  const openAdd  = ()  => { setEditTarget(null); setShowModal(true); };

  return (
    <div className="page-content">
      {contributions.length > 0 && (
        <div className="fn-summary">
          <div className="fns-item">
            <span>All Time</span>
            <div className="fns-val-row"><span className="mono">{fmt(stats.total)}</span></div>
          </div>
          <div className="fns-item">
            <span>This Year</span>
            <div className="fns-val-row"><span className="mono">{fmt(stats.thisYear)}</span></div>
          </div>
          <div className="fns-item">
            <span>This Month</span>
            <div className="fns-val-row"><span className="mono">{fmt(stats.thisMonth)}</span></div>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="empty-state">
          <div className="es-icon"><Icon name="arrow-up" size={38} /></div>
          <div className="es-text">No contributions recorded yet. Log money added to your investments here.</div>
          <button className="btn-ghost small" onClick={openAdd}>+ Add Contribution</button>
        </div>
      ) : (
        <div className="dash-section">
          <div className="section-header">
            <h3>History</h3>
            <button className="btn-ghost small" onClick={openAdd}>+ Add Contribution</button>
          </div>
          <div className="fn-list">
          {sorted.map(c => {
            const holding = holdings.find(h => h.id === c.holdingId);
            const pillColor = TYPE_DPILL[c.type] || '';
            return (
              <div key={c.id} className="fn-row">
                <div className="fn-main" style={{ cursor: 'default' }}>
                  <div className="fn-left">
                    <div className="fn-dates">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="fn-label">
                          {holding ? holding.name : (c.platform || 'Unlinked')}
                        </span>
                        <span className={`dpill ${pillColor}`}>{c.type}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{c.date}</span>
                        {c.platform && !holding && (
                          <span className="tag">{c.platform}</span>
                        )}
                        {holding?.platform && (
                          <span className="tag">{holding.platform}</span>
                        )}
                      </div>
                      {c.notes && (
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{c.notes}</div>
                      )}
                    </div>
                  </div>
                  <div className="fn-right" style={{ alignItems: 'flex-end', gap: 6 }}>
                    <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{fmt(c.amount)}</span>
                    <div className="exp-actions">
                      <button className="btn-icon small" onClick={() => openEdit(c)}>
                        <Icon name="pencil" size={12} />
                      </button>
                      <button className="btn-icon small danger" onClick={() => handleDelete(c.id)}>
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
        <ContribModal
          contrib={editTarget}
          holdings={holdings}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
        />
      )}
    </div>
  );
}
