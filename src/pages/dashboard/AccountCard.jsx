import { useState } from 'react';
import PropTypes from 'prop-types';
import Icon from '../../components/Icon';
import { validate, accountSchema } from '../../utils/validation';
import { ACCOUNT_COLORS_VAR } from '../../utils/colors';

/**
 * Single account display with inline balance editing.
 *
 * @param {object}   props
 * @param {object}   props.account        - Account object ({ id, name, balance })
 * @param {number}   props.total          - Total balance across all accounts (for %)
 * @param {Function} props.updateAccount  - Callback (id, newBalance) to persist change
 */
export default function AccountCard({ account, total, updateAccount }) {
  const [editing, setEditing] = useState(false);
  const [input, setInput]     = useState('');
  const [error, setError]     = useState('');
  const pct    = total > 0 ? Math.round(account.balance / total * 100) : 0;
  const barPct = total > 0 ? Math.max(2, pct) : 0;

  const color  = ACCOUNT_COLORS_VAR[account.id] || 'var(--teal)';

  const save = () => {
    const { ok, errors } = validate(accountSchema, { balance: input });
    if (!ok) { setError(errors.balance || 'Invalid value'); return; }
    updateAccount(account.id, parseFloat(input));
    setEditing(false);
    setInput('');
    setError('');
  };

  return (
    <div className="account-card">
      <div className="ac-name">{account.name}</div>
      {editing ? (
        <div style={{ margin: '8px 0 14px' }}>
          <div className="bw-edit">
            <input
              className={`bw-input${error ? ' input-error' : ''}`}
              type="number" step="0.01" autoFocus
              value={input}
              placeholder={account.balance.toFixed(2)}
              onChange={e => { setInput(e.target.value); setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditing(false); setError(''); } }}
            />
            <button className="bw-save" onClick={save}><Icon name="check" size={11} /></button>
          </div>
          {error && <span className="field-error">{error}</span>}
        </div>
      ) : (
        <button className="bw-value ac-balance-btn" onClick={() => { setInput(account.balance.toFixed(2)); setEditing(true); }}>
          <span className="ac-balance" style={{ color }}>
            ${account.balance.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="bw-edit-hint"><Icon name="pencil" size={10} /></span>
        </button>
      )}
      <div className="ac-bar-wrap">
        <div className="ac-bar" style={{ width: `${barPct}%`, background: color }} />
      </div>
      <div className="ac-pct">{pct}% of total</div>
    </div>
  );
}

AccountCard.propTypes = {
  account: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    balance: PropTypes.number.isRequired,
  }).isRequired,
  total: PropTypes.number.isRequired,
  updateAccount: PropTypes.func.isRequired,
};
