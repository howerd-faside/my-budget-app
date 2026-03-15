/**
 * TxModal — shared Add/Edit Transaction modal for investment transactions.
 *
 * Used by InvestmentTransactions (full ledger) and AssetDetail (quick actions).
 * Type-adaptive: shows different fields depending on transaction type
 * (buy/sell → units+price, dividend → gross/tax, fee/deposit/withdrawal → amount).
 */
import { useState, useMemo } from 'react';
import { Modal } from '../ui';
import {
  createInvestmentTransaction,
  INV_TX_TYPES,
  INV_TX_TYPE_PILL,
} from '../../models/InvestmentTransaction';
import { validate, investmentTransactionSchema } from '../../utils/validation';
import { fmtCurrency as fmt } from '../../utils/format';

// ── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS = {
  buy: 'Buy', sell: 'Sell', dividend: 'Dividend', fee: 'Fee',
  deposit: 'Deposit', withdrawal: 'Withdrawal', transfer: 'Transfer',
};

/** Types that need an asset link. */
const ASSET_TYPES = new Set(['buy', 'sell', 'dividend']);

/** Types that display units + price fields. */
const POSITION_TYPES = new Set(['buy', 'sell']);

// ── Component ────────────────────────────────────────────────────────────────

/**
 * Props:
 *   tx       — existing transaction to edit, or null/undefined for add
 *   assets   — array of Asset objects for the asset selector
 *   onSave   — called with the form data object when user submits
 *   onClose  — close modal callback
 *   defaults — optional partial overrides for the blank form (e.g. { assetId, type })
 */
