import { useState } from 'react';
import { Modal } from '../ui';
import { createAsset, ASSET_CATEGORIES } from '../../models/Asset';
import { validate, assetSchema } from '../../utils/validation';

export default function ConvertToAssetModal({ item, portfolios, selectedPortfolioId, onSave, onClose }) {
  const [portfolioId, setPortfolioId] = useState(selectedPortfolioId || portfolios[0]?.id || '');
  const [form, setForm] = useState(() => createAsset({
    name:     item.name,
    ticker:   item.ticker,
    category: item.category,
    currency: item.currency,
  }));
  const [errors, setErrors] = useState({});
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    const full = { ...form, portfolioId };
    const { ok, errors: errs } = validate(assetSchema, full);
    if (!ok) { setErrors(errs); return; }
    setErrors({});
    onSave(full, portfolioId);
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Add to Portfolio"
      bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
      footer={
        <>
          <button className="btn-ghost small" onClick={onClose}>Cancel</button>
          <button className="btn-primary small" onClick={handleSave}>Create Asset</button>
        </>
      }
    >
      <div className="form-grid">
        {portfolios.length > 1 && (
          <div className="form-group full">
            <label>Portfolio</label>
            <select className="input" value={portfolioId}
              onChange={e => setPortfolioId(e.target.value)}>
              {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
        <div className="form-group full">
          <label>Asset Name</label>
          <input className={`input${errors.name ? ' input-error' : ''}`} placeholder="e.g. Vanguard Total World ETF"
            value={form.name} onChange={e => setField('name', e.target.value)} />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </div>
        <div className="form-group">
          <label>Ticker</label>
          <input className="input mono" value={form.ticker}
            onChange={e => setField('ticker', e.target.value.toUpperCase())} />
        </div>
        <div className="form-group">
          <label>Category</label>
          <select className="input" value={form.category} onChange={e => setField('category', e.target.value)}>
            {ASSET_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Platform / Broker</label>
          <input className="input" placeholder="e.g. Sharesies, Hatch"
            value={form.platform} onChange={e => setField('platform', e.target.value)} />
        </div>
        <div className="form-group">
          <label>Currency</label>
          <input className="input mono" value={form.currency}
            onChange={e => setField('currency', e.target.value.toUpperCase())} />
        </div>
      </div>
    </Modal>
  );
}
