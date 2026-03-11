import { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { usePeople } from '../store/hooks';
import { fmtMoneyRound } from '../utils/tax';
import {
  calcRemainingTerm, calcTotalInterest, calcEarlyRepaymentSavings,
  buildAmortSchedule, buildMonthlySchedule,
} from '../utils/mortgage';
import Icon from '../components/Icon';

const RATE_COLORS = { fixed: '#FF9F0A', floating: '#34C759', revolving: '#AF52DE', default: '#0071E3' };

const TOOLTIP_STYLE = {
  background: 'rgba(255,255,255,0.97)',
  border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: 12, fontSize: 11,
  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
};

const fmtK = v => `$${(v / 1000).toFixed(0)}k`;

// ── Facility detail card ─────────────────────────────────────────────────────
function FacilityCard({ facility }) {
  const [extra, setExtra] = useState('');
  const b  = +facility.balance || 0;
  const r  = +facility.rate    || 0;
  const fn = +facility.amount  || 0;

  const term     = useMemo(() => calcRemainingTerm(b, r, fn), [b, r, fn]);
  const interest = useMemo(() => calcTotalInterest(b, r, fn), [b, r, fn]);
  const savings  = useMemo(() => calcEarlyRepaymentSavings(b, r, fn, +extra || 0), [b, r, fn, extra]);
  const intPct   = b > 0 && interest > 0 ? Math.round(interest / (interest + b) * 100) : 0;

  // Monthly P&I schedule for this facility
  const annualData = useMemo(() => {
    if (!b || !r || !fn) return [];
    const monthly = buildMonthlySchedule(b, r, fn, 120);
    const byYear = {};
    const startYear = new Date().getFullYear();
    monthly.forEach(m => {
      const yr = startYear + m.year;
      if (!byYear[yr]) byYear[yr] = { label: String(yr), interest: 0, principal: 0, year: m.year };
      byYear[yr].interest  += m.interest;
      byYear[yr].principal += m.principal;
    });
    return Object.values(byYear);
  }, [b, r, fn]);

  // Annual amort for balance area chart
  const amortPoints = useMemo(() => {
    if (!b || !r || !fn) return [];
    return buildAmortSchedule(b, r, fn);
  }, [b, r, fn]);

  if (!b && !r && !fn) return null;

  const color = RATE_COLORS[facility.rateType] || RATE_COLORS.default;

  // Find crossover year (first year principal > interest)
  const crossoverYear = annualData.find(d => d.principal > d.interest)?.label ?? null;

  return (
    <div className="mfac-card">
      {/* Facility header */}
      <div className="mfac-header">
        <span className={`fac-type-dot ${facility.rateType}`} />
        <span className="mfac-label">
          {facility.label || facility.rateType || 'Facility'}
          {r > 0 && <span className="text3" style={{ fontWeight: 400, marginLeft: 6 }}>{r}% p.a. · {facility.rateType}</span>}
        </span>
        {facility.repaymentType && (
          <span className="tag">{facility.repaymentType}</span>
        )}
      </div>

      {/* Key stats grid */}
      <div className="mfac-stats">
        {b > 0 && (
          <div className="mfac-stat">
            <div className="mfac-stat-label">Outstanding</div>
            <div className="mfac-stat-val red">{fmtMoneyRound(b)}</div>
          </div>
        )}
        {fn > 0 && (
          <div className="mfac-stat">
            <div className="mfac-stat-label">Repayment /fn</div>
            <div className="mfac-stat-val">{fmtMoneyRound(fn)}</div>
          </div>
        )}
        {term && (
          <div className="mfac-stat">
            <div className="mfac-stat-label">Remaining Term</div>
            <div className="mfac-stat-val">{term.years > 0 ? `${term.years}y ` : ''}{term.months}m</div>
          </div>
        )}
        {interest > 0 && (
          <div className="mfac-stat">
            <div className="mfac-stat-label">Total Interest</div>
            <div className="mfac-stat-val amber">{fmtMoneyRound(interest)}</div>
          </div>
        )}
        {intPct > 0 && (
          <div className="mfac-stat">
            <div className="mfac-stat-label">Interest % of Total</div>
            <div className="mfac-stat-val amber">{intPct}%</div>
          </div>
        )}
        {crossoverYear && (
          <div className="mfac-stat">
            <div className="mfac-stat-label">Principal &gt; Interest</div>
            <div className="mfac-stat-val green">Year {crossoverYear}</div>
          </div>
        )}
      </div>

      {/* Annual P&I chart */}
      {annualData.length > 1 && (
        <div className="mfac-chart-wrap">
          <div className="mfac-chart-title">Annual Principal vs Interest</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={annualData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              barCategoryGap="20%">
              <CartesianGrid strokeDasharray="2 2" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis dataKey="label"
                tick={{ fill: '#86868B', fontSize: 9, fontFamily: 'var(--mono)' }}
                tickLine={false} axisLine={false} interval={0} />
              <YAxis
                tick={{ fill: '#86868B', fontSize: 9, fontFamily: 'var(--mono)' }}
                tickFormatter={fmtK} tickLine={false} axisLine={false} width={44} />
              <Tooltip
                formatter={(val, name) => [fmtMoneyRound(val), name === 'interest' ? 'Interest' : 'Principal']}
                labelFormatter={(label) => label}
                contentStyle={TOOLTIP_STYLE}
              />
              {crossoverYear && (
                <ReferenceLine x={crossoverYear}
                  stroke="rgba(52,199,89,0.5)" strokeDasharray="4 2"
                  label={{ value: 'P>I', fill: 'var(--green)', fontSize: 9, position: 'insideTopLeft' }}
                />
              )}
              <Bar dataKey="interest"  stackId="a" fill="rgba(255,59,48,0.7)"  radius={[0,0,0,0]} name="interest" />
              <Bar dataKey="principal" stackId="a" fill={color + 'cc'}         radius={[3,3,0,0]} name="principal" />
            </BarChart>
          </ResponsiveContainer>
          <div className="loan-legend">
            <div className="loan-legend-item">
              <div className="loan-legend-dot" style={{ background: 'rgba(255,59,48,0.7)' }} />
              <span>Interest</span>
            </div>
            <div className="loan-legend-item">
              <div className="loan-legend-dot" style={{ background: color }} />
              <span>Principal</span>
            </div>
            {crossoverYear && (
              <div className="loan-legend-item">
                <div className="loan-legend-dot" style={{ background: 'var(--green)' }} />
                <span>Crossover: Year {crossoverYear}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Balance decline chart */}
      {amortPoints.length > 1 && (
        <div className="mfac-chart-wrap" style={{ marginTop: 14 }}>
          <div className="mfac-chart-title">Balance Over Time</div>
          <ResponsiveContainer width="100%" height={130}>
            <ComposedChart data={amortPoints} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 2" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="year" tick={{ fill: '#86868B', fontSize: 9 }}
                tickFormatter={v => `Yr ${v}`} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#86868B', fontSize: 9 }}
                tickFormatter={fmtK} tickLine={false} axisLine={false} width={44} />
              <Tooltip
                formatter={(val, name) => [fmtMoneyRound(val),
                  name === 'balance' ? 'Balance' :
                  name === 'cumulativeInterest' ? 'Interest paid' : 'Principal paid']}
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={v => `Year ${v}`}
              />
              <ReferenceLine y={b / 2} stroke="rgba(0,0,0,0.12)" strokeDasharray="4 2"
                label={{ value: '50%', fill: '#86868B', fontSize: 8, position: 'insideTopRight' }} />
              <Area type="monotone" dataKey="balance" stroke={color} fill={color + '22'}
                strokeWidth={1.5} dot={false} name="balance" />
              <Bar dataKey="cumulativeInterest" fill="rgba(255,59,48,0.08)" name="cumulativeInterest" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Early repayment simulator */}
      {b > 0 && r > 0 && fn > 0 && term && (
        <div className="mc-early-repay">
          <div className="mc-er-label">Early Repayment Simulator</div>
          <div className="mc-er-row">
            <span className="text3" style={{ fontSize: 12 }}>Extra /fn:</span>
            <input
              className="input mono mc-er-input"
              type="number" step="50" placeholder="0"
              value={extra}
              onChange={e => setExtra(e.target.value)}
            />
          </div>
          {+extra > 0 && savings.savedMonths > 0 && (
            <div className="mc-er-result">
              Save <strong>{fmtMoneyRound(savings.savedInterest)}</strong> interest ·
              pay off <strong>{savings.savedMonths} months sooner</strong>
            </div>
          )}
          {+extra > 0 && savings.savedMonths === 0 && (
            <div className="mc-er-result text3">Extra payment too small to change term significantly.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Mortgage page ─────────────────────────────────────────────────────────────
export default function Mortgage() {
  const { expenses } = usePeople();

  const loanExpenses = useMemo(() =>
    (expenses || []).filter(e => e.type === 'loan'), [expenses]);

  const allFacilities = useMemo(() =>
    loanExpenses.flatMap(loan =>
      (loan.facilities || [])
        .filter(f => (+f.balance || 0) > 0 && (+f.rate || 0) > 0 && (+f.amount || 0) > 0)
        .map(f => ({ ...f, loanName: loan.name }))
    ), [loanExpenses]);

  const totalLoanBalance  = allFacilities.reduce((s, f) => s + (+f.balance || 0), 0);
  const totalLoanPayment  = allFacilities.reduce((s, f) => s + (+f.amount  || 0), 0);
  const totalLoanInterest = useMemo(() =>
    allFacilities.reduce((s, f) => s + calcTotalInterest(+f.balance, +f.rate, +f.amount), 0),
    [allFacilities]);

  const facilitySchedules = useMemo(() =>
    allFacilities.map(f => ({
      fac: f,
      color: RATE_COLORS[f.rateType] || RATE_COLORS.default,
      data: buildAmortSchedule(+f.balance, +f.rate, +f.amount),
    })), [allFacilities]);

  // Balance decline chart data
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

  // Combined P&I split (annual)
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

  // Estimated payoff year
  const payoffYear = useMemo(() => {
    if (facilitySchedules.length === 0) return null;
    const maxFn = Math.max(...facilitySchedules.map(s => s.data.length - 1));
    return new Date().getFullYear() + maxFn;
  }, [facilitySchedules]);

  const intPct = totalLoanBalance > 0 && totalLoanInterest > 0
    ? Math.round(totalLoanInterest / (totalLoanInterest + totalLoanBalance) * 100)
    : 0;

  if (loanExpenses.length === 0) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <div className="es-icon">🏠</div>
          <div className="es-text">No loans set up yet — add a loan expense with facilities in the Expenses tab</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* ── Current Position ─────────────────────────────────────────────── */}
      <div className="dash-section">
        <div className="section-header">
          <h3>Current Position</h3>
          {payoffYear && <span className="text3" style={{ fontSize: 11 }}>Estimated payoff {payoffYear}</span>}
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
          {intPct > 0 && (
            <div className="fns-item">
              <span>Interest % of Total</span>
              <span className="mono amber">{intPct}%</span>
            </div>
          )}
          {crossoverYear !== null && (
            <div className="fns-item">
              <span>Principal &gt; Interest</span>
              <span className="mono green">Year {crossoverYear}</span>
            </div>
          )}
          {payoffYear && (
            <div className="fns-item">
              <span>Payoff Year</span>
              <span className="mono teal">{payoffYear}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Overview Charts ───────────────────────────────────────────────── */}
      {facilitySchedules.length > 0 && balanceDeclineData.length > 1 && (
        <div className="dash-section">
          <div className="section-header">
            <h3>Loan Overview</h3>
            <span className="text3" style={{ fontSize: 11 }}>Balance decline &amp; payment split</span>
          </div>
          <div className="loan-charts-grid">

            {/* Balance Decline */}
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
                      const label = isNaN(fi) ? 'Total' :
                        (facilitySchedules[fi]?.fac.label || facilitySchedules[fi]?.fac.rateType || `Facility ${fi + 1}`);
                      return [fmtMoneyRound(val), label];
                    }}
                    labelFormatter={v => `Year ${v}`}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <ReferenceLine
                    y={Math.round(totalLoanBalance / 2)}
                    stroke="rgba(0,113,227,0.25)" strokeDasharray="4 2"
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

            {/* Annual P&I Split */}
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
                    <ReferenceLine x={crossoverYear} stroke="rgba(52,199,89,0.5)" strokeDasharray="4 2"
                      label={{ value: 'P>I', fill: 'var(--green)', fontSize: 9, position: 'insideTopLeft' }} />
                  )}
                  <Bar dataKey="interest"  stackId="a" fill="rgba(255,59,48,0.75)"  radius={[0,0,0,0]} name="interest" />
                  <Bar dataKey="principal" stackId="a" fill="rgba(0,113,227,0.75)"  radius={[3,3,0,0]} name="principal" />
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
        </div>
      )}

      {/* ── Per-loan detail ───────────────────────────────────────────────── */}
      {loanExpenses.map(loan => {
        const facilities = (loan.facilities || []).filter(f => f.balance || f.rate || f.amount);
        if (facilities.length === 0) return null;

        const loanBal = facilities.reduce((s, f) => s + (+f.balance || 0), 0);
        const loanPmt = facilities.reduce((s, f) => s + (+f.amount  || 0), 0);
        const loanInt = facilities.reduce((s, f) => s + calcTotalInterest(+f.balance, +f.rate, +f.amount), 0);
        const terms   = facilities.map(f => calcRemainingTerm(+f.balance, +f.rate, +f.amount)).filter(Boolean);
        const maxTerm = terms.reduce((mx, t) => !mx || t.fortnights > mx.fortnights ? t : mx, null);

        return (
          <div key={loan.id} className="dash-section">
            <div className="section-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="mortgage" size={16} />
                {loan.name}
                {loan.lender && <span className="tag teal" style={{ fontWeight: 400, fontSize: 11 }}>{loan.lender}</span>}
              </h3>
              {maxTerm && (
                <span className="text3" style={{ fontSize: 11 }}>
                  {maxTerm.years > 0 ? `${maxTerm.years}y ` : ''}{maxTerm.months}m remaining
                </span>
              )}
            </div>

            {/* Per-loan summary tiles */}
            <div className="fn-summary">
              <div className="fns-item">
                <span>Outstanding</span>
                <span className="mono red">{fmtMoneyRound(loanBal)}</span>
              </div>
              <div className="fns-item">
                <span>Repayment /fn</span>
                <span className="mono">{fmtMoneyRound(loanPmt)}</span>
              </div>
              {loanInt > 0 && (
                <div className="fns-item">
                  <span>Interest Left</span>
                  <span className="mono amber">{fmtMoneyRound(loanInt)}</span>
                </div>
              )}
              {facilities.length > 1 && (
                <div className="fns-item">
                  <span>Splits</span>
                  <span className="mono">{facilities.length}</span>
                </div>
              )}
            </div>

            {/* Facility breakdown label */}
            {facilities.length > 1 && (
              <div className="section-subheader">Facility Breakdown</div>
            )}

            {/* Facility cards */}
            <div className="mfac-grid">
              {facilities.map(f => (
                <FacilityCard key={f.id} facility={f} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
