import { useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import {
  useApp, totalBalance, calcFortnightlyIncome, calcFortnightlyExpenses, calcFortnightlyAssetIncome, buildSavingsTrajectory,
} from '../store';
import { fmtMoneyRound, calcNetPay } from '../utils/tax';
import { buildAmortSchedule, calcTotalInterest, calcRemainingTerm } from '../utils/mortgage';
import { EXPENSE_GROUPS } from '../utils/categories';
import Icon from '../components/Icon';

const RATE_COLORS = { fixed: '#FF9F0A', floating: '#34C759', revolving: '#AF52DE', default: '#0071E3' };

function uid() { return Math.random().toString(36).slice(2, 9); }

const EMPTY_GOAL = { name: '', amount: '', targetDate: '', notes: '' };
const VIEW_LIMITS = { '1y': 26, '2y': 52, '3y': 78, '5y': 130 };

const TrajTooltip = ({ active, payload, label, goals }) => {
  if (!active || !payload?.length) return null;
  const bal = payload[0]?.value;
  const hit = goals.filter(g => g._hitDate === label);
  return (
    <div className="chart-tt">
      <div className="tt-date">{label}</div>
      <div className="tt-bal">${Math.round(bal).toLocaleString('en-NZ')}</div>
      {hit.map(g => <div key={g.id} className="tt-goal">🎯 {g.name}</div>)}
    </div>
  );
};

function toFn(e) {
  const a = +e.amount || 0;
  if (e.frequency === 'fortnightly') return a;
  if (e.frequency === 'weekly')      return a * 2;
  if (e.frequency === 'monthly')     return (a * 12) / 26;
  if (e.frequency === 'quarterly')   return (a * 4) / 26;
  if (e.frequency === 'annual')      return a / 26;
  return a;
}

const fmtK = v => `$${(v / 1000).toFixed(0)}k`;

// ── Account Card ────────────────────────────────────────────────────────────
function AccountCard({ account, total, updateAccount }) {
  const [editing, setEditing] = useState(false);
  const [input, setInput]     = useState('');
  const pct    = total > 0 ? Math.round(account.balance / total * 100) : 0;
  const barPct = total > 0 ? Math.max(2, pct) : 0;

  const COLORS = { main: 'var(--teal)', emergency: 'var(--amber)', travel: 'var(--purple)' };
  const color  = COLORS[account.id] || 'var(--teal)';

  const save = () => {
    const val = parseFloat(input);
    if (!isNaN(val) && val >= 0) updateAccount(account.id, val);
    setEditing(false);
    setInput('');
  };

  return (
    <div className="account-card">
      <div className="ac-name">{account.name}</div>
      {editing ? (
        <div className="bw-edit" style={{ margin: '8px 0 14px' }}>
          <input
            className="bw-input"
            type="number" step="0.01" autoFocus
            value={input}
            placeholder={account.balance.toFixed(2)}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          />
          <button className="bw-save" onClick={save}><Icon name="check" size={11} /></button>
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

// ── Transfer Modal ───────────────────────────────────────────────────────────
function TransferModal({ accounts, onClose, onTransfer }) {
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Transfer Between Accounts</h3>
          <button className="btn-icon" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="modal-body">
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
        </div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={!valid}>Transfer</button>
        </div>
      </div>
    </div>
  );
}

// ── Income Card (per person) ─────────────────────────────────────────────────
function IncomeCard({ person }) {
  const pay = person.pay || calcNetPay(person);
  const secFn = useMemo(() =>
    (person.secondaryIncomes || []).reduce((s, si) => {
      if (si.frequency === 'fortnightly') return s + (+si.amount || 0);
      if (si.frequency === 'weekly')      return s + (+si.amount || 0) * 2;
      if (si.frequency === 'monthly')     return s + ((+si.amount || 0) * 12) / 26;
      if (si.frequency === 'annual')      return s + (+si.amount || 0) / 26;
      return s;
    }, 0), [person.secondaryIncomes]);

  return (
    <div className="income-card">
      <div className="ic-header">
        <span className="ic-name">{person.name || 'Unnamed'}</span>
        <div className="ic-tags">
          <span className="tag">{person.taxCode}</span>
          {person.kiwiSaverRate > 0 && <span className="tag teal">KS {person.kiwiSaverRate}%</span>}
        </div>
      </div>

      <div className="ic-stats">
        <div className="ic-stat">
          <span className="ic-stat-label">Gross /fn</span>
          <span className="mono ic-stat-val">{fmtMoneyRound(pay.grossAnnual / 26)}</span>
        </div>
        <div className="ic-stat">
          <span className="ic-stat-label">Net /fn</span>
          <span className="mono ic-stat-val green">{fmtMoneyRound(pay.netFortnightly)}</span>
        </div>
        <div className="ic-stat">
          <span className="ic-stat-label">Annual Gross</span>
          <span className="mono ic-stat-val">{fmtMoneyRound(pay.grossAnnual)}</span>
        </div>
        <div className="ic-stat">
          <span className="ic-stat-label">Annual Net</span>
          <span className="mono ic-stat-val green">{fmtMoneyRound(pay.netAnnual)}</span>
        </div>
      </div>

      <div className="ic-deductions">
        <span className="ic-ded red">Tax {pay.effectiveRate.toFixed(1)}% · −{fmtMoneyRound(pay.taxAnnual / 26)}/fn</span>
        <span className="ic-ded red">ACC −{fmtMoneyRound(pay.accAnnual / 26)}/fn</span>
        {person.kiwiSaverRate > 0 && (
          <span className="ic-ded teal">KiwiSaver {person.kiwiSaverRate}% · −{fmtMoneyRound(pay.kiwiSaverAnnual / 26)}/fn</span>
        )}
        {pay.studentLoanAnnual > 0 && (
          <span className="ic-ded purple">Student Loan −{fmtMoneyRound(pay.studentLoanAnnual / 26)}/fn</span>
        )}
      </div>

      {secFn > 0 && (
        <div className="ic-secondary">
          <span className="ic-ded green">+ Secondary income {fmtMoneyRound(secFn)}/fn</span>
          <span className="ic-total-row">
            <span className="text3" style={{ fontSize: 10 }}>TOTAL /fn</span>
            <span className="mono green" style={{ fontSize: 15, fontWeight: 700 }}>
              {fmtMoneyRound(pay.netFortnightly + secFn)}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

// ── Chart tooltip styles ─────────────────────────────────────────────────────
const TOOLTIP_STYLE = {
  background: 'rgba(255,255,255,0.97)',
  border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: 12, fontSize: 11,
  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
};

// ── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { state, set, updateAccount, addTransfer, removeTransfer } = useApp();
  const [showTransfer, setShowTransfer] = useState(false);
  const [viewRange, setViewRange]       = useState('3y');
  const [editing, setEditing]           = useState(null);
  const [goalForm, setGoalForm]         = useState(EMPTY_GOAL);

  const accounts      = state.accounts || [];
  const netWorth      = totalBalance(accounts);
  const fnIncome      = calcFortnightlyIncome(state.people);
  const fnAssetIncome = calcFortnightlyAssetIncome(state.assetIncomes || []);
  const fnExpenses    = calcFortnightlyExpenses(state.expenses);
  const fnNet         = fnIncome + fnAssetIncome - fnExpenses;
  const fnTotal       = fnIncome + fnAssetIncome;
  const savingsRate   = fnTotal > 0 ? Math.round(fnNet / fnTotal * 100) : 0;

  // ── Income ────────────────────────────────────────────────────────────────
  const incomeRows = useMemo(() => state.people.map(p => ({ ...p, pay: calcNetPay(p) })), [state.people]);
  const totalGrossAnnual = incomeRows.reduce((s, p) => s + (p.grossAnnual || 0), 0);
  const totalNetAnnual   = fnIncome * 26;
  const avgTaxRate       = totalGrossAnnual > 0
    ? incomeRows.reduce((s, p) => s + p.pay.taxAnnual, 0) / totalGrossAnnual * 100
    : 0;

  // ── Expenses ──────────────────────────────────────────────────────────────
  const groupTotals = useMemo(() => {
    const catTotals = {};
    state.expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + toFn(e); });
    const t = {};
    EXPENSE_GROUPS.forEach(g => { t[g.id] = g.cats.reduce((s, c) => s + (catTotals[c] || 0), 0); });
    return t;
  }, [state.expenses]);

  // ── Goals & Trajectory ────────────────────────────────────────────────────
  const trajectory = useMemo(() => buildSavingsTrajectory(state), [state]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayIdx = useMemo(() => {
    let idx = 0;
    for (let i = 0; i < trajectory.length; i++) {
      if (trajectory[i].date <= todayStr) idx = i;
      else break;
    }
    return idx;
  }, [trajectory, todayStr]);
  const todayLabel = trajectory[todayIdx]?.date.slice(0, 7);

  const chartData = useMemo(() => {
    const limit  = VIEW_LIMITS[viewRange] ?? 78;
    const start  = Math.max(0, todayIdx - 2);
    const sliced = trajectory.slice(start, start + limit + 3);
    const step   = viewRange === '1y' ? 1 : 2;
    return sliced.filter((_, i) => i % step === 0).map(p => ({
      date:    p.date.slice(0, 7),
      balance: Math.round(p.balance),
    }));
  }, [trajectory, viewRange, todayIdx]);

  const goalsWithDates = useMemo(() => {
    return (state.goals || []).map(g => {
      const hit     = trajectory.find(p => p.balance >= (g.amount || 0));
      const hitDate = hit ? hit.date.slice(0, 7) : null;
      let monthsRemaining = null;
      if (hitDate) {
        const [hy, hm] = hitDate.split('-').map(Number);
        const now = new Date();
        monthsRemaining = Math.max(0, (hy - now.getFullYear()) * 12 + (hm - (now.getMonth() + 1)));
      }
      return { ...g, _hitDate: hitDate, _hitBalance: hit?.balance, _monthsRemaining: monthsRemaining };
    });
  }, [state.goals, trajectory]);

  const currentBal    = trajectory[todayIdx]?.balance ?? netWorth;
  const endIdx        = Math.min(trajectory.length - 1, todayIdx + (VIEW_LIMITS[viewRange] ?? 78));
  const projectedBal  = trajectory[endIdx]?.balance ?? 0;
  const projectedYear = trajectory[endIdx]?.date.slice(0, 4) ?? '2030';

  const openGoal  = () => { setGoalForm({ ...EMPTY_GOAL, id: uid() }); setEditing('new'); };
  const closeGoal = () => { setEditing(null); setGoalForm(EMPTY_GOAL); };
  const saveGoal  = () => {
    const goal = { ...goalForm, amount: +goalForm.amount };
    if (editing === 'new') set('goals', [...(state.goals || []), goal]);
    else set('goals', (state.goals || []).map(g => g.id === goalForm.id ? goal : g));
    closeGoal();
  };
  const removeGoal = (id) => {
    if (confirm('Remove this goal?')) set('goals', (state.goals || []).filter(g => g.id !== id));
  };

  const nextGoalIdx = goalsWithDates.findIndex(g => currentBal < (g.amount || 0));

  // ── Loans ─────────────────────────────────────────────────────────────────
  const loanExpenses = useMemo(() => (state.expenses || []).filter(e => e.type === 'loan'), [state.expenses]);

  const allFacilities = useMemo(() =>
    loanExpenses.flatMap(loan =>
      (loan.facilities || [])
        .filter(f => (+f.balance || 0) > 0 && (+f.rate || 0) > 0 && (+f.amount || 0) > 0)
        .map(f => ({ ...f, loanName: loan.name }))
    ), [loanExpenses]);

  const totalLoanBalance  = allFacilities.reduce((s, f) => s + (+f.balance || 0), 0);
  const totalLoanPayment  = allFacilities.reduce((s, f) => s + (+f.amount || 0), 0);
  const totalLoanInterest = useMemo(() =>
    allFacilities.reduce((s, f) => s + calcTotalInterest(+f.balance, +f.rate, +f.amount), 0),
    [allFacilities]);

  // Per-facility amort schedules
  const facilitySchedules = useMemo(() =>
    allFacilities.map(f => ({
      fac: f,
      color: RATE_COLORS[f.rateType] || RATE_COLORS.default,
      data: buildAmortSchedule(+f.balance, +f.rate, +f.amount),
    })), [allFacilities]);

  // Balance decline chart data — one column per facility + total
  const balanceDeclineData = useMemo(() => {
    if (facilitySchedules.length === 0) return [];
    const maxLen = Math.max(...facilitySchedules.map(s => s.data.length));
    return Array.from({ length: maxLen }, (_, i) => {
      const row = { year: i };
      facilitySchedules.forEach((s, fi) => {
        row[`f${fi}`] = i < s.data.length ? Math.round(s.data[i].balance) : 0;
      });
      row.total = facilitySchedules.reduce((sum, s, fi) => sum + (row[`f${fi}`] || 0), 0);
      return row;
    });
  }, [facilitySchedules]);

  // P&I split data — combined annual interest/principal
  const piSplitData = useMemo(() => {
    if (facilitySchedules.length === 0) return [];
    const maxLen = Math.max(...facilitySchedules.map(s => s.data.length));
    return Array.from({ length: maxLen }, (_, i) => ({
      year: i,
      interest:  Math.round(facilitySchedules.reduce((sum, s) => sum + (i < s.data.length ? (s.data[i].annualInterest  || 0) : 0), 0)),
      principal: Math.round(facilitySchedules.reduce((sum, s) => sum + (i < s.data.length ? (s.data[i].annualPrincipal || 0) : 0), 0)),
    })).filter(d => d.year > 0);
  }, [facilitySchedules]);

  // Crossover year: first year where principal > interest
  const crossoverYear = useMemo(() => {
    const found = piSplitData.find(d => d.principal > d.interest);
    return found?.year ?? null;
  }, [piSplitData]);

  // ── Transfers ─────────────────────────────────────────────────────────────
  const recentTransfers = useMemo(() =>
    [...(state.transfers || [])].reverse().slice(0, 6), [state.transfers]);

  const accountName = (id) => accounts.find(a => a.id === id)?.name || id;

  return (
    <div className="page-content">
      {/* ── ACCOUNTS ────────────────────────────────────────────────────── */}
      <div className="dash-section">
        <div className="section-header">
          <h3>Accounts</h3>
          {accounts.length > 1 && (
            <button className="btn-ghost small" onClick={() => setShowTransfer(true)}>
              <Icon name="swap" size={12} /> Transfer
            </button>
          )}
        </div>

        <div className="account-cards">
          {accounts.map(a => (
            <AccountCard key={a.id} account={a} total={netWorth} updateAccount={updateAccount} />
          ))}
        </div>

        {recentTransfers.length > 0 && (
          <>
            <div className="section-subheader">
              <span>Recent Transfers</span>
            </div>
            <div className="transfer-history-card">
              {recentTransfers.map(tx => (
                <div key={tx.id} className="th-row">
                  <span className="th-date">{tx.date}</span>
                  <span className="th-accounts">
                    {accountName(tx.fromId)} → {accountName(tx.toId)}
                    {tx.note && <span className="th-note"> · {tx.note}</span>}
                  </span>
                  <span className="th-amount">{fmtMoneyRound(tx.amount)}</span>
                  <button className="btn-icon small" onClick={() => removeTransfer(tx.id)} title="Undo transfer">
                    <Icon name="close" size={10} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── INCOME ──────────────────────────────────────────────────────── */}
      {state.people.length > 0 && (
        <div className="dash-section">
          <div className="section-header">
            <h3>Income</h3>
            <span className="text3" style={{ fontSize: 11 }}>{state.people.length} earner{state.people.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="fn-summary">
            <div className="fns-item">
              <span>Employment /fn</span>
              <span className="mono green">{fmtMoneyRound(fnIncome)}</span>
            </div>
            {fnAssetIncome > 0 && (
              <div className="fns-item">
                <span>Asset Income /fn</span>
                <span className="mono teal">{fmtMoneyRound(fnAssetIncome)}</span>
              </div>
            )}
            <div className="fns-item">
              <span>Annual Gross</span>
              <span className="mono">{fmtMoneyRound(totalGrossAnnual)}</span>
            </div>
            <div className="fns-item">
              <span>Annual Net</span>
              <span className="mono green">{fmtMoneyRound(totalNetAnnual)}</span>
            </div>
            <div className="fns-item">
              <span>Avg Tax Rate</span>
              <span className="mono amber">{avgTaxRate.toFixed(1)}%</span>
            </div>
          </div>

          <div className="income-grid">
            {incomeRows.map(p => <IncomeCard key={p.id} person={p} />)}
          </div>
        </div>
      )}

      {/* ── SAVINGS TRAJECTORY ──────────────────────────────────────── */}
      <div className="dash-section">
        <div className="section-header">
          <h3>Savings Trajectory</h3>
          {goalsWithDates.length > 0 && (
            <span className="text3" style={{ fontSize: 11 }}>
              {goalsWithDates.filter(g => g._hitDate).length}/{goalsWithDates.length} goals achievable
            </span>
          )}
        </div>

        <div className="fn-summary">
          <div className="fns-item">
            <span>Current Balance</span>
            <span className="mono teal">${Math.round(currentBal).toLocaleString('en-NZ')}</span>
          </div>
          <div className="fns-item">
            <span>Projected {projectedYear}</span>
            <span className="mono green">${Math.round(projectedBal).toLocaleString('en-NZ')}</span>
          </div>
          {fnIncome > 0 && (
            <div className="fns-item">
              <span>Savings Rate</span>
              <span className={`mono ${savingsRate >= 20 ? 'green' : savingsRate >= 10 ? 'amber' : 'red'}`}>
                {savingsRate}%
              </span>
            </div>
          )}
          <div className="fns-item">
            <span>Goals Set</span>
            <span className="mono">{(state.goals || []).length}</span>
          </div>
        </div>

        <div className="chart-card-inline">
          <div className="chart-header">
            <span className="chart-title">Projected Balance</span>
            <div className="range-tabs">
              {Object.keys(VIEW_LIMITS).map(r => (
                <button key={r} className={`range-tab ${viewRange === r ? 'active' : ''}`}
                  onClick={() => setViewRange(r)}>{r}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#0071E3" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#0071E3" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="date"
                tick={{ fill: '#86868B', fontSize: 10 }}
                tickLine={false} axisLine={false} />
              <YAxis
                tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                tick={{ fill: '#86868B', fontSize: 10 }}
                tickLine={false} axisLine={false} width={52} />
              <Tooltip content={<TrajTooltip goals={goalsWithDates} />} />
              {todayLabel && (
                <ReferenceLine x={todayLabel} stroke="rgba(0,113,227,0.4)" strokeDasharray="4 4"
                  label={{ value: 'Today', position: 'insideTopRight', fill: 'rgba(0,113,227,0.6)', fontSize: 9 }} />
              )}
              {goalsWithDates.filter(g => g._hitDate).map(g => (
                <ReferenceLine key={g.id} x={g._hitDate} stroke="#ffd60a" strokeDasharray="4 4"
                  label={{ value: g.name, position: 'top', fill: '#b8960a', fontSize: 9 }} />
              ))}
              <Area type="monotone" dataKey="balance"
                stroke="#0071E3" strokeWidth={2} fill="url(#balGrad)"
                dot={false} activeDot={{ r: 4, fill: '#0071E3', strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {goalsWithDates.length > 0 && (
          <>
            <div className="section-subheader">
              <span>Goals</span>
              <button className="btn-ghost small" onClick={openGoal}>+ Add Goal</button>
            </div>
            <div className="dash-goals">
              {goalsWithDates.map((g, idx) => {
                const pct      = g.amount > 0 ? Math.min(100, Math.round((currentBal / g.amount) * 100)) : 0;
                const achieved = !!g._hitDate;
                const today    = new Date().toISOString().slice(0, 7);
                const overdue  = g.targetDate && g.targetDate < today && !achieved;
                return (
                  <div key={g.id} className={`dash-goal-row ${idx === nextGoalIdx ? 'next-goal' : ''}`}>
                    <div className="dg-info">
                      <span className="dg-name">
                        {idx === nextGoalIdx && <span className="dg-next-tag">Next up</span>}
                        {g.name}
                      </span>
                      <span className="dg-target text3">${Math.round(g.amount).toLocaleString('en-NZ')}</span>
                    </div>
                    <div className="dg-bar-wrap">
                      <div className="dg-bar">
                        <div className="dg-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="dg-pct">{pct}%</span>
                    </div>
                    {g._hitDate
                      ? <span className="dg-date teal">{g._hitDate}</span>
                      : <span className="dg-date" style={{ color: overdue ? 'var(--red)' : 'var(--text3)' }}>Beyond range</span>
                    }
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-icon small" onClick={() => { setGoalForm({ ...g }); setEditing(g.id); }}><Icon name="pencil" size={10} /></button>
                      <button className="btn-icon small danger" onClick={() => removeGoal(g.id)}><Icon name="trash" size={10} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {(state.goals || []).length === 0 && (
          <div className="traj-empty">
            <span className="text3">No goals yet —</span>
            <button className="btn-ghost small" onClick={openGoal}>add a savings target</button>
          </div>
        )}
      </div>

      {/* ── EXPENSES ────────────────────────────────────────────────────── */}
      {state.expenses.length > 0 && (
        <div className="dash-section">
          <div className="section-header">
            <h3>Expenses</h3>
            <span className="text3" style={{ fontSize: 11 }}>{fmtMoneyRound(fnExpenses * 26)}/yr</span>
          </div>

          <div className="fn-summary">
            <div className="fns-item">
              <span>Fortnightly</span>
              <span className="mono red">{fmtMoneyRound(fnExpenses)}</span>
            </div>
            <div className="fns-item">
              <span>Monthly</span>
              <span className="mono red">{fmtMoneyRound(fnExpenses * 26 / 12)}</span>
            </div>
            <div className="fns-item">
              <span>Annual</span>
              <span className="mono red">{fmtMoneyRound(fnExpenses * 26)}</span>
            </div>
          </div>

          <div className="cat-proportion-wrap">
            <div className="cat-proportion">
              {EXPENSE_GROUPS.map(g => {
                const amt = groupTotals[g.id] || 0;
                if (!amt) return null;
                return <div key={g.id} className="cp-segment" title={`${g.label}: ${fmtMoneyRound(amt)}/fn`}
                  style={{ flex: amt, background: g.color }} />;
              })}
            </div>
            <div className="cat-legend">
              {EXPENSE_GROUPS.map(g => {
                const amt = groupTotals[g.id] || 0;
                if (!amt) return null;
                return (
                  <div key={g.id} className="cl-item" style={{ cursor: 'default' }}>
                    <div className="cl-dot" style={{ background: g.color }} />
                    <span className="cl-icon">{g.icon}</span>
                    <span className="cl-label">{g.label}</span>
                    <span className="cl-amt">{fmtMoneyRound(amt)}</span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* ── HOME LOANS ──────────────────────────────────────────────────── */}
      {loanExpenses.length > 0 && (
        <div className="dash-section">
          <div className="section-header">
            <h3>Home Loans</h3>
            <span className="text3" style={{ fontSize: 11 }}>
              {loanExpenses.length} loan{loanExpenses.length !== 1 ? 's' : ''} · {allFacilities.length} facilit{allFacilities.length !== 1 ? 'ies' : 'y'}
            </span>
          </div>

          <div className="fn-summary">
            <div className="fns-item">
              <span>Total Outstanding</span>
              <span className="mono red">{fmtMoneyRound(totalLoanBalance)}</span>
            </div>
            <div className="fns-item">
              <span>Repayment /fn</span>
              <span className="mono red">{fmtMoneyRound(totalLoanPayment)}</span>
            </div>
            <div className="fns-item">
              <span>Total Interest Left</span>
              <span className="mono amber">{fmtMoneyRound(totalLoanInterest)}</span>
            </div>
            {totalLoanBalance > 0 && totalLoanInterest > 0 && (
              <div className="fns-item">
                <span>Interest % of Repayments</span>
                <span className="mono amber">
                  {Math.round(totalLoanInterest / (totalLoanInterest + totalLoanBalance) * 100)}%
                </span>
              </div>
            )}
            {crossoverYear !== null && (
              <div className="fns-item">
                <span>Principal &gt; Interest</span>
                <span className="mono green">Year {crossoverYear}</span>
              </div>
            )}
          </div>

          {/* Two-chart grid */}
          {facilitySchedules.length > 0 && balanceDeclineData.length > 1 && (
            <div className="loan-charts-grid">

              {/* Chart A: Balance Decline by Facility */}
              <div className="loan-chart-card">
                <div className="loan-chart-title">Loan Balance Over Time</div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={balanceDeclineData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 2" stroke="rgba(0,0,0,0.06)" />
                    <XAxis dataKey="year"
                      tick={{ fill: '#86868B', fontSize: 9, fontFamily: 'var(--mono)' }}
                      tickFormatter={v => `Yr ${v}`} tickLine={false} axisLine={false} />
                    <YAxis
                      tick={{ fill: '#86868B', fontSize: 9, fontFamily: 'var(--mono)' }}
                      tickFormatter={fmtK} tickLine={false} axisLine={false} width={48} />
                    <Tooltip
                      formatter={(val, name) => {
                        const fi = parseInt(name.replace('f', ''));
                        const label = isNaN(fi) ? 'Total' : (facilitySchedules[fi]?.fac.label || facilitySchedules[fi]?.fac.rateType || `Facility ${fi + 1}`);
                        return [fmtMoneyRound(val), label];
                      }}
                      labelFormatter={v => `Year ${v}`}
                      contentStyle={TOOLTIP_STYLE}
                    />
                    {/* Half-way reference line */}
                    <ReferenceLine
                      y={Math.round(totalLoanBalance / 2)}
                      stroke="rgba(0,113,227,0.25)"
                      strokeDasharray="4 2"
                      label={{ value: '50%', fill: 'rgba(0,113,227,0.5)', fontSize: 9, position: 'insideTopRight' }}
                    />
                    {facilitySchedules.length > 1 ? (
                      /* Multiple facilities: show individual lines */
                      facilitySchedules.map((s, fi) => (
                        <Line key={fi} type="monotone" dataKey={`f${fi}`}
                          stroke={s.color} strokeWidth={2} dot={false}
                          name={s.fac.label || s.fac.rateType || `Facility ${fi + 1}`}
                        />
                      ))
                    ) : (
                      /* Single facility: show one line */
                      <Line type="monotone" dataKey="f0"
                        stroke={facilitySchedules[0].color} strokeWidth={2.5} dot={false}
                        name={facilitySchedules[0].fac.label || 'Balance'}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
                {facilitySchedules.length > 1 && (
                  <div className="loan-legend">
                    {facilitySchedules.map((s, fi) => (
                      <div key={fi} className="loan-legend-item">
                        <div className="loan-legend-dot" style={{ background: s.color }} />
                        <span>{s.fac.label || s.fac.rateType || `Facility ${fi + 1}`} · {s.fac.rate}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Chart B: Annual P&I Split */}
              <div className="loan-chart-card">
                <div className="loan-chart-title">Annual Principal vs Interest</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={piSplitData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 2" stroke="rgba(0,0,0,0.06)" />
                    <XAxis dataKey="year"
                      tick={{ fill: '#86868B', fontSize: 9, fontFamily: 'var(--mono)' }}
                      tickFormatter={v => `Yr ${v}`} tickLine={false} axisLine={false} />
                    <YAxis
                      tick={{ fill: '#86868B', fontSize: 9, fontFamily: 'var(--mono)' }}
                      tickFormatter={fmtK} tickLine={false} axisLine={false} width={48} />
                    <Tooltip
                      formatter={(val, name) => [fmtMoneyRound(val), name === 'interest' ? 'Interest' : 'Principal']}
                      labelFormatter={v => `Year ${v}`}
                      contentStyle={TOOLTIP_STYLE}
                    />
                    {crossoverYear !== null && (
                      <ReferenceLine
                        x={crossoverYear}
                        stroke="rgba(52,199,89,0.5)"
                        strokeDasharray="4 2"
                        label={{ value: 'P>I', fill: 'var(--green)', fontSize: 9, position: 'insideTopLeft' }}
                      />
                    )}
                    <Bar dataKey="interest"  stackId="a" fill="rgba(255,59,48,0.75)"  name="interest"  radius={[0,0,0,0]} />
                    <Bar dataKey="principal" stackId="a" fill="rgba(0,113,227,0.75)"  name="principal" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="loan-legend">
                  <div className="loan-legend-item">
                    <div className="loan-legend-dot" style={{ background: 'rgba(255,59,48,0.75)' }} />
                    <span>Interest</span>
                  </div>
                  <div className="loan-legend-item">
                    <div className="loan-legend-dot" style={{ background: 'rgba(0,113,227,0.75)' }} />
                    <span>Principal</span>
                  </div>
                  {crossoverYear !== null && (
                    <div className="loan-legend-item">
                      <div className="loan-legend-dot" style={{ background: 'var(--green)' }} />
                      <span>Crossover: Year {crossoverYear}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Per-loan summary cards */}
          <div className="loan-summary-grid">
            {loanExpenses.map(loan => {
              const facs = (loan.facilities || []).filter(f => (+f.balance || 0) > 0 || (+f.rate || 0) > 0);
              const loanBal  = facs.reduce((s, f) => s + (+f.balance || 0), 0);
              const loanPmt  = facs.reduce((s, f) => s + (+f.amount  || 0), 0);
              const loanInt  = facs.reduce((s, f) => s + calcTotalInterest(+f.balance, +f.rate, +f.amount), 0);
              const terms    = facs.map(f => calcRemainingTerm(+f.balance, +f.rate, +f.amount)).filter(Boolean);
              const maxTerm  = terms.reduce((mx, t) => !mx || t.fortnights > mx.fortnights ? t : mx, null);
              const intPct   = loanBal > 0 ? Math.round(loanInt / (loanInt + loanBal) * 100) : 0;

              return (
                <div key={loan.id} className="loan-summary-card">
                  <div className="lsc-header">
                    <Icon name="mortgage" size={14} />
                    <span className="lsc-name">{loan.name}</span>
                    {loan.lender && <span className="tag">{loan.lender}</span>}
                  </div>
                  <div className="lsc-stats">
                    <div className="lsc-stat">
                      <span className="lsc-label">Outstanding</span>
                      <span className="mono red lsc-val">{fmtMoneyRound(loanBal)}</span>
                    </div>
                    <div className="lsc-stat">
                      <span className="lsc-label">Repayment /fn</span>
                      <span className="mono lsc-val">{fmtMoneyRound(loanPmt)}</span>
                    </div>
                    <div className="lsc-stat">
                      <span className="lsc-label">Interest Left</span>
                      <span className="mono amber lsc-val">{fmtMoneyRound(loanInt)}</span>
                    </div>
                    {maxTerm && (
                      <div className="lsc-stat">
                        <span className="lsc-label">Remaining Term</span>
                        <span className="mono lsc-val">
                          {maxTerm.years > 0 ? `${maxTerm.years}y ` : ''}{maxTerm.months}m
                        </span>
                      </div>
                    )}
                    {intPct > 0 && (
                      <div className="lsc-stat">
                        <span className="lsc-label">Interest % of Total</span>
                        <span className="mono amber lsc-val">{intPct}%</span>
                      </div>
                    )}
                    {maxTerm && (
                      <div className="lsc-stat">
                        <span className="lsc-label">Payoff Year</span>
                        <span className="mono green lsc-val">
                          {new Date().getFullYear() + Math.ceil(maxTerm.fortnights / 26)}
                        </span>
                      </div>
                    )}
                  </div>
                  {facs.length > 0 && (
                    <div className="lsc-facilities">
                      {facs.map((f, fi) => (
                        <div key={f.id || fi} className="lsc-fac">
                          <span className={`fac-type-dot ${f.rateType}`} />
                          <span className="lsc-fac-label">{f.label || f.rateType}</span>
                          {f.rate > 0 && <span className="tag amber">{f.rate}%</span>}
                          {f.balance > 0 && <span className="mono lsc-fac-bal">{fmtMoneyRound(+f.balance)}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {state.people.length === 0 && state.expenses.length === 0 && (
        <div className="empty-state">
          <div className="es-icon">◈</div>
          <div className="es-text">Welcome! Start by adding your income profile and expenses to see your financial picture.</div>
        </div>
      )}

      {showTransfer && (
        <TransferModal
          accounts={accounts}
          onClose={() => setShowTransfer(false)}
          onTransfer={(form) => addTransfer(form)}
        />
      )}

      {editing && (
        <div className="modal-overlay" onClick={closeGoal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing === 'new' ? 'Add Goal' : 'Edit Goal'}</h3>
              <button className="btn-icon" onClick={closeGoal}><Icon name="close" /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full">
                  <label>Goal Name</label>
                  <input className="input" placeholder="e.g. New Car" value={goalForm.name}
                    onChange={e => setGoalForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Target Amount ($)</label>
                  <input className="input mono" type="number" placeholder="0" value={goalForm.amount}
                    onChange={e => setGoalForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Target Date (optional)</label>
                  <input className="input" type="month" value={goalForm.targetDate}
                    onChange={e => setGoalForm(f => ({ ...f, targetDate: e.target.value }))} />
                </div>
                <div className="form-group full">
                  <label>Notes</label>
                  <input className="input" placeholder="Optional" value={goalForm.notes}
                    onChange={e => setGoalForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={closeGoal}>Cancel</button>
              <button className="btn-primary" onClick={saveGoal} disabled={!goalForm.name || !goalForm.amount}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
