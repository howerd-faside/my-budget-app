import { useState, useMemo } from 'react';
import { useInvestment } from '../../store/hooks';
import Icon from '../../components/Icon';
import { SectionHeader, StatTile, EmptyState, Card, Modal } from '../../components/ui';
import { createInvestmentContribution, CONTRIBUTION_TYPES, CONTRIBUTION_TYPE_PILL } from '../../models/InvestmentContribution';
import { transactionFromContribution } from '../../models/Transaction';
import { filterByYear, filterByYearMonth, sumTransactions } from '../../utils/finance/transactions';

function today() { return new Date().toISOString().slice(0, 10); }

const CONTRIB_TYPES = CONTRIBUTION_TYPES;
const TYPE_DPILL    = CONTRIBUTION_TYPE_PILL;

const fmt = (n) =>
  `$${Math.abs(+n || 0).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const EMPTY = createInvestmentContribution({ date: today() });

function ContribModal({ contrib, holdings, onSave, onClose }) {
  const [form, setForm] = useState(contrib ? { ...contrib } : { ...EMPTY });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto-fill platform from linked holding
  const linkedHolding = holdings.find(h => h.id === form.holdingId);
  const canSave = form.date && (+form.amount || 0) > 0;

  return (
    <Modal
      isOpen
      onClose={onClose}
      wide
      title={contrib?.id ? 'Edit Contribution' : 'Add Contribution'}
      footer={
        <>
          <button className="btn-ghost small" onClick={onClose}>Cancel</button>
          <button className="btn-primary small" disabled={!canSave} onClick={() => onSave(form)}>
            {contrib?.id ? 'Save Changes' : 'Add Contribution'}
          </button>
        </>
      }
    >
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
    </Modal>
  );
}

export default function InvestmentContributions() {
  const { selectedPortfolioId: pid, investments, investmentContributions, setInvestment } = useInvestment();
  const allContributions   = investmentContributions || [];
  const contributions      = allContributions.filter(c => c.portfolioId === pid);
  const holdings           = (investments || []).filter(h => h.portfolioId === pid);

  const [showModal,  setShowModal]  = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const sorted = useMemo(() =>
    [...contributions].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [contributions],
  );

  const stats = useMemo(() => {
    const thisYear  = new Date().getFullYear().toString();
    const thisMonth = new Date().toISOString().slice(0, 7);
    const txs = contributions.map(transactionFromContribution);
    return {
      total:     sumTransactions(txs),
      thisYear:  sumTransactions(filterByYear(txs, thisYear)),
      thisMonth: sumTransactions(filterByYearMonth(txs, thisMonth)),
    };
  }, [contributions]);

  const handleSave = (form) => {
    if (form.id) {
      setInvestment('investmentContributions', allContributions.map(c => c.id === form.id ? { ...form } : c));
    } else {
      setInvestment('investmentContributions', [...allContributions, { ...form, id: crypto.randomUUID(), portfolioId: pid, createdAt: today() }]);
    }
    setShowModal(false);
    setEditTarget(null);
  };

  const handleDelete = (id) => {
    if (window.confirm('Remove this contribution?'))
      setInvestment('investmentContributions', allContributions.filter(c => c.id !== id));
  };

  const openEdit = (c) => { setEditTarget(c); setShowModal(true); };
  const openAdd  = ()  => { setEditTarget(null); setShowModal(true); };

  return (
    <div className="page-content">
      {contributions.length > 0 && (
        <div className="fn-summary">
          <StatTile label="All Time"   value={fmt(stats.total)} />
          <StatTile label="This Year"  value={fmt(stats.thisYear)} />
          <StatTile label="This Month" value={fmt(stats.thisMonth)} />
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState
          icon={<Icon name="arrow-up" size={38} />}
          title="No contributions recorded yet. Log money added to your investments here."
          action={<button className="btn-ghost small" onClick={openAdd}>+ Add Contribution</button>}
        />
      ) : (
        <Card variant="section">
          <SectionHeader
            title="History"
            actions={<button className="btn-ghost small" onClick={openAdd}>+ Add Contribution</button>}
          />
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
        </Card>
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
