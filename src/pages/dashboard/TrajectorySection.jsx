import { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import Icon from '../../components/Icon';
import { SectionHeader, StatTile, Card } from '../../components/ui';
import TrajTooltip from './TrajTooltip';
import GoalsSection from './GoalsSection';

const VIEW_LIMITS = { '1y': 13, '2y': 26, '3y': 39, '5y': 65 };

export default function TrajectorySection({
  trajectory, todayIdx, todayLabel,
  people, goals, goalsWithDates,
  currentBal, fnIncome, savingsRate,
  setFinance,
}) {
  const [viewRange, setViewRange] = useState('3y');
  const now = new Date();

  const allIncomeEvents = useMemo(() =>
    people.flatMap(p => (p.incomeEvents || []).filter(e => e.startDate)),
    [people]);

  const chartData = useMemo(() => {
    const limit  = VIEW_LIMITS[viewRange] ?? 36;
    const start  = Math.max(0, todayIdx - 2);
    const sliced = trajectory.slice(start, start + limit * 3);

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

  const endIdx        = Math.min(trajectory.length - 1, todayIdx + (VIEW_LIMITS[viewRange] ?? 36));
  const projectedBal  = trajectory[endIdx]?.balance ?? 0;
  const projectedYear = trajectory[endIdx]?.date.slice(0, 4) ?? '2030';
  const nextGoalIdx   = goalsWithDates.findIndex(g => currentBal < (g.amount || 0));

  return (
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
  );
}
