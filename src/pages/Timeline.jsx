import { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { useApp, buildSavingsTrajectory, calcFortnightlyIncome, calcFortnightlyExpenses, calcFortnightlyAssetIncome } from '../store';
import { fmtMoneyRound } from '../utils/tax';
import Icon from '../components/Icon';

function uid() { return Math.random().toString(36).slice(2, 9); }

const EMPTY_GOAL = { name: '', amount: '', targetDate: '', notes: '' };
const VIEW_LIMITS = { '1y': 26, '2y': 52, '3y': 78, '5y': 130 };

const CustomTooltip = ({ active, payload, label, goals }) => {
  if (!active || !payload?.length) return null;
  const bal = payload[0]?.value;
  const hit = goals.filter(g => g._hitDate === label);
  return (
    <div className="chart-tt">
      <div className="tt-date">{label}</div>
      <div className="tt-bal">{fmtMoneyRound(bal)}</div>
      {hit.map(g => <div key={g.id} className="tt-goal">🎯 {g.name}</div>)}
    </div>
  );
};

// ── Main Timeline ──────────────────────────────────────────────────────────
export default function Timeline() {
  const { state, set } = useApp();
  const [editing, setEditing] = useState(null);
  const [form, setForm]       = useState(EMPTY_GOAL);
  const [viewRange, setViewRange] = useState('3y');

  const trajectory = useMemo(() => buildSavingsTrajectory(state), [state]);

  const fnIncome      = calcFortnightlyIncome(state.people);
  const fnAssetIncome = calcFortnightlyAssetIncome(state.assetIncomes || []);
  const fnExpenses    = calcFortnightlyExpenses(state.expenses);
  const fnNet         = fnIncome + fnAssetIncome - fnExpenses;
  const fnTotal       = fnIncome + fnAssetIncome;
  const savingsRate   = fnTotal > 0 ? Math.round(fnNet / fnTotal * 100) : 0;

  const todayStr  = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayIdx  = useMemo(() => {
    const i = trajectory.findIndex(p => p.date >= todayStr);
    return i >= 0 ? i : 0;
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

  const openNew = () => { setForm({ ...EMPTY_GOAL, id: uid() }); setEditing('new'); };
  const close   = () => { setEditing(null); setForm(EMPTY_GOAL); };

  const save = () => {
    const goal = { ...form, amount: +form.amount };
    if (editing === 'new') set('goals', [...(state.goals || []), goal]);
    else set('goals', (state.goals || []).map(g => g.id === form.id ? goal : g));
    close();
  };

  const remove = (id) => {
    if (confirm('Remove this goal?')) set('goals', (state.goals || []).filter(g => g.id !== id));
  };

  const currentBal   = trajectory[todayIdx]?.balance ?? state.settings?.currentBalance ?? 0;
  const endIdx       = Math.min(trajectory.length - 1, todayIdx + (VIEW_LIMITS[viewRange] ?? 78));
  const projectedBal = trajectory[endIdx]?.balance ?? 0;
  const projectedYear = trajectory[endIdx]?.date.slice(0, 4) ?? '2030';

  return (
    <div className="page-content">
      {/* Summary stats */}
      <div className="dash-section">
        <div className="section-header">
          <h3>Savings Overview</h3>
          {state.goals?.length > 0 && (
            <span className="text3" style={{ fontSize: 11 }}>{goalsWithDates.filter(g => g._hitDate).length}/{goalsWithDates.length} goals achievable</span>
          )}
        </div>
      <div className="fn-summary">
        <div className="fns-item">
          <span>Current Balance</span>
          <span className="mono teal">{fmtMoneyRound(currentBal)}</span>
        </div>
        <div className="fns-item">
          <span>Projected {projectedYear}</span>
          <span className="mono green">{fmtMoneyRound(projectedBal)}</span>
        </div>
        <div className="fns-item">
          <span>Goals Set</span>
          <span className="mono">{(state.goals || []).length}</span>
        </div>
        <div className="fns-item">
          <span>Goals Achievable</span>
          <span className="mono green">{goalsWithDates.filter(g => g._hitDate).length}</span>
        </div>
        {fnIncome > 0 && (
          <div className="fns-item">
            <span>Savings Rate</span>
            <span className={`mono ${savingsRate >= 20 ? 'green' : savingsRate >= 10 ? 'amber' : 'red'}`}>
              {savingsRate}%
            </span>
          </div>
        )}
      </div>
      </div>{/* end savings overview dash-section */}

      {/* Chart */}
      <div className="chart-card">
        <div className="chart-header">
          <span className="chart-title">Projected Savings Balance</span>
          <div className="range-tabs">
            {Object.keys(VIEW_LIMITS).map(r => (
              <button key={r} className={`range-tab ${viewRange === r ? 'active' : ''}`}
                onClick={() => setViewRange(r)}>{r}</button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#0071E3" stopOpacity={0.14} />
                <stop offset="95%" stopColor="#0071E3" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis dataKey="date"
              tick={{ fill: '#86868B', fontSize: 11, fontFamily: 'JetBrains Mono' }}
              tickLine={false} axisLine={false} />
            <YAxis
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
              tick={{ fill: '#86868B', fontSize: 11, fontFamily: 'JetBrains Mono' }}
              tickLine={false} axisLine={false} width={55} />
            <Tooltip content={<CustomTooltip goals={goalsWithDates} />} />
            {todayLabel && (
              <ReferenceLine x={todayLabel} stroke="rgba(0,113,227,0.4)" strokeDasharray="4 4"
                label={{ value: 'Today', position: 'insideTopRight', fill: 'rgba(0,113,227,0.6)', fontSize: 10, fontFamily: 'JetBrains Mono' }} />
            )}
            {goalsWithDates.filter(g => g._hitDate).map(g => (
              <ReferenceLine key={g.id} x={g._hitDate} stroke="#ffd60a" strokeDasharray="4 4"
                label={{ value: g.name, position: 'top', fill: '#ffd60a', fontSize: 10, fontFamily: 'JetBrains Mono' }} />
            ))}
            <Area type="monotone" dataKey="balance"
              stroke="#0071E3" strokeWidth={2} fill="url(#balGrad)"
              dot={false} activeDot={{ r: 4, fill: '#0071E3', strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Goals list */}
      {goalsWithDates.length > 0 && (
        <div className="section-card">
          <div className="section-header">
            <h3>Goals</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="text3" style={{ fontSize: 11 }}>
                {goalsWithDates.filter(g => g._hitDate).length}/{goalsWithDates.length} achievable
              </span>
              <button className="btn-ghost small" onClick={openNew}>+ Add Goal</button>
            </div>
          </div>
          <div className="goals-grid">
          {goalsWithDates.map(g => {
            const achieved = !!g._hitDate;
            const today    = new Date().toISOString().slice(0, 7);
            const overdue  = g.targetDate && g.targetDate < today && !achieved;
            const pct      = g.amount > 0 ? Math.min(100, Math.round((currentBal / g.amount) * 100)) : 0;

            return (
              <div key={g.id} className={`goal-card ${achieved ? 'achieved' : ''} ${overdue ? 'overdue' : ''}`}>
                <div className="goal-header">
                  <div className={`goal-status-icon ${achieved ? 'done' : overdue ? 'late' : ''}`}>
                    {achieved ? '✓' : overdue ? '!' : '◎'}
                  </div>
                  <div className="goal-info">
                    <span className="goal-name">{g.name}</span>
                    {g.notes && <span className="goal-notes">{g.notes}</span>}
                  </div>
                  <div className="goal-actions">
                    <button className="btn-icon" onClick={() => { setForm({ ...g }); setEditing(g.id); }}><Icon name="pencil" /></button>
                    <button className="btn-icon danger" onClick={() => remove(g.id)}><Icon name="trash" /></button>
                  </div>
                </div>

                {g.amount > 0 && (
                  <div className="goal-progress">
                    <div className="gp-bar">
                      <div className={`gp-fill ${achieved ? 'done' : ''}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="gp-pct">{pct}%</span>
                  </div>
                )}

                <div className="goal-numbers">
                  <div className="gn-item">
                    <span>Target</span>
                    <span className="mono">{fmtMoneyRound(g.amount)}</span>
                  </div>
                  <div className="gn-item">
                    <span>Projected</span>
                    <span className={`mono ${achieved ? 'green' : overdue ? 'red' : 'amber'}`}>
                      {g._hitDate || 'Beyond 2030'}
                    </span>
                  </div>
                  {g.targetDate && (
                    <div className="gn-item">
                      <span>Deadline</span>
                      <span className={`mono ${overdue ? 'red' : ''}`}>{g.targetDate}</span>
                    </div>
                  )}
                  {g._monthsRemaining !== null && g._monthsRemaining > 0 && (
                    <div className="gn-item">
                      <span>Time Left</span>
                      <span className="mono teal">
                        {g._monthsRemaining >= 12
                          ? `${Math.floor(g._monthsRemaining / 12)}y ${g._monthsRemaining % 12}m`
                          : `${g._monthsRemaining}m`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {(state.goals || []).length === 0 && (
        <div className="empty-state">
          <div className="es-icon">🎯</div>
          <div className="es-text">No goals yet — add a savings target and see when you'll hit it</div>
          <button className="btn-primary" onClick={openNew}>Add first goal</button>
        </div>
      )}

      {/* Modal */}
      {editing && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing === 'new' ? 'Add Goal' : 'Edit Goal'}</h3>
              <button className="btn-icon" onClick={close}><Icon name="close" /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full">
                  <label>Goal Name</label>
                  <input className="input" placeholder="e.g. New Car" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Target Amount ($)</label>
                  <input className="input mono" type="number" placeholder="0" value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Target Date (optional)</label>
                  <input className="input" type="month" value={form.targetDate}
                    onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))} />
                </div>
                <div className="form-group full">
                  <label>Notes</label>
                  <input className="input" placeholder="Optional" value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={close}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={!form.name || !form.amount}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
