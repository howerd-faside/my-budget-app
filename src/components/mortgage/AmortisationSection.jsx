import { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { useMortgageAmortisation } from '../../store/hooks';
import Icon from '../Icon';
import { SectionHeader, Card } from '../ui';
import { fmtMoney } from '../../utils/finance/tax';
import { RATE_COLORS } from '../../utils/colors';
import { TOOLTIP_STYLE, fmtK } from '../../utils/format';

// ── Section wrapper ──────────────────────────────────────────────────────────

export default function AmortisationSection() {
  const [mode, setMode] = useState('balance');
  const { facilities, balanceData, piData, hasData } = useMortgageAmortisation();

  const crossoverIdx = piData.find(d => d.principal > d.interest)?.year ?? null;

  return (
    <Card variant="section">
      <SectionHeader
        title={<><Icon name="mortgage" size={15} /> Amortisation</>}
        actions={<div className="filter-tabs">
          <button
            className={`filter-tab ${mode === 'balance' ? 'active' : ''}`}
            onClick={() => setMode('balance')}
          >
            Balance Over Time
          </button>
          <button
            className={`filter-tab ${mode === 'pi' ? 'active' : ''}`}
            onClick={() => setMode('pi')}
          >
            Principal vs Interest
          </button>
        </div>}
      />

      {!hasData ? (
        <div style={{ color: 'var(--text3)', fontSize: 13, padding: '4px 0' }}>
          No amortisation data — add loan facilities with balance, rate, and repayment amount.
        </div>
      ) : (
        <div className="loan-chart-card">
          {mode === 'balance' ? (
            <BalanceChart facilities={facilities} balanceData={balanceData} />
          ) : (
            <PIChart piData={piData} crossoverIdx={crossoverIdx} />
          )}
        </div>
      )}
    </Card>
  );
}

// ── Balance over time ────────────────────────────────────────────────────────

function BalanceChart({ facilities, balanceData }) {
  return (
    <>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={balanceData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="rgba(0,0,0,0.06)" />
          <XAxis
            dataKey="year"
            tick={{ fill: '#86868B', fontSize: 9, fontFamily: 'var(--mono)' }}
            tickFormatter={v => `Yr ${v}`}
            tickLine={false} axisLine={false}
          />
          <YAxis
            tick={{ fill: '#86868B', fontSize: 9, fontFamily: 'var(--mono)' }}
            tickFormatter={fmtK} tickLine={false} axisLine={false} width={48}
          />
          <Tooltip
            formatter={(val, name) => {
              const fi = parseInt(name.replace('f', ''), 10);
              const label = isNaN(fi)
                ? 'Total'
                : (facilities[fi]?.label || facilities[fi]?.rateType || `Facility ${fi + 1}`);
              return [fmtMoney(val), label];
            }}
            labelFormatter={v => `Year ${v}`}
            contentStyle={TOOLTIP_STYLE}
          />
          {facilities.length > 1 ? (
            facilities.map((f, fi) => (
              <Line
                key={fi} type="monotone" dataKey={`f${fi}`}
                stroke={RATE_COLORS[f.rateType] || RATE_COLORS.default}
                strokeWidth={2} dot={false} name={`f${fi}`}
              />
            ))
          ) : (
            <Line
              type="monotone" dataKey="f0"
              stroke={RATE_COLORS[facilities[0]?.rateType] || RATE_COLORS.default}
              strokeWidth={2.5} dot={false} name="f0"
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {facilities.length > 1 && (
        <div className="loan-legend">
          {facilities.map((f, fi) => (
            <div key={fi} className="loan-legend-item">
              <div
                className="loan-legend-dot"
                style={{ background: RATE_COLORS[f.rateType] || RATE_COLORS.default }}
              />
              <span>{f.label || f.rateType || `Facility ${fi + 1}`} · {f.rate}%</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Principal vs Interest ────────────────────────────────────────────────────

function PIChart({ piData, crossoverIdx }) {
  return (
    <>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={piData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="rgba(0,0,0,0.06)" />
          <XAxis
            dataKey="year"
            tick={{ fill: '#86868B', fontSize: 9, fontFamily: 'var(--mono)' }}
            tickFormatter={v => `Yr ${v}`}
            tickLine={false} axisLine={false}
          />
          <YAxis
            tick={{ fill: '#86868B', fontSize: 9, fontFamily: 'var(--mono)' }}
            tickFormatter={fmtK} tickLine={false} axisLine={false} width={48}
          />
          <Tooltip
            formatter={(val, name) => [fmtMoney(val), name === 'interest' ? 'Interest' : 'Principal']}
            labelFormatter={v => `Year ${v}`}
            contentStyle={TOOLTIP_STYLE}
          />
          {crossoverIdx !== null && (
            <ReferenceLine
              x={crossoverIdx}
              stroke="rgba(52,199,89,0.5)" strokeDasharray="4 2"
              label={{ value: 'P>I', fill: 'var(--green)', fontSize: 9, position: 'insideTopLeft' }}
            />
          )}
          <Bar dataKey="interest"  stackId="a" fill="rgba(255,59,48,0.75)"  radius={[0, 0, 0, 0]} name="interest"  />
          <Bar dataKey="principal" stackId="a" fill="rgba(0,113,227,0.75)"  radius={[3, 3, 0, 0]} name="principal" />
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
        {crossoverIdx !== null && (
          <div className="loan-legend-item">
            <div className="loan-legend-dot" style={{ background: 'var(--green)' }} />
            <span>P &gt; I: Year {crossoverIdx}</span>
          </div>
        )}
      </div>
    </>
  );
}
