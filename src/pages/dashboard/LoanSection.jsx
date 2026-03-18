import { useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { useMortgageFacilities, useAllLoanFacilities, useMortgageSummary, useMortgageAmortisation } from '../../store/hooks';
import { calcTotalInterest, calcRemainingTerm, calcSimpleRemainingTerm } from '../../utils/finance/mortgage';
import { toFortnightly } from '../../utils/finance/frequency';
import { fmtMoneyRound } from '../../utils/finance/tax';
import Icon from '../../components/Icon';
import { SectionHeader, StatTile, Card } from '../../components/ui';
import { RATE_COLORS } from '../../utils/colors';
import { TOOLTIP_STYLE, fmtK } from '../../utils/format';

export default function LoanSection() {
  // All facilities (including zero-rate/deferred) for totals display
  const { loanExpenses, facilities: allFacilities, hasLoans } = useAllLoanFacilities();
  // Rate > 0 facilities for amort charts
  const { facilities: amortFacilities } = useMortgageFacilities();
  const { totalBalance, repaymentFn, totalInterest, intPct, crossoverYear } = useMortgageSummary();
  const { balanceData: balanceDeclineData, piData: piSplitData } = useMortgageAmortisation();

  // Total outstanding across ALL facilities (projected)
  const allOutstanding = allFacilities.reduce((s, f) => s + ((f.currentBalance ?? +f.balance) || 0), 0);
  const allRepayment   = allFacilities.reduce((s, f) => s + f.amountFn, 0);

  if (!hasLoans) return null;

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
        <StatTile label="Total Outstanding" value={fmtMoneyRound(allOutstanding)} valueClassName="red" />
        <StatTile label="Repayment /fn"     value={fmtMoneyRound(allRepayment)} valueClassName="red" />
        {totalInterest > 0 && (
          <StatTile label="Total Interest Left" value={fmtMoneyRound(totalInterest)} valueClassName="amber" />
        )}
        {intPct > 0 && (
          <StatTile label="Interest % of Repayments" value={`${intPct}%`} valueClassName="amber" />
        )}
        {crossoverYear !== null && (
          <StatTile label="Principal > Interest" value={`Year ${crossoverYear}`} valueClassName="green" />
        )}
      </div>

      {/* Two-chart grid — rate > 0 facilities only */}
      {amortFacilities.length > 0 && balanceDeclineData.length > 1 && (
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
                    const label = isNaN(fi) ? 'Total' : (amortFacilities[fi]?.label || amortFacilities[fi]?.rateType || `Facility ${fi + 1}`);
                    return [fmtMoneyRound(val), label];
                  }}
                  labelFormatter={v => `Year ${v}`}
                  contentStyle={TOOLTIP_STYLE}
                />
                <ReferenceLine
                  y={Math.round(totalBalance / 2)}
                  stroke="rgba(0,113,227,0.25)"
                  strokeDasharray="4 2"
                  label={{ value: '50%', fill: 'rgba(0,113,227,0.5)', fontSize: 9, position: 'insideTopRight' }}
                />
                {amortFacilities.length > 1 ? (
                  amortFacilities.map((f, fi) => (
                    <Line key={fi} type="monotone" dataKey={`f${fi}`}
                      stroke={RATE_COLORS[f.rateType] || RATE_COLORS.default} strokeWidth={2} dot={false}
                      name={`f${fi}`}
                    />
                  ))
                ) : (
                  <Line type="monotone" dataKey="f0"
                    stroke={RATE_COLORS[amortFacilities[0]?.rateType] || RATE_COLORS.default} strokeWidth={2.5} dot={false}
                    name="f0"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
            {amortFacilities.length > 1 && (
              <div className="loan-legend">
                {amortFacilities.map((f, fi) => (
                  <div key={fi} className="loan-legend-item">
                    <div className="loan-legend-dot" style={{ background: RATE_COLORS[f.rateType] || RATE_COLORS.default }} />
                    <span>{f.label || f.rateType || `Facility ${fi + 1}`} · {f.rate}%</span>
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
          const facs = allFacilities.filter(f => f.loanId === loan.id);
          if (facs.length === 0) return null;
          const loanBal  = facs.reduce((s, f) => s + ((f.currentBalance ?? +f.balance) || 0), 0);
          const loanPmt  = facs.reduce((s, f) => s + f.amountFn, 0);
          const loanInt  = facs.reduce((s, f) => {
            const b = (f.currentBalance ?? +f.balance) || 0;
            return s + ((+f.rate || 0) > 0 ? calcTotalInterest(b, +f.rate, f.amountFn) : 0);
          }, 0);
          const terms = facs.map(f => {
            const b = (f.currentBalance ?? +f.balance) || 0;
            const r = +f.rate || 0;
            return r > 0
              ? calcRemainingTerm(b, r, f.amountFn)
              : calcSimpleRemainingTerm(b, f.amountFn);
          }).filter(Boolean);
          const maxTerm  = terms.reduce((mx, t) => !mx || t.fortnights > mx.fortnights ? t : mx, null);
          const loanIntPct = loanBal > 0 && loanInt > 0 ? Math.round(loanInt / (loanInt + loanBal) * 100) : 0;

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
                {loanPmt > 0 && (
                  <div className="lsc-stat">
                    <span className="lsc-label">Repayment /fn</span>
                    <span className="mono lsc-val">{fmtMoneyRound(loanPmt)}</span>
                  </div>
                )}
                {loanInt > 0 && (
                  <div className="lsc-stat">
                    <span className="lsc-label">Interest Left</span>
                    <span className="mono amber lsc-val">{fmtMoneyRound(loanInt)}</span>
                  </div>
                )}
                {maxTerm && (
                  <div className="lsc-stat">
                    <span className="lsc-label">Remaining Term</span>
                    <span className="mono lsc-val">
                      {maxTerm.years > 0 ? `${maxTerm.years}y ` : ''}{maxTerm.months}m
                    </span>
                  </div>
                )}
                {loanIntPct > 0 && (
                  <div className="lsc-stat">
                    <span className="lsc-label">Interest % of Total</span>
                    <span className="mono amber lsc-val">{loanIntPct}%</span>
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
                  {facs.map((f, fi) => {
                    const bal = (f.currentBalance ?? +f.balance) || 0;
                    const isZeroRate = (+f.rate || 0) <= 0;
                    return (
                      <div key={f.id || fi} className="lsc-fac">
                        <span className={`fac-type-dot ${isZeroRate ? 'interest-free' : f.rateType}`} />
                        <span className="lsc-fac-label">{f.label || f.rateType}</span>
                        {!isZeroRate && f.rate > 0 && <span className="tag amber">{f.rate}%</span>}
                        {isZeroRate && <span className="tag green">Interest-free</span>}
                        {bal > 0 && <span className="mono lsc-fac-bal">{fmtMoneyRound(bal)}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
