import { useState } from 'react';
import PropTypes from 'prop-types';
import { fmtMoneyRound } from '../../utils/finance/tax';
import { Modal } from '../../components/ui';

/**
 * Modal for creating an inter-account transfer.
 *
 * @param {object}   props
 * @param {Array}    props.accounts   - All account objects
 * @param {Function} props.onClose    - Close callback
 * @param {Function} props.onTransfer - Callback ({ fromId, toId, amount, note }) on submit
 */
export default function TransferModal({ accounts, onClose, onTransfer }) {
  const [form, setForm] = useState({
    fromId: accounts[0]?.id || 'main',
    toId:   accounts[1]?.id || 'emergency',
    amount: '',
    note:   '',
  });

  const from  = accounts.find(a => a.id === form.fromId);
  const to    = accounts.find(a => a.id === form.toId);
  const amt   = parseFloat(form.amount) || 0;
  const valid = amt > 0 && form.fromId !== form.toId && amt <= (from?.balance || 0);

  const submit = () => { if (!valid) return; onTransfer(form); onClose(); };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Transfer Between Accounts"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={!valid}>Transfer</button>
        </>
      }
    >
      <div className="form-grid">
        <div className="form-group">
          <label>From</label>
          <select className="input" value={form.fromId}
            onChange={e => setForm(f => ({ ...f, fromId: e.target.value }))}>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name} (${a.balance.toLocaleString('en-NZ', { minimumFractionDigits: 2 })})</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>To</label>
          <select className="input" value={form.toId}
            onChange={e => setForm(f => ({ ...f, toId: e.target.value }))}>
            {accounts.filter(a => a.id !== form.fromId).map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Amount ($)</label>
          <input className="input mono" type="number" step="0.01" placeholder="0.00" value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} autoFocus />
        </div>
        <div className="form-group">
          <label>Note (optional)</label>
          <input className="input" placeholder="e.g. Holiday savings" value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
        </div>
      </div>
      {amt > 0 && from && to && (
        <div className="calc-preview">
          <span>{from.name}: <strong className={amt > from.balance ? 'red' : ''}>${(from.balance - amt).toLocaleString('en-NZ', { minimumFractionDigits: 2 })}</strong></span>
          <span className="text3">→</span>
          <span>{to.name}: <strong>${(to.balance + amt).toLocaleString('en-NZ', { minimumFractionDigits: 2 })}</strong></span>
        </div>
      )}
      {amt > (from?.balance || 0) && amt > 0 && (
        <div style={{ color: 'var(--red)', fontSize: 12 }}>Insufficient balance in {from?.name}</div>
      )}
    </Modal>
  );
}

TransferModal.propTypes = {
  accounts: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    balance: PropTypes.number.isRequired,
  })).isRequired,
  onClose: PropTypes.func.isRequired,
  onTransfer: PropTypes.func.isRequired,
};
