import { useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import {
  totalBalance, calcFortnightlyIncome, calcFortnightlyIncomeAt, calcFortnightlyExpenses, calcFortnightlyExpensesAt, calcFortnightlyAssetIncome, buildSavingsTrajectory, getPersonIncomeAt,
} from '../utils/finance/savings';
import { useFinance } from '../store/hooks';
import { usePeople }  from '../store/hooks';
import { fmtMoneyRound, calcNetPay } from '../utils/finance/tax';
import { buildAmortSchedule, calcTotalInterest, calcRemainingTerm } from '../utils/finance/mortgage';
import { toFortnightly } from '../utils/finance/frequency';
import { EXPENSE_GROUPS } from '../utils/categories';
import Icon from '../components/Icon';
import { SectionHeader, StatTile, EmptyState, Card } from '../components/ui';
import { RATE_COLORS } from '../utils/colors';
import { today } from '../utils/finance/dates';

import TrajTooltip from './dashboard/TrajTooltip';
import AccountCard from './dashboard/AccountCard';
import TransferModal from './dashboard/TransferModal';
import IncomeCard from './dashboard/IncomeCard';
import GoalsSection from './dashboard/GoalsSection';


const VIEW_LIMITS = { '1y': 13, '2y': 26, '3y': 39, '5y': 65 };

const fmtK = v => `$${(v / 1000).toFixed(0)}k`;

// ── Chart tooltip styles ─────────────────────────────────────────────────────
const TOOLTIP_STYLE = {
  background: 'rgba(255,255,255,0.97)',
  border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: 12, fontSize: 11,
  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
};

// ── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { accounts: rawAccounts, transfers, fortnightlyData, goals, assetIncomes, setFinance, updateAccount, addTransfer, removeTransfer } = useFinance();
  const { people, expenses } = usePeople();
  const [showTransfer, setShowTransfer] = useState(false);
  const [viewRange, setViewRange]       = useState('3y');

  const accounts      = rawAccounts || [];
  const netWorth      = totalBalance(accounts);
  const fnIncome      = calcFortnightlyIncome(people);       // base (no events)
  const fnAssetIncome = calcFortnightlyAssetIncome(assetIncomes || []);
  // Event-aware income for today
  const now            = new Date();
  const fnExpenses    = calcFortnightlyExpensesAt(expenses, now);
  const fnIncomeNow    = calcFortnightlyIncomeAt(people, now);
  const fnNet          = fnIncomeNow + fnAssetIncome - fnExpenses;
  const fnTotal        = fnIncomeNow + fnAssetIncome;
  const savingsRate    = fnTotal > 0 ? Math.round(fnNet / fnTotal * 100) : 0;
  const incomeEventActiveNow = Math.abs(fnIncomeNow - fnIncome) > 0.5;

  // ── Income ────────────────────────────────────────────────────────────────
  const incomeRows = useMemo(() => {
    const d = new Date();
    return people.map(p => {
      const { grossAnnual: effectiveGross, eventLabel, employer } = getPersonIncomeAt(p, d);
      const effectivePay = calcNetPay({ ...p, grossAnnual: effectiveGross });
      const basePay      = calcNetPay(p);
      return { ...p, _effectivePay: effectivePay, _basePay: basePay, _eventLabel: eventLabel, _employer: employer };
    });
  }, [people]);
  const totalGrossAnnual = incomeRows.reduce((s, p) => s + (p._effectivePay?.grossAnnual || p.grossAnnual || 0), 0);
  const totalNetAnnual   = fnIncomeNow * 26;
  const avgTaxRate       = totalGrossAnnual > 0
    ? incomeRows.reduce((s, p) => s + (p._effectivePay?.taxAnnual || 0), 0) / totalGrossAnnual * 100
    : 0;

  // ── Expenses ──────────────────────────────────────────────────────────────
  const groupTotals = useMemo(() => {
    const catTotals = {};
    expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + toFortnightly(e.amount, e.frequency); });
    const t = {};
    EXPENSE_GROUPS.forEach(g => { t[g.id] = g.cats.reduce((s, c) => s + (catTotals[c] || 0), 0); });
    return t;
  }, [expenses]);

  // ── Goals & Trajectory ────────────────────────────────────────────────────
  const trajectory = useMemo(() => buildSavingsTrajectory({ people, expenses, fortnightlyData, accounts, assetIncomes }), [people, expenses, fortnightlyData, accounts, assetIncomes]);

  const todayStr = today();
  const todayIdx = useMemo(() => {
    let idx = 0;
    for (let i = 0; i < trajectory.length; i++) {
      if (trajectory[i].date <= todayStr) idx = i;
      else break;
    }
    return idx;
  }, [trajectory, todayStr]);
  const todayLabel = trajectory[todayIdx]?.date.slice(0, 7);

  const allIncomeEvents = useMemo(() =>
    people.flatMap(p => (p.incomeEvents || []).filter(e => e.startDate)),
    [people]);

  const chartData = useMemo(() => {
    const limit  = VIEW_LIMITS[viewRange] ?? 36;
    const start  = Math.max(0, todayIdx - 2);
    const sliced = trajectory.slice(start, start + limit * 3); // enough fortnights to cover limit months

    // Group fortnights by YYYY-MM, then pick the median fortnight per month.
    // Using the median avoids the Jan-3-fortnights step imbalance without losing fortnightly accuracy.
    const byMonth = new Map();
    for (const p of sliced) {
      const month = p.date.slice(0, 7);
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month).push(p);
    }

    const result = [];
    for (const [month, fns] of byMonth) {
      if (result.length >= limit) break;
      const mid = fns[Math.floor(fns.length / 2)];
      const d   = new Date(mid.date);
      const activeEvent = allIncomeEvents.find(e =>
        new Date(e.startDate) <= d && (!e.endDate || new Date(e.endDate) > d)
      );
      const bal = Math.max(0, Math.round(mid.balance));
      result.push({ date: month, balance: bal, eventBalance: activeEvent ? bal : null });
    }
    return result;
  }, [trajectory, viewRange, todayIdx, allIncomeEvents]);

  const quarterlyTicks = useMemo(() =>
    chartData
      .filter(d => ['01', '04', '07', '10'].includes(d.date.slice(5, 7)))
      .map(d => d.date),
    [chartData]);

  const fmtQuarter = (dateStr) => {
    const [y, m] = dateStr.split('-').map(Number);
    return `Q${Math.ceil(m / 3)} ${y}`;
  };

  const goalsWithDates = useMemo(() => {
    return (goals || []).map(g => {
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
  }, [goals, trajectory]);

  const currentBal    = trajectory[todayIdx]?.balance ?? netWorth;
  const endIdx        = Math.min(trajectory.length - 1, todayIdx + (VIEW_LIMITS[viewRange] ?? 36));
  const projectedBal  = trajectory[endIdx]?.balance ?? 0;
  const projectedYear = trajectory[endIdx]?.date.slice(0, 4) ?? '2030';

  const nextGoalIdx = goalsWithDates.findIndex(g => currentBal < (g.amount || 0));

  // ── Loans ─────────────────────────────────────────────────────────────────
  const loanExpenses = useMemo(() => (expenses || []).filter(e => e.type === 'loan'), [expenses]);

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
    [...(transfers || [])].reverse().slice(0, 6), [transfers]);

  const accountName = (id) => accounts.find(a => a.id === id)?.name || id;

  return (
    <div className="page-content">
      {/* ── ACCOUNTS ────────────────────────────────────────────────────── */}
      <Card variant="section">
        <SectionHeader
          title={<><Icon name="bank" size={15} /> Accounts</>}
          actions={accounts.length > 1 && (
            <button className="btn-ghost small" onClick={() => setShowTransfer(true)}>
              <Icon name="swap" size={12} /> Transfer
            </button>
          )}
        />

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
                  <button className="btn-icon small" onClick={() => removeTransfer(tx.id)} title="Undo transfer" aria-label="Undo transfer">
                    <Icon name="close" size={10} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* ── INCOME ──────────────────────────────────────────────────────── */}
      {people.length > 0 && (
        <Card variant="section">
          <SectionHeader
            title={<><Icon name="arrow-up" size={15} /> Income</>}
            actions={<span className="text3" style={{ fontSize: 11 }}>{people.length} earner{people.length !== 1 ? 's' : ''}</span>}
          />

          <div className="fn-summary">
            <StatTile
              label="Employment /fn"
              value={fmtMoneyRound(fnIncomeNow)}
              valueClassName={incomeEventActiveNow ? 'amber' : 'green'}
              meta={incomeEventActiveNow ? `base ${fmtMoneyRound(fnIncome)}` : undefined}
            />
            {fnAssetIncome > 0 && (
              <StatTile label="Asset Income /fn" value={fmtMoneyRound(fnAssetIncome)} valueClassName="teal" />
            )}
            <StatTile label="Annual Gross" value={fmtMoneyRound(totalGrossAnnual)} />
            <StatTile label="Annual Net" value={fmtMoneyRound(totalNetAnnual)} valueClassName={incomeEventActiveNow ? 'amber' : 'green'} />
            <StatTile label="Avg Tax Rate" value={`${avgTaxRate.toFixed(1)}%`} valueClassName="amber" />
          </div>

          <div className="income-grid">
            {incomeRows.map(p => <IncomeCard key={p.id} person={p} />)}
          </div>
        </Card>
      )}

      {/* ── SAVINGS TRAJECTORY ──────────────────────────────────────── */}
      <Card variant="section">
        <SectionHeader
          title={<><Icon name="wallet" size={15} /> Savings Trajectory</>}
          actions={goalsWithDates.length > 0 && (
            <span className="text3" style={{ fontSize: 11 }}>
              {goalsWithDates.filter(g => g._hitDate).length}/{goalsWithDates.length} goals achievable
            </span>
          )}
        />

        <div className="fn-summary">
          <StatTile label="Current Balance" value={`$${Math.round(currentBal).toLocaleString('en-NZ')}`} valueClassName="teal" />
          <StatTile label={`Projected ${projectedYear}`} value={`$${Math.round(projectedBal).toLocaleString('en-NZ')}`} valueClassName="green" />
          {fnIncome > 0 && (
            <StatTile
              label="Savings Rate"
              value={`${savingsRate}%`}
              valueClassName={savingsRate >= 20 ? 'green' : savingsRate >= 10 ? 'amber' : 'red'}
            />
          )}
          <StatTile label="Goals Set" value={(goals || []).length} />
        </div>

        <div className="chart-card-inline">
          <div className="chart-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="chart-title">Projected Balance</span>
              {allIncomeEvents.length > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#FF9F0A', fontWeight: 600 }}>
                  <span style={{ width: 18, height: 2, background: '#FF9F0A', borderRadius: 1, display: 'inline-block', opacity: 0.7 }} />
                  income event
                </span>
              )}
            </div>
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
                <linearGradient id="eventGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#FF9F0A" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#FF9F0A" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="date"
                ticks={quarterlyTicks}
                tickFormatter={fmtQuarter}
                tick={{ fill: '#86868B', fontSize: 10 }}
                tickLine={false} axisLine={false} />
              <YAxis
                tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                tick={{ fill: '#86868B', fontSize: 10 }}
                tickLine={false} axisLine={false} width={52}
                domain={[0, 'auto']} />
              <Tooltip content={<TrajTooltip goals={goalsWithDates} people={people} />} />
              {todayLabel && (
                <ReferenceLine x={todayLabel} stroke="rgba(0,113,227,0.4)" strokeDasharray="4 4"
                  label={{ value: 'Today', position: 'insideTopRight', fill: 'rgba(0,113,227,0.6)', fontSize: 9 }} />
              )}
              {goalsWithDates.filter(g => g._hitDate).map(g => (
                <ReferenceLine key={g.id} x={g._hitDate} stroke="#ffd60a" strokeDasharray="4 4"
                  label={{ value: g.name, position: 'top', fill: '#b8960a', fontSize: 9 }} />
              ))}
              {/* Income event start/end boundaries */}
              {(() => {
                const startCount = {}; const endCount = {};
                allIncomeEvents.forEach(e => {
                  const s = e.startDate?.slice(0, 7); const en = e.endDate?.slice(0, 7);
                  if (s)  startCount[s]  = (startCount[s]  || 0) + 1;
                  if (en) endCount[en]   = (endCount[en]   || 0) + 1;
                });
                const startSeen = {}; const endSeen = {};
                return allIncomeEvents.flatMap((e, i) => {
                  const lines = [];
                  const startMonth = e.startDate?.slice(0, 7);
                  const endMonth   = e.endDate?.slice(0, 7);
                  const txt = (e.label || 'Event').length > 12 ? (e.label || 'Event').slice(0, 11) + '…' : (e.label || 'Event');
                  if (startMonth) {
                    const slot = startSeen[startMonth] || 0;
                    startSeen[startMonth] = slot + 1;
                    lines.push(
                      <ReferenceLine key={`evs-${i}`} x={startMonth}
                        stroke="#FF9F0A" strokeWidth={1.5} strokeOpacity={0.7} strokeDasharray="4 3"
                        label={({ viewBox }) => {
                          const { x, y } = viewBox;
                          return <text x={x + 4} y={y + 12 + slot * 12} fill="#FF9F0A" fontSize={9} fontWeight={700} textAnchor="start">⚑ {txt}</text>;
                        }} />
                    );
                  }
                  if (endMonth) {
                    const slot = endSeen[endMonth] || 0;
                    endSeen[endMonth] = slot + 1;
                    lines.push(
                      <ReferenceLine key={`eve-${i}`} x={endMonth}
                        stroke="#FF9F0A" strokeWidth={1} strokeOpacity={0.5} strokeDasharray="2 4"
                        label={({ viewBox }) => {
                          const { x, y } = viewBox;
                          return <text x={x - 4} y={y + 12 + slot * 12} fill="#FF9F0A" fontSize={9} fontWeight={700} textAnchor="end">{txt} ends</text>;
                        }} />
                    );
                  }
                  return lines;
                });
              })()}
              <Area type="monotone" dataKey="balance"
                stroke="#0071E3" strokeWidth={2} fill="url(#balGrad)"
                dot={false} activeDot={{ r: 4, fill: '#0071E3', strokeWidth: 0 }} />
              {/* Income event overlay — amber area over event periods */}
              {allIncomeEvents.length > 0 && (
                <Area type="monotone" dataKey="eventBalance"
                  stroke="#FF9F0A" strokeWidth={2} strokeOpacity={0.7}
                  fill="url(#eventGrad)"
                  dot={false} activeDot={false}
                  connectNulls={false} isAnimationActive={false} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Income events affecting this trajectory */}
        {people.some(p => (p.incomeEvents || []).length > 0) && (() => {
          const events = people.flatMap(p =>
            (p.incomeEvents || []).filter(e => e.startDate).map(e => ({ ...e, personName: p.name }))
          );
          if (!events.length) return null;
          return (
            <div className="traj-events">
              {events.map(e => {
                const isActive = new Date(e.startDate) <= now && (!e.endDate || new Date(e.endDate) > now);
                return (
                  <div key={e.id} className={`traj-event-row ${isActive ? 'active' : ''}`}>
                    <span className="traj-event-dot" style={{ background: isActive ? '#FF9F0A' : 'var(--text3)' }} />
                    <span className="traj-event-label">{e.label || 'Income event'}</span>
                    <span className="traj-event-person text3">{e.personName}</span>
                    <span className="traj-event-dates text3 mono">
                      {e.startDate?.slice(0, 7)}{e.endDate ? ` → ${e.endDate.slice(0, 7)}` : ' → ongoing'}
                    </span>
                    {isActive && <span className="fn-badge event-badge" style={{ marginLeft: 'auto' }}>Active</span>}
                  </div>
                );
              })}
            </div>
          );
        })()}

        <GoalsSection
          goals={goals}
          goalsWithDates={goalsWithDates}
          currentBal={currentBal}
          nextGoalIdx={nextGoalIdx}
          setFinance={setFinance}
        />
      </Card>

      {/* ── EXPENSES ────────────────────────────────────────────────────── */}
      {expenses.length > 0 && (
        <Card variant="section">
          <SectionHeader
            title={<><Icon name="tag" size={15} /> Expenses</>}
            actions={<span className="text3" style={{ fontSize: 11 }}>{fmtMoneyRound(fnExpenses * 26)}/yr</span>}
          />

          <div className="fn-summary">
            <StatTile label="Fortnightly" value={fmtMoneyRound(fnExpenses)} valueClassName="red" />
            <StatTile label="Monthly"     value={fmtMoneyRound(fnExpenses * 26 / 12)} valueClassName="red" />
            <StatTile label="Annual"      value={fmtMoneyRound(fnExpenses * 26)} valueClassName="red" />
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

        </Card>
      )}

      {/* ── HOME LOANS ──────────────────────────────────────────────────── */}
      {loanExpenses.length > 0 && (
        <Card variant="section">
          <SectionHeader
            title={<><Icon name="mortgage" size={15} /> Home Loans</>}
            actions={
              <span className="text3" style={{ fontSize: 11 }}>
                {loanExpenses.length} loan{loanExpenses.length !== 1 ? 's' : ''} · {allFacilities.length} facilit{allFacilities.length !== 1 ? 'ies' : 'y'}
              </span>
            }
          />

          <div className="fn-summary">
            <StatTile label="Total Outstanding" value={fmtMoneyRound(totalLoanBalance)} valueClassName="red" />
            <StatTile label="Repayment /fn"     value={fmtMoneyRound(totalLoanPayment)} valueClassName="red" />
            <StatTile label="Total Interest Left" value={fmtMoneyRound(totalLoanInterest)} valueClassName="amber" />
            {totalLoanBalance > 0 && totalLoanInterest > 0 && (
              <StatTile
                label="Interest % of Repayments"
                value={`${Math.round(totalLoanInterest / (totalLoanInterest + totalLoanBalance) * 100)}%`}
                valueClassName="amber"
              />
            )}
            {crossoverYear !== null && (
              <StatTile label="Principal > Interest" value={`Year ${crossoverYear}`} valueClassName="green" />
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
        </Card>
      )}

      {/* Empty state */}
      {people.length === 0 && expenses.length === 0 && (
        <EmptyState
          icon="◈"
          title="Welcome! Start by adding your income profile and expenses to see your financial picture."
        />
      )}

      {showTransfer && (
        <TransferModal
          accounts={accounts}
          onClose={() => setShowTransfer(false)}
          onTransfer={(form) => addTransfer(form)}
        />
      )}
    </div>
  );
}
