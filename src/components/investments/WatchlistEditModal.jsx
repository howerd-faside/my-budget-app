import { useState } from 'react';
import { Modal } from '../ui';
import { ASSET_CATEGORIES } from '../../models/Asset';

export default function WatchlistEditModal({ item, onSave, onClose }) {
  const [form, setForm] = useState(() => ({ ...item }));
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.ticker.trim() && !form.name.trim()) return;
    onSave(form);
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Edit Watchlist Item"
      bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
      footer={
        <>
          <button className="btn-ghost small" onClick={onClose}>Cancel</button>
          <button className="btn-primary small" onClick={handleSave}>Save</button>
        </>
      }
    >
      <div className="form-grid">
        <div className="form-group">
          <label>Ticker</label>
          <input className="input mono" value={form.ticker}
            onChange={e => set('ticker', e.target.value.toUpperCase())} />
        </div>
        <div className="form-group">
          <label>Name</label>
          <input className="input" value={form.name}
            onChange={e => set('name', e.target.value)} />
        </div>
        <div className="form-group">
          <label>Category</label>
          <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
            {ASSET_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Currency</label>
          <input className="input mono" value={form.currency}
            onChange={e => set('currency', e.target.value.toUpperCase())} />
        </div>
        <div className="form-group">
          <label>Target Price</label>
          <input className="input mono" type="number" step="0.01" placeholder="Optional"
            value={form.targetPrice ?? ''}
            onChange={e => set('targetPrice', e.target.value === '' ? null : +e.target.value)} />
        </div>
        <div className="form-group">
          <label>Tags (comma-separated)</label>
          <input className="input" placeholder="e.g. US, Core, Income"
            value={(form.tags || []).join(', ')}
            onChange={e => set('tags', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
        </div>
        <div className="form-group full">
          <label>Thesis / Notes</label>
          <textarea className="input" rows={4} placeholder="Why are you watching this?"
            value={form.thesis} onChange={e => set('thesis', e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
