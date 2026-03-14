import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, ReferenceLine, Tooltip, ResponsiveContainer,
} from 'recharts';
import { fmtMoneyRound } from '../../utils/finance/tax';

/**
 * BalanceTrendChart — the main balance-over-fortnights area chart from FinancialTracking.
 *
 * Props:
 *   sparkData      — array of { n, b, adhoc, eventBalance }
 *   currentFnIdx   — index of "now" fortnight (-1 if not current year)
 *   incomeMarkers  — { areas: [], lines: [] } from parent
 *   fortnights     — the 26-fortnight row array (for tooltip data)
 *   fnIncome       — base fortnightly income (for event detection)
 *   isPastYear     — boolean
 *   balDelta       — number
 */
export default function BalanceTrendChart({
  sparkData, currentFnIdx, incomeMarkers,
  fortnights, fnIncome, isPastYear, balDelta,
}) {
  return (
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
          {/* Employment role-start lines */}
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
  );
}
