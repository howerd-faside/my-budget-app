import { useState, useMemo } from 'react';
import { useInvestment } from '../../store/hooks';
import Icon from '../../components/Icon';
import { SectionHeader, StatTile, EmptyState, Card, Modal, ConfirmDialog } from '../../components/ui';
import { createDividend } from '../../models/Dividend';
import { transactionFromDividend } from '../../models/Transaction';
import { sumTransactions, sumField } from '../../utils/finance/transactions';
import { today } from '../../utils/finance/dates';

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
    <Modal
      isOpen
      onClose={onClose}
      wide
      title={dividend?.id ? 'Edit Dividend' : 'Add Dividend'}
      footer={
        <>
          <button className="btn-ghost small" onClick={onClose}>Cancel</button>
          <button className="btn-primary small" disabled={!canSave} onClick={() => {
            const saved = { ...form };
            if (!saved.netAmount) saved.netAmount = String(autoNet > 0 ? autoNet : +saved.grossAmount || 0);
            onSave(saved);
          }}>
            {dividend?.id ? 'Save Changes' : 'Add Dividend'}
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
    </Modal>
  );
}

export default function InvestmentDividends() {
  const { selectedPortfolioId: pid, investments, investmentDividends, setInvestment } = useInvestment();
  const allDividends  = investmentDividends || [];
  const dividends     = allDividends.filter(d => d.portfolioId === pid);
  const holdings      = (investments || []).filter(h => h.portfolioId === pid);

  const [showModal,  setShowModal]  = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);

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

  const handleDelete = (id) => setConfirmTarget(id);

  const executeDelete = () => {
    if (confirmTarget) setInvestment('investmentDividends', allDividends.filter(d => d.id !== confirmTarget));
    setConfirmTarget(null);
  };

  const openEdit = (d) => { setEditTarget(d); setShowModal(true); };
  const openAdd  = ()  => { setEditTarget(null); setShowModal(true); };

  return (
    <div className="page-content">
      {dividends.length > 0 && (
        <div className="fn-summary">
          <StatTile label="Gross Total"   value={fmt(stats.totalGross)} />
          <StatTile label="Tax Withheld"  value={fmt(stats.totalTax)} valueClassName="red" />
          <StatTile label="Net Received"  value={fmt(stats.totalNet)} valueClassName="green" />
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState
          icon={<Icon name="money" size={38} />}
          title="No dividends recorded yet. Log income payments from your investments here."
          action={<button className="btn-ghost small" onClick={openAdd}>+ Add Dividend</button>}
        />
      ) : (
        <Card variant="section">
          <SectionHeader
            title={<><Icon name="arrow-down" size={15} /> History</>}
            actions={<button className="btn-ghost small" onClick={openAdd}>+ Add Dividend</button>}
          />
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
                      <button className="btn-icon small" onClick={() => openEdit(d)} aria-label="Edit dividend">
                        <Icon name="pencil" size={12} />
                      </button>
                      <button className="btn-icon small danger" onClick={() => handleDelete(d.id)} aria-label="Delete dividend">
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
        <DividendModal
          dividend={editTarget}
          holdings={holdings}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
        />
      )}

      <ConfirmDialog
        open={!!confirmTarget}
        title="Remove dividend"
        message="Remove this dividend record?"
        confirmLabel="Remove"
        onConfirm={executeDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
