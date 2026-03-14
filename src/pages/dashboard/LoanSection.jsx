import { useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { buildAmortSchedule, calcTotalInterest, calcRemainingTerm } from '../../utils/finance/mortgage';
import { fmtMoneyRound } from '../../utils/finance/tax';
import Icon from '../../components/Icon';
import { SectionHeader, StatTile, Card } from '../../components/ui';
import { RATE_COLORS } from '../../utils/colors';
import { TOOLTIP_STYLE, fmtK } from '../../utils/format';

export default function LoanSection({ loanExpenses, allFacilities }) {
  const totalLoanBalance  = allFacilities.reduce((s, f) => s + (+f.balance || 0), 0);
  const totalLoanPayment  = allFacilities.reduce((s, f) => s + (+f.amount || 0), 0);
  const totalLoanInterest = useMemo(() =>
    allFacilities.reduce((s, f) => s + calcTotalInterest(+f.balance, +f.rate, +f.amount), 0),
    [allFacilities]);

  const facilitySchedules = useMemo(() =>
    allFacilities.map(f => ({
      fac: f,
      color: RATE_COLORS[f.rateType] || RATE_COLORS.default,
      data: buildAmortSchedule(+f.balance, +f.rate, +f.amount),
    })), [allFacilities]);

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

  const piSplitData = useMemo(() => {
    if (facilitySchedules.length === 0) return [];
    const maxLen = Math.max(...facilitySchedules.map(s => s.data.length));
    return Array.from({ length: maxLen }, (_, i) => ({
      year: i,
      interest:  Math.round(facilitySchedules.reduce((sum, s) => sum + (i < s.data.length ? (s.data[i].annualInterest  || 0) : 0), 0)),
      principal: Math.round(facilitySchedules.reduce((sum, s) => sum + (i < s.data.length ? (s.data[i].annualPrincipal || 0) : 0), 0)),
    })).filter(d => d.year > 0);
  }, [facilitySchedules]);

  const crossoverYear = useMemo(() => {
    const found = piSplitData.find(d => d.principal > d.interest);
    return found?.year ?? null;
  }, [piSplitData]);

  return (
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
                <ReferenceLine
                  y={Math.round(totalLoanBalance / 2)}
                  stroke="rgba(0,113,227,0.25)"
                  strokeDasharray="4 2"
                  label={{ value: '50%', fill: 'rgba(0,113,227,0.5)', fontSize: 9, position: 'insideTopRight' }}
                />
                {facilitySchedules.length > 1 ? (
                  facilitySchedules.map((s, fi) => (
                    <Line key={fi} type="monotone" dataKey={`f${fi}`}
                      stroke={s.color} strokeWidth={2} dot={false}
                      name={s.fac.label || s.fac.rateType || `Facility ${fi + 1}`}
                    />
                  ))
                ) : (
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
  );
}
