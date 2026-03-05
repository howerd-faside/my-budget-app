import { useState, useMemo } from 'react';
import { useApp, calcFortnightlyIncome, calcFortnightlyExpenses, calcFortnightlyAssetIncome, calcFortnightlyIncomeAt, getFortnight, totalBalance } from '../store';
import { fmtMoney, fmtMoneyRound } from '../utils/tax';
import { ADHOC_EXPENSE_CATS } from '../utils/categories';
import Icon from '../components/Icon';
import { ResponsiveContainer, LineChart, Line, ReferenceLine, Tooltip } from 'recharts';

const EXPENSE_CATS = ADHOC_EXPENSE_CATS;
const INCOME_CATS  = ['Bonus', 'Commission', 'Tax Refund', 'Side Income', 'Gift Received', 'Other Income'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function uid() { return Math.random().toString(36).slice(2, 9); }

export default function FinancialTracking() {
  const { state, updateFortnight: updFn } = useApp();
  const [year, setYear]       = useState(new Date().getFullYear());
  const [txModal, setTxModal] = useState(null);
  const [txType, setTxType]   = useState('expense');  // 'expense' | 'income'
  const [txForm, setTxForm]   = useState({ description: '', amount: '', category: 'Other', note: '' });

  const fnIncome      = calcFortnightlyIncome(state.people);
  const fnAssetIncome = calcFortnightlyAssetIncome(state.assetIncomes || []);
  const fnExpenses    = calcFortnightlyExpenses(state.expenses);
  const fnNet         = fnIncome + fnAssetIncome - fnExpenses;

  const startBal = totalBalance(state.accounts);

  const yd = state.fortnightlyData[year] || { fortnights: {} };

  const fortnights = useMemo(() => {
    const now = new Date();
    const rows = Array.from({ length: 26 }, (_, i) => {
      const { start, end } = getFortnight(year, i);
      const ftData = (yd.fortnights || {})[i] || { adhocTransactions: [] };
      const adhoc  = (ftData.adhocTransactions || []).reduce((s, t) => s + (t.amount || 0), 0);
      // Date-aware income for this specific fortnight
      const midDate = new Date((start.getTime() + end.getTime()) / 2);
      const fnIncomeAt = calcFortnightlyIncomeAt(state.people, midDate);
      const actual = fnIncomeAt + fnAssetIncome - fnExpenses + adhoc;
      return { i, start, end, adhoc, actual, fnIncomeAt, ftData, balance: 0 };
    });

    // Anchor the current fortnight to today's real balance
    const curIdx = year === now.getFullYear()
      ? rows.findIndex(f => now >= f.start && now <= f.end)
      : -1;

    if (curIdx >= 0) {
      rows[curIdx].balance = startBal;
      for (let i = curIdx + 1; i < 26; i++)
        rows[i].balance = rows[i - 1].balance + rows[i].actual;
      for (let i = curIdx - 1; i >= 0; i--)
        rows[i].balance = rows[i + 1].balance - rows[i + 1].actual;
    } else {
      let running = startBal;
      for (let i = 0; i < 26; i++) { running += rows[i].actual; rows[i].balance = running; }
    }

    return rows;
  }, [year, yd, fnExpenses, startBal, state.people]);

  const today        = new Date();
  const currentFnIdx = fortnights.findIndex(f => today >= f.start && today <= f.end);
  const yearAdhoc    = fortnights.reduce((s, f) => s + f.adhoc, 0);
  const yearTotal    = fortnights.reduce((s, f) => s + f.actual, 0);
  const closingBal   = fortnights[25]?.balance ?? 0;
  const balDelta     = closingBal - startBal;
  const years        = [2025, 2026, 2027, 2028, 2029, 2030];

  // Sparkline data
  const sparkData = fortnights.map(f => ({ n: f.i + 1, b: Math.round(f.balance) }));

  const openTxModal = (fnIdx) => {
    setTxForm({ description: '', amount: '', category: 'Other', note: '' });
    setTxType('expense');
    setTxModal(fnIdx);
  };

  const addTransaction = () => {
    if (!txForm.description || !txForm.amount) return;
    const existing = (yd.fortnights || {})[txModal] || { adhocTransactions: [] };
    const isIncome = txType === 'income';
    const tx = {
      id: uid(),
      date: new Date().toISOString().slice(0, 10),
      description: txForm.description,
      amount: isIncome ? +Math.abs(+txForm.amount) : -Math.abs(+txForm.amount),
      category: txForm.category,
      note: txForm.note,
      type: txType,
    };
    updFn(year, txModal, { adhocTransactions: [...(existing.adhocTransactions || []), tx] });
    setTxModal(null);
  };

  const removeTx = (fnIdx, txId) => {
    const existing = (yd.fortnights || {})[fnIdx] || { adhocTransactions: [] };
    updFn(year, fnIdx, { adhocTransactions: (existing.adhocTransactions || []).filter(t => t.id !== txId) });
  };

  const cats = txType === 'income' ? INCOME_CATS : EXPENSE_CATS;
  const todayStr = new Date().toISOString().slice(0, 10);
  const hasActiveIncomeEvents = state.people.some(p =>
    (p.incomeEvents || []).some(e => e.startDate <= todayStr && (!e.endDate || e.endDate >= todayStr))
  );

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="year-selector">
          {years.map(y => (
            <button key={y} className={`year-btn ${year === y ? 'active' : ''}`} onClick={() => setYear(y)}>{y}</button>
          ))}
        </div>
      </div>

      {/* Overview section */}
      <div className="dash-section">
        <div className="section-header">
          <h3>Overview — {year}</h3>
          <span className="text3" style={{ fontSize: 11 }}>26 fortnights</span>
        </div>

      {/* Year summary */}
      <div className="fn-summary">
        <div className="fns-item">
          <span>Current Balance</span>
          <span className="mono teal">{fmtMoneyRound(startBal)}</span>
        </div>
        <div className="fns-item">
          <span>Base Net /fn</span>
          <span className={`mono ${fnNet >= 0 ? 'green' : 'red'}`}>{fmtMoneyRound(fnNet)}</span>
        </div>
        <div className="fns-item">
          <span>Ad-hoc {year}</span>
          <span className={`mono ${yearAdhoc >= 0 ? 'green' : 'red'}`}>
            {yearAdhoc < 0 ? '−' : '+'}{fmtMoneyRound(Math.abs(yearAdhoc))}
          </span>
        </div>
        <div className="fns-item">
          <span>Net Saved {year}</span>
          <span className={`mono ${yearTotal >= 0 ? 'green' : 'red'}`}>{fmtMoneyRound(yearTotal)}</span>
        </div>
        <div className="fns-item">
          <span>Projected Dec {year}</span>
          <span className="mono teal">{fmtMoneyRound(closingBal)}</span>
          <span className={`trend-indicator ${balDelta >= 0 ? 'up' : 'down'}`}>
            {balDelta >= 0 ? '▲' : '▼'} {fmtMoneyRound(Math.abs(balDelta))}
          </span>
        </div>
      </div>

      {fnIncome === 0 && (
        <div className="warning-banner">
          No income set — add income profiles in the <strong>Income</strong> tab first.
        </div>
      )}
      {hasActiveIncomeEvents && (
        <div className="info-banner" style={{ marginBottom: 16 }}>
          Income events are active — some fortnights show adjusted net income.
        </div>
      )}

      {/* Balance sparkline */}
      <div className="fn-sparkline">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 6px 6px', marginBottom: 2 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Balance Trend</span>
          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: balDelta >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
            {balDelta >= 0 ? '+' : ''}{Math.round(balDelta / 1000).toFixed(1)}k by Dec
          </span>
        </div>
        <ResponsiveContainer width="100%" height={72}>
          <LineChart data={sparkData} margin={{ top: 6, right: 2, bottom: 2, left: 2 }}>
            <Line
              type="monotone" dataKey="b"
              stroke={balDelta >= 0 ? '#34C759' : '#FF3B30'}
              strokeWidth={2} dot={false} isAnimationActive={false}
            />
            {currentFnIdx >= 0 && (
              <ReferenceLine x={currentFnIdx + 1} stroke="rgba(0,113,227,0.4)" strokeDasharray="4 2" />
            )}
            <Tooltip
              formatter={(v) => [`$${Math.round(v).toLocaleString('en-NZ')}`, 'Balance']}
              labelFormatter={(l) => `Fortnight #${l}`}
              contentStyle={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 10, fontSize: 11 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      </div>{/* end overview dash-section */}

      {/* Fortnight list */}
      <div className="dash-section">
        <div className="section-header">
          <h3>Pay Periods — {year}</h3>
          <span className="text3" style={{ fontSize: 11 }}>26 fortnights</span>
        </div>
      <div className="fn-list">
        {fortnights.map(f => {
          const isCurrent = f.i === currentFnIdx;
          const isPast    = f.end < today;
          const txs       = f.ftData.adhocTransactions || [];
          const startM    = f.start.getMonth();
          const endM      = f.end.getMonth();
          const label     = startM === endM
            ? `${MONTHS[startM]} ${f.start.getDate()}–${f.end.getDate()}`
            : `${MONTHS[startM]} ${f.start.getDate()} – ${MONTHS[endM]} ${f.end.getDate()}`;
          // Check if income differs from base in this fortnight
          const incomeChanged = Math.abs(f.fnIncomeAt - fnIncome) > 0.5;

          return (
            <div key={f.i} className={`fn-row ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''}`}>
              {/* Main row */}
              <div className="fn-main">
                <div className="fn-left">
                  <div className="fn-num">#{f.i + 1}</div>
                  <div className="fn-dates">
                    <span className="fn-label">{label}</span>
                    {isCurrent && <span className="fn-badge current-badge">Now</span>}
                    {incomeChanged && <span className="fn-badge event-badge">⚑ income event</span>}
                    {txs.length > 0 && <span className="fn-badge tx-badge">{txs.length} extra</span>}
                  </div>
                </div>
                <div className="fn-right">
                  {f.adhoc !== 0 && (
                    <span className={`fn-adhoc ${f.adhoc >= 0 ? 'green' : 'red'}`}>{fmtMoney(f.adhoc)}</span>
                  )}
                  <span className={`fn-net ${f.actual >= 0 ? 'green' : 'red'}`}>{fmtMoneyRound(f.actual)}</span>
                  <span className="fn-balance">{fmtMoneyRound(f.balance)}</span>
                  <button
                    className="fn-add-btn"
                    onClick={() => openTxModal(f.i)}
                    title="Log ad-hoc transaction"
                  >
                    <Icon name="plus" size={12} />
                  </button>
                </div>
              </div>

              {/* Inline ad-hoc transactions */}
              {txs.length > 0 && (
                <div className="fn-tx-list">
                  {txs.map(tx => (
                    <div key={tx.id} className="fn-tx-row">
                      <span className="fn-tx-date">{tx.date}</span>
                      <span className="tag fn-tx-cat">{tx.category}</span>
                      <span className="fn-tx-desc">{tx.description}</span>
                      {tx.note && <span className="fn-tx-note">{tx.note}</span>}
                      <span className={`fn-tx-amount ${tx.amount >= 0 ? 'green' : 'red'}`}>{fmtMoney(tx.amount)}</span>
                      <button className="btn-icon danger small" onClick={() => removeTx(f.i, tx.id)}>
                        <Icon name="close" size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>{/* end pay-periods dash-section */}

      {/* Add transaction modal */}
      {txModal !== null && (
        <div className="modal-overlay" onClick={() => setTxModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Log Ad-hoc Transaction</h3>
              <button className="btn-icon" onClick={() => setTxModal(null)}><Icon name="close" /></button>
            </div>
            <div className="modal-body">
              {/* Expense / Income toggle */}
              <div className="tx-type-toggle">
                <button
                  className={`ttog-btn ${txType === 'expense' ? 'active red' : ''}`}
                  onClick={() => { setTxType('expense'); setTxForm(t => ({ ...t, category: 'Other' })); }}
                >
                  Expense
                </button>
                <button
                  className={`ttog-btn ${txType === 'income' ? 'active green' : ''}`}
                  onClick={() => { setTxType('income'); setTxForm(t => ({ ...t, category: 'Bonus' })); }}
                >
                  Income
                </button>
              </div>

              <div className="form-grid">
                <div className="form-group full">
                  <label>Description</label>
                  <input className="input" placeholder={txType === 'income' ? 'e.g. Year-end bonus' : 'e.g. Petrol'} autoFocus value={txForm.description}
                    onChange={e => setTxForm(t => ({ ...t, description: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addTransaction()} />
                </div>
                <div className="form-group">
                  <label>Amount ($)</label>
                  <input className="input mono" type="number" step="0.01" placeholder="0.00" value={txForm.amount}
                    onChange={e => setTxForm(t => ({ ...t, amount: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select className="input" value={txForm.category}
                    onChange={e => setTxForm(t => ({ ...t, category: e.target.value }))}>
                    {cats.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group full">
                  <label>Note (optional)</label>
                  <input className="input" placeholder="Optional note" value={txForm.note}
                    onChange={e => setTxForm(t => ({ ...t, note: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setTxModal(null)}>Cancel</button>
              <button
                className={`btn-primary ${txType === 'income' ? 'btn-green' : ''}`}
                onClick={addTransaction}
                disabled={!txForm.description || !txForm.amount}
              >
                {txType === 'income' ? 'Add Income' : 'Add Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