export default function TxModal({ tx, assets, onSave, onClose, defaults = {} }) {
  const initial = tx ? { ...tx } : { ...createInvestmentTransaction({ date: new Date().toISOString().slice(0, 10), ...defaults }) };
  const [form, setForm] = useState(() => initial);
  const [errors, setErrors] = useState({});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const type = form.type;
  const showAsset    = ASSET_TYPES.has(type);
  const showPosition = POSITION_TYPES.has(type);
  const showDividend = type === 'dividend';
  const showAmount   = !showPosition && !showDividend;

  // Auto-calc amount for buy/sell: units × price + fee
  const autoAmount = useMemo(() => {
    if (!showPosition) return null;
    const u = +form.units || 0;
    const p = +form.price || 0;
    const f = +form.fee   || 0;
    return u * p + f;
  }, [showPosition, form.units, form.price, form.fee]);

  // Auto-calc net for dividend: gross - tax
  const autoNet = useMemo(() => {
    if (!showDividend) return null;
    return (+form.grossAmount || 0) - (+form.taxAmount || 0);
  }, [showDividend, form.grossAmount, form.taxAmount]);

  const handleTypeChange = (newType) => {
    const reset = {
      units: '', price: '', grossAmount: '', taxAmount: '',
      amount: '', fee: '',
    };
    if (!ASSET_TYPES.has(newType)) reset.assetId = '';
    setForm(f => ({ ...f, ...reset, type: newType }));
    setErrors({});
  };

  const handleSave = () => {
    const { ok, errors: errs } = validate(investmentTransactionSchema, form);
    if (!ok) { setErrors(errs); return; }
    setErrors({});

    const toSave = { ...form };
    if (showPosition && autoAmount != null) {
      toSave.amount = String(autoAmount);
    }
    if (showDividend) {
      toSave.amount = String(form.grossAmount ? autoNet : 0);
    }
    onSave(toSave);
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      wide
      title={tx?.id ? 'Edit Transaction' : 'Add Transaction'}
      bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
      footer={
        <>
          <button className="btn-ghost small" onClick={onClose}>Cancel</button>
          <button className="btn-primary small" onClick={handleSave}>
            {tx?.id ? 'Save Changes' : 'Add Transaction'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        {/* Row 1: Date + Type */}
        <div className="form-group">
          <label>Date</label>
          <input
            className={`input mono${errors.date ? ' input-error' : ''}`}
            type="date"
            value={form.date}
            onChange={e => set('date', e.target.value)}
          />
          {errors.date && <span className="field-error">{errors.date}</span>}
        </div>
        <div className="form-group">
          <label>Type</label>
          <select className="input" value={form.type} onChange={e => handleTypeChange(e.target.value)}>
            {INV_TX_TYPES.map(t => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        {/* Asset selector (buy/sell/dividend) */}
        {showAsset && (
          <div className="form-group full">
            <label>Asset</label>
            {assets.length > 0 ? (
              <select
                className={`input${errors.assetId ? ' input-error' : ''}`}
                value={form.assetId}
                onChange={e => set('assetId', e.target.value)}
              >
                <option value="">— Select asset —</option>
                {assets.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}{a.ticker ? ` (${a.ticker})` : ''}{a.platform ? ` · ${a.platform}` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <input className="input" placeholder="No assets — add one first" disabled value="" />
            )}
            {errors.assetId && <span className="field-error">{errors.assetId}</span>}
          </div>
        )}

        {/* Units + Price (buy/sell) */}
        {showPosition && (
          <>
            <div className="form-group">
              <label>Units</label>
              <input
                className={`input mono${errors.units ? ' input-error' : ''}`}
                type="number" step="0.000001" placeholder="0"
                value={form.units}
                onChange={e => set('units', e.target.value)}
              />
              {errors.units && <span className="field-error">{errors.units}</span>}
            </div>
            <div className="form-group">
              <label>Price per Unit ($)</label>
              <input
                className={`input mono${errors.price ? ' input-error' : ''}`}
                type="number" step="0.0001" placeholder="0.00"
                value={form.price}
                onChange={e => set('price', e.target.value)}
              />
              {errors.price && <span className="field-error">{errors.price}</span>}
            </div>
          </>
        )}

        {/* Dividend fields */}
        {showDividend && (
          <>
            <div className="form-group">
              <label>Gross Amount ($)</label>
              <input
                className={`input mono${errors.grossAmount ? ' input-error' : ''}`}
                type="number" step="0.01" placeholder="0.00"
                value={form.grossAmount}
                onChange={e => set('grossAmount', e.target.value)}
              />
              {errors.grossAmount && <span className="field-error">{errors.grossAmount}</span>}
            </div>
            <div className="form-group">
              <label>Tax Withheld ($)</label>
              <input
                className="input mono" type="number" step="0.01" placeholder="0.00"
                value={form.taxAmount}
                onChange={e => set('taxAmount', e.target.value)}
              />
            </div>
          </>
        )}

        {/* Amount (fee/deposit/withdrawal/transfer) */}
        {showAmount && (
          <div className="form-group full">
            <label>Amount ($)</label>
            <input
              className={`input mono${errors.amount ? ' input-error' : ''}`}
              type="number" step="0.01" placeholder="0.00"
              value={form.amount}
              onChange={e => set('amount', e.target.value)}
            />
            {errors.amount && <span className="field-error">{errors.amount}</span>}
          </div>
        )}

        {/* Fee (buy/sell) */}
        {showPosition && (
          <div className="form-group full">
            <label>Brokerage / Fee ($)</label>
            <input
              className="input mono" type="number" step="0.01" placeholder="0.00"
              value={form.fee}
              onChange={e => set('fee', e.target.value)}
            />
          </div>
        )}

        {/* Label + Notes */}
        <div className="form-group full">
          <label>Label</label>
          <input
            className="input" placeholder="Optional label"
            value={form.label}
            onChange={e => set('label', e.target.value)}
          />
        </div>
        <div className="form-group full">
          <label>Notes</label>
          <input
            className="input" placeholder="Optional notes"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
          />
        </div>
      </div>

      {/* Preview calculation */}
      {showPosition && autoAmount > 0 && (
        <div className="calc-preview">
          <span>{form.units || 0} units × {fmt(form.price || 0)}</span>
          {+form.fee > 0 && <span>+ {fmt(form.fee)} fee</span>}
          <span style={{ fontWeight: 600 }}>= {fmt(autoAmount)}</span>
        </div>
      )}
      {showDividend && +form.grossAmount > 0 && (
        <div className="calc-preview">
          <span>Gross: <strong>{fmt(form.grossAmount)}</strong></span>
          <span style={{ color: 'var(--red)' }}>Tax: <strong>{form.taxAmount ? fmt(form.taxAmount) : '$0.00'}</strong></span>
          <span style={{ color: 'var(--green)' }}>Net: <strong>{fmt(autoNet)}</strong></span>
        </div>
      )}
    </Modal>
  );
}
