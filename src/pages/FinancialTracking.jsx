import { useState, useMemo } from 'react';
import { useApp, calcFortnightlyIncome, calcFortnightlyExpenses, calcFortnightlyExpensesAt, calcFortnightlyAssetIncome, calcFortnightlyIncomeAt, getFortnight, totalBalance, buildSavingsTrajectory } from '../store';
import { fmtMoney, fmtMoneyRound } from '../utils/tax';
import { ADHOC_EXPENSE_CATS } from '../utils/categories';
import Icon from '../components/Icon';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';

const EXPENSE_CATS  = ADHOC_EXPENSE_CATS;
const INCOME_CATS   = ['Bonus', 'Commission', 'Tax Refund', 'Side Income', 'Gift Received', 'Other Income'];
const YEAR_WINDOW   = 7;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function uid() { return Math.random().toString(36).slice(2, 9); }

export default function FinancialTracking() {
  const { state, updateFortnight: updFn } = useApp();
  const thisYear = new Date().getFullYear();
  const [year,         setYear]         = useState(thisYear);
  const [windowStart,  setWindowStart]  = useState(thisYear);
  const [yearAnimKey,  setYearAnimKey]  = useState(0);
  const [yearSlideDir, setYearSlideDir] = useState(0);
  const [txModal, setTxModal] = useState(null);
  const [txType, setTxType]   = useState('expense');
  const [txForm, setTxForm]   = useState({ description: '', amount: '', category: 'Other', note: '' });

  const fnIncome      = calcFortnightlyIncome(state.people);       // base (no events)
  const fnAssetIncome = calcFortnightlyAssetIncome(state.assetIncomes || []);
  const fnExpenses    = calcFortnightlyExpenses(state.expenses);

  // Event-aware income for right now (used by summary tile + incomeEventActive flag)
  const now           = new Date();
  const fnIncomeNow   = calcFortnightlyIncomeAt(state.people, now);
  const fnNet         = fnIncomeNow + fnAssetIncome - fnExpenses;   // today's effective net
  const fnNetBase     = fnIncome + fnAssetIncome - fnExpenses;      // base (no events)
  const incomeEventActiveNow = Math.abs(fnIncomeNow - fnIncome) > 0.5;

  const startBal   = totalBalance(state.accounts);
  const trajectory = useMemo(() => buildSavingsTrajectory(state), [state]);

  const yd = state.fortnightlyData[year] || { fortnights: {} };

  const fortnights = useMemo(() => {
    const now        = new Date();
    const thisYear   = now.getFullYear();
    const isPast     = year < thisYear;

    const rows = Array.from({ length: 26 }, (_, i) => {
      const { start, end } = getFortnight(year, i);
      const ftData         = (yd.fortnights || {})[i] || { adhocTransactions: [] };
      const adhoc          = (ftData.adhocTransactions || []).reduce((s, t) => s + (t.amount || 0), 0);
      const midDate        = new Date((start.getTime() + end.getTime()) / 2);
      // Date-aware income (events) and expenses (startDate) per fortnight
      const fnIncomeAt     = calcFortnightlyIncomeAt(state.people, midDate);
      const fnExpensesAt   = calcFortnightlyExpensesAt(state.expenses, midDate);
      const actual         = fnIncomeAt + fnAssetIncome - fnExpensesAt + adhoc;
      return { i, start, end, adhoc, actual, fnIncomeAt, fnExpensesAt, ftData, balance: 0 };
    });

    const curIdx = year === thisYear
      ? rows.findIndex(f => now >= f.start && now <= f.end)
      : -1;

    if (curIdx >= 0) {
      // Current year: anchor to today's real balance, project out in both directions
      rows[curIdx].balance = startBal;
      for (let i = curIdx + 1; i < 26; i++)
        rows[i].balance = rows[i - 1].balance + rows[i].actual;
      for (let i = curIdx - 1; i >= 0; i--)
        rows[i].balance = rows[i + 1].balance - rows[i + 1].actual;
    } else if (isPast) {
      // Past years: start at 0 (relative baseline), accumulate date-aware income/expenses
      rows[0].balance = rows[0].actual;
      for (let i = 1; i < 26; i++)
        rows[i].balance = rows[i - 1].balance + rows[i].actual;
    } else {
      // Future year: carry forward from trajectory projection
      const firstStart = rows[0].start.toISOString().slice(0, 10);
      let openBal = startBal;
      for (const p of trajectory) {
        if (p.date < firstStart) openBal = Math.round(p.balance);
        else break;
      }
      rows[0].balance = openBal + rows[0].actual;
      for (let i = 1; i < 26; i++)
        rows[i].balance = rows[i - 1].balance + rows[i].actual;
    }

    return rows;
  }, [year, yd, state.expenses, fnAssetIncome, startBal, state.people, trajectory]);

  const today        = new Date();
  const isPastYear   = year < thisYear;
  const currentFnIdx = fortnights.findIndex(f => today >= f.start && today <= f.end);
  const yearAdhoc    = fortnights.reduce((s, f) => s + f.adhoc, 0);
  const yearTotal    = fortnights.reduce((s, f) => s + f.actual, 0);
  const closingBal   = fortnights[25]?.balance ?? 0;
  // Past years: balance starts at 0 (not today's balance), so delta is just the adhoc sum
  const balDelta     = isPastYear ? yearAdhoc : closingBal - startBal;
  const windowYears  = Array.from({ length: YEAR_WINDOW }, (_, i) => windowStart + i);
  const selectedIdx  = windowYears.indexOf(year);
  const yearAnimClass = yearSlideDir > 0 ? 'anim-slide-right' : yearSlideDir < 0 ? 'anim-slide-left' : '';

  const changeYear = (newYear) => {
    if (newYear === year) return;
    setYearSlideDir(newYear > year ? 1 : -1);
    setYearAnimKey(k => k + 1);
    setYear(newYear);
  };

  const shiftWindow = (dir) => setWindowStart(s => s + dir);

  // Year-representative income/expenses: use first fortnight of the year
  const fnIncomeForYear   = fortnights[0]?.fnIncomeAt   ?? fnIncomeNow;
  const fnExpensesForYear = fortnights[0]?.fnExpensesAt ?? fnExpenses;
  const fnNetForYear      = fnIncomeForYear + fnAssetIncome - fnExpensesForYear;
  const incomeEventInYear = state.people.some(p =>
    (p.incomeEvents || []).some(e =>
      e.startDate &&
      e.startDate.slice(0, 4) <= String(year) &&
      (!e.endDate || e.endDate.slice(0, 4) >= String(year))
    )
  );

  // Sparkline data — clamp past fortnights to 0 (backward projection can go negative)
  const sparkData = fortnights.map(f => {
    const isBefore = f.end < today;
    const raw = Math.round(f.balance);
    const bal = isBefore ? Math.max(0, raw) : raw;
    const inEvent = Math.abs(f.fnIncomeAt - fnIncome) > 0.5;
    return { n: f.i + 1, b: bal, adhoc: f.adhoc, eventBalance: inEvent ? bal : null };
  });

  // Income event periods (shaded areas) + employment role-start lines
  const incomeMarkers = useMemo(() => {

    const areas = [];  // { x1, x2, label, color }  — income event periods
    const lines = [];  // { n,  label, color }        — role-change start lines

    const yearStartStr = `${year}-01-01`;
    const yearEndStr   = `${year}-12-31`;

    for (const person of state.people) {
      for (const e of (person.incomeEvents || [])) {
        if (!e.startDate) continue;
        // Skip events that don't overlap this year at all
        if (e.startDate > yearEndStr) continue;
        if (e.endDate && e.endDate < yearStartStr) continue;

        const startD = new Date(e.startDate);
        // Find first active fortnight; clamp to fn1 if event started before this year
        const x1fn = fortnights.findIndex(f => startD <= f.end);
        const x1 = x1fn >= 0 ? x1fn + 1 : 1;
        // Find last active fortnight; clamp to fn26 if event extends beyond this year
        let x2 = 26;
        if (e.endDate) {
          const endD = new Date(e.endDate);
          const x2fn = fortnights.findLastIndex(f => endD > f.start);
          x2 = x2fn >= 0 ? x2fn + 1 : 0;
        }
        if (x2 >= x1) areas.push({ x1, x2, label: e.label || 'Income event', color: '#FF9F0A' });
      }
      for (const r of (person.employmentHistory || [])) {
        if (!r.startDate) continue;
        const d = new Date(r.startDate);
        const fnIdx = fortnights.findIndex(f => d >= f.start && d <= f.end);
        if (fnIdx >= 0) lines.push({ n: fnIdx + 1, label: r.employer || 'New role', color: '#0071E3' });
      }
    }
    // Deduplicate lines
    const seen = new Set();
    const dedupedLines = lines.filter(m => { const k = `${m.n}-${m.label}`; if (seen.has(k)) return false; seen.add(k); return true; });
    return { areas, lines: dedupedLines };
  }, [state.people, fortnights]);

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

  return (
    <div className="page-content">
      <div className="year-bar">
        <button className="year-nav-btn" onClick={() => shiftWindow(-1)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 3L5 8l5 5"/>
          </svg>
        </button>
        <div className="year-pills">
          {selectedIdx >= 0 && (
            <div
              className="year-pill-indicator"
              style={{ transform: `translateX(${selectedIdx * 100}%)` }}
            />
          )}
          {windowYears.map(y => (
            <button
              key={y}
              className={`year-pill ${year === y ? 'active' : ''}`}
              onClick={() => changeYear(y)}
            >{y}</button>
          ))}
        </div>
        <button className="year-nav-btn" onClick={() => shiftWindow(1)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3l5 5-5 5"/>
          </svg>
        </button>
      </div>

      <div key={yearAnimKey} className={`year-content ${yearAnimClass}`}>
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
          <span>Net /fn</span>
          <span className={`mono ${fnNetForYear >= 0 ? 'green' : 'red'}`}>{fmtMoneyRound(fnNetForYear)}</span>
          {incomeEventInYear && (
            <span className="text3" style={{ fontSize: 10 }}>base {fmtMoneyRound(fnNetBase)}</span>
          )}
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
        {!isPastYear && (
          <div className="fns-item">
            <span>Projected Dec {year}</span>
            <span className="mono teal">{fmtMoneyRound(closingBal)}</span>
            <span className={`trend-indicator ${balDelta >= 0 ? 'up' : 'down'}`}>
              {balDelta >= 0 ? '▲' : '▼'} {fmtMoneyRound(Math.abs(balDelta))}
            </span>
          </div>
        )}
      </div>

      {fnIncome === 0 && (
        <div className="warning-banner">
          No income set — add income profiles in the <strong>Income</strong> tab first.
        </div>
      )}
      {incomeEventInYear && (
        <div className="info-banner" style={{ marginBottom: 16 }}>
          Income events active in {year} — some fortnights show adjusted net income.
        </div>
      )}

      {/* Balance Trend chart */}
      <div className="chart-card-inline">
        <div className="chart-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="chart-title">Balance Trend</span>
            {incomeMarkers.areas.length > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#FF9F0A', fontWeight: 600 }}>
                <span style={{ width: 18, height: 2, background: '#FF9F0A', borderRadius: 1, display: 'inline-block', opacity: 0.7 }} />
                income event
              </span>
            )}
          </div>
          {!isPastYear && (
            <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: balDelta >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
              {balDelta >= 0 ? '+' : ''}{Math.round(balDelta / 1000).toFixed(1)}k by Dec
            </span>
          )}
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={sparkData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="trkBalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#0071E3" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#0071E3" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="eventGradTrk" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#FF9F0A" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#FF9F0A" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis dataKey="n" tick={{ fontSize: 10, fill: '#86868B' }} tickLine={false} axisLine={false} interval={3} tickFormatter={(v) => `#${v}`} />
            <YAxis tick={{ fontSize: 10, fill: '#86868B' }} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} domain={[0, 'auto']} />
            <Area
              type="monotone" dataKey="b"
              stroke="#0071E3" strokeWidth={2} isAnimationActive={false}
              fill="url(#trkBalGrad)"
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (!payload.adhoc) return <g key={`dot-${payload.n}`} />;
                const c = payload.adhoc > 0 ? '#34C759' : '#FF3B30';
                return <circle key={`dot-${payload.n}`} cx={cx} cy={cy} r={4} fill={c} stroke="white" strokeWidth={1.5} />;
              }}
              activeDot={{ r: 4, fill: '#0071E3', strokeWidth: 0 }}
            />
            <Area
              type="monotone" dataKey="eventBalance"
              stroke="#FF9F0A" strokeWidth={2} strokeOpacity={0.7}
              fill="url(#eventGradTrk)"
              dot={false} activeDot={false}
              connectNulls={false} isAnimationActive={false}
            />
            {currentFnIdx >= 0 && (
              <ReferenceLine x={currentFnIdx + 1} stroke="rgba(0,113,227,0.4)" strokeDasharray="4 4"
                label={{ value: 'Today', position: 'insideTopRight', fill: 'rgba(0,113,227,0.6)', fontSize: 9 }} />
            )}
            {/* Income event start/end boundary lines */}
            {(() => {
              const startSeen = {}; const endSeen = {};
              return incomeMarkers.areas.flatMap((a, i) => {
                const txt = a.label.length > 12 ? a.label.slice(0, 11) + '…' : a.label;
                const startSlot = startSeen[a.x1] || 0;
                startSeen[a.x1] = startSlot + 1;
                const lines = [
                  <ReferenceLine key={`evs-${i}`} x={a.x1}
                    stroke="#FF9F0A" strokeWidth={1.5} strokeOpacity={0.7} strokeDasharray="4 3"
                    label={({ viewBox }) => {
                      const { x, y } = viewBox;
                      return <text x={x + 4} y={y + 12 + startSlot * 12} fill="#FF9F0A" fontSize={9} fontWeight={700} textAnchor="start">⚑ {txt}</text>;
                    }} />,
                ];
                if (a.x2 < 26) {
                  const endKey = a.x2 + 1;
                  const endSlot = endSeen[endKey] || 0;
                  endSeen[endKey] = endSlot + 1;
                  lines.push(
                    <ReferenceLine key={`eve-${i}`} x={endKey}
                      stroke="#FF9F0A" strokeWidth={1} strokeOpacity={0.5} strokeDasharray="2 4"
                      label={({ viewBox }) => {
                        const { x, y } = viewBox;
                        return <text x={x - 4} y={y + 12 + endSlot * 12} fill="#FF9F0A" fontSize={9} fontWeight={700} textAnchor="end">{txt} ends</text>;
                      }} />
                  );
                }
                return lines;
              });
            })()}
            {/* Employment role-start lines — thin blue verticals */}
            {incomeMarkers.lines.map((m, i) => (
              <ReferenceLine
                key={`il-${i}`}
                x={m.n}
                stroke={m.color} strokeWidth={1} strokeOpacity={0.3} strokeDasharray="3 2"
                label={({ viewBox }) => {
                  const { x, y } = viewBox;
                  const txt = m.label.length > 14 ? m.label.slice(0, 13) + '…' : m.label;
                  return <text x={Math.max(x + 4, 4)} y={y + 14} fill={m.color} fontSize={8.5} fontWeight={600} fillOpacity={0.65}>{txt}</text>;
                }}
              />
            ))}
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const { b, adhoc } = payload[0].payload;
                const ft = fortnights[label - 1];
                const ftIncomeChanged = ft && Math.abs(ft.fnIncomeAt - fnIncome) > 0.5;
                const activeAreas = incomeMarkers.areas.filter(a => label >= a.x1 && label <= a.x2);
                const activeLine  = incomeMarkers.lines.find(m => m.n === label);
                return (
                  <div className="chart-tt">
                    <div className="tt-date">Fortnight #{label}</div>
                    <div className="tt-bal">${Math.round(b).toLocaleString('en-NZ')}</div>
                    {ftIncomeChanged && (
                      <div style={{ fontFamily: 'var(--mono)', color: '#FF9F0A', marginTop: 4, fontSize: 10 }}>
                        ⚑ income {fmtMoneyRound(ft.fnIncomeAt)} /fn
                      </div>
                    )}
                    {adhoc !== 0 && (
                      <div style={{ fontFamily: 'var(--mono)', color: adhoc > 0 ? 'var(--green)' : 'var(--red)', marginTop: 4, fontSize: 11 }}>
                        {adhoc > 0 ? '+' : '−'}${Math.abs(Math.round(adhoc)).toLocaleString('en-NZ')} ad-hoc
                      </div>
                    )}
                    {activeAreas.map((a, i) => (
                      <div key={i} style={{ color: a.color, marginTop: 4, fontSize: 10, fontWeight: 600 }}>⚑ {a.label}</div>
                    ))}
                    {activeLine && (
                      <div style={{ color: activeLine.color, marginTop: 4, fontSize: 10, fontWeight: 600 }}>→ {activeLine.label}</div>
                    )}
                  </div>
                );
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Income events list — filtered to events active within the selected year */}
      {(() => {
        const yearStart = `${year}-01-01`;
        const yearEnd   = `${year}-12-31`;
        const events = state.people.flatMap(p =>
          (p.incomeEvents || [])
            .filter(e => e.startDate && e.startDate <= yearEnd && (!e.endDate || e.endDate >= yearStart))
            .map(e => ({ ...e, personName: p.name }))
        );
        if (!events.length) return null;
        return (
          <div className="traj-events">
            {events.map(e => {
              const inYearNow = new Date(e.startDate) <= now && (!e.endDate || new Date(e.endDate) > now);
              return (
                <div key={e.id} className={`traj-event-row ${inYearNow ? 'active' : ''}`}>
                  <span className="traj-event-dot" style={{ background: inYearNow ? '#FF9F0A' : 'var(--text3)' }} />
                  <span className="traj-event-label">{e.label || 'Income event'}</span>
                  <span className="traj-event-person text3">{e.personName}</span>
                  <span className="traj-event-dates text3 mono">
                    {e.startDate?.slice(0, 7)}{e.endDate ? ` → ${e.endDate.slice(0, 7)}` : ' → ongoing'}
                  </span>
                  {inYearNow && <span className="fn-badge event-badge" style={{ marginLeft: 'auto' }}>Active now</span>}
                </div>
              );
            })}
          </div>
        );
      })()}

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
                    <div className="fn-dates-primary">
                      <span className="fn-label">{label}</span>
                      {isCurrent && <span className="fn-badge current-badge">Now</span>}
                      {txs.length > 0 && <span className="fn-badge tx-badge">{txs.length} extra</span>}
                    </div>
                    {incomeChanged && (
                      <div className="fn-event-note">⚑ {fmtMoneyRound(f.fnIncomeAt)} /fn</div>
                    )}
                  </div>
                </div>
                <div className="fn-right">
                  {f.adhoc !== 0 && (
                    <span className={`fn-adhoc ${f.adhoc >= 0 ? 'green' : 'red'}`}>{fmtMoney(f.adhoc)}</span>
                  )}
                  <span className={`fn-net ${(isPast && f.balance < 0) ? '' : f.actual >= 0 ? 'green' : 'red'}`}>{fmtMoneyRound(isPast && f.balance < 0 ? 0 : f.actual)}</span>
                  <span className="fn-balance">{fmtMoneyRound(isPast ? Math.max(0, f.balance) : f.balance)}</span>
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
      </div>{/* end year-content */}

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
