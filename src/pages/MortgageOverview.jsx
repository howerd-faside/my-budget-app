import { useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import {
  useMortgageSummary, useMortgageFacilities, useMortgageAmortisation,
} from '../store/hooks';
import {
  calcRemainingTerm, calcTotalInterest, calcEarlyRepaymentSavings,
} from '../utils/mortgage';
import Icon from '../components/Icon';
import { SectionHeader, StatTile, Card } from '../components/ui';
import { fmtMoney } from '../utils/tax';

const RATE_COLORS = {
  fixed: '#FF9F0A', floating: '#34C759', revolving: '#AF52DE', default: '#0071E3',
};

const TOOLTIP_STYLE = {
  background: 'rgba(255,255,255,0.97)',
  border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: 12, fontSize: 11,
  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
};

const fmtK = v => `$${(v / 1000).toFixed(0)}k`;

// ── Current Position ──────────────────────────────────────────────────────────
function CurrentPositionSection() {
  const {
    totalBalance, repaymentFn, totalInterest,
    intPct, payoffYear, crossoverYear, hasLoans,
  } = useMortgageSummary();

  const { loanExpenses } = useMortgageFacilities();

  if (!hasLoans) {
    return (
      <Card variant="section">
        <SectionHeader title={<><Icon name="mortgage" size={15} /> Current Position</>} />
        <div style={{ color: 'var(--text3)', fontSize: 13, padding: '4px 0' }}>
          {loanExpenses.length === 0
            ? 'No loans set up yet — add a loan expense with facilities in the Expenses tab.'
            : 'Loan found but no qualifying facilities (balance, rate, and repayment amount all required).'}
        </div>
      </Card>
    );
  }

  return (
    <Card variant="section">
      <SectionHeader
        title={<><Icon name="mortgage" size={15} /> Current Position</>}
        subtitle={payoffYear ? `Estimated payoff ${payoffYear}` : undefined}
      />

      <div className="fn-summary">
        <StatTile label="Total Outstanding"  value={fmtMoney(totalBalance)} valueClassName="red" />
        <StatTile label="Repayment /fn"       value={fmtMoney(repaymentFn)}  valueClassName="red" />
        <StatTile label="Total Interest Left" value={fmtMoney(totalInterest)} valueClassName="amber" />
        {intPct > 0 && (
          <StatTile label="Interest % of Total" value={`${intPct}%`} valueClassName="amber" />
        )}
        {crossoverYear !== null && (
          <StatTile label="Principal > Interest" value={crossoverYear} valueClassName="green" />
        )}
        {payoffYear && (
          <StatTile label="Payoff Year" value={payoffYear} valueClassName="teal" />
        )}
      </div>
    </Card>
  );
}

// ── Amortisation ──────────────────────────────────────────────────────────────
function AmortisationSection() {
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

// ── Facilities ────────────────────────────────────────────────────────────────
function FacilitiesSection() {
  const { loanExpenses, facilities, hasLoans } = useMortgageFacilities();

  if (!hasLoans) return null; // CurrentPositionSection handles the empty state

  // Group normalised facilities by their parent loan
  const loanGroups = loanExpenses
    .map(loan => ({ loan, facilities: facilities.filter(f => f.loanId === loan.id) }))
    .filter(g => g.facilities.length > 0);

  return (
    <Card variant="section">
      <SectionHeader title={<><Icon name="building" size={15} /> Facilities</>} />

      {loanGroups.map(({ loan, facilities: loanFacilities }) => {
        const loanBal = loanFacilities.reduce((s, f) => s + (+f.balance || 0), 0);
        const loanPmt = loanFacilities.reduce((s, f) => s + f.amountFn, 0);
        const loanInt = loanFacilities.reduce(
          (s, f) => s + calcTotalInterest(+f.balance, +f.rate, f.amountFn), 0
        );
        const terms   = loanFacilities
          .map(f => calcRemainingTerm(+f.balance, +f.rate, f.amountFn))
          .filter(Boolean);
        const maxTerm = terms.reduce(
          (mx, t) => !mx || t.fortnights > mx.fortnights ? t : mx, null
        );

        return (
          <div key={loan.id} style={{ marginBottom: 24 }}>
            {/* Per-loan header */}
            <div className="section-header" style={{ marginBottom: 12 }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="mortgage" size={16} />
                {loan.name}
                {loan.lender && (
                  <span className="tag teal" style={{ fontWeight: 400, fontSize: 11 }}>
                    {loan.lender}
                  </span>
                )}
              </h3>
              {maxTerm && (
                <span className="text3" style={{ fontSize: 11 }}>
                  {maxTerm.years > 0 ? `${maxTerm.years}y ` : ''}{maxTerm.months}m remaining
                </span>
              )}
            </div>

            {/* Per-loan summary tiles */}
            <div className="fn-summary" style={{ marginBottom: 16 }}>
              <StatTile label="Outstanding"  value={fmtMoney(loanBal)} valueClassName="red" />
              <StatTile label="Repayment /fn" value={fmtMoney(loanPmt)} />
              {loanInt > 0 && (
                <StatTile label="Interest Left" value={fmtMoney(loanInt)} valueClassName="amber" />
              )}
              {loanFacilities.length > 1 && (
                <StatTile label="Splits" value={String(loanFacilities.length)} />
              )}
            </div>

            {loanFacilities.length > 1 && (
              <div className="section-subheader">Facility Breakdown</div>
            )}

            <div className="mfac-grid">
              {loanFacilities.map(f => (
                <FacilityCard key={f.id} facility={f} />
              ))}
            </div>
          </div>
        );
      })}
    </Card>
  );
}

// Per-facility stat card — stats only, no charts or simulator.
function FacilityCard({ facility }) {
  const b  = +facility.balance || 0;
  const r  = +facility.rate    || 0;
  const fn = facility.amountFn || 0;

  const term     = useMemo(() => calcRemainingTerm(b, r, fn), [b, r, fn]);
  const interest = useMemo(() => calcTotalInterest(b, r, fn), [b, r, fn]);

  return (
    <div className="mfac-card">
      <div className="mfac-header">
        <span className={`fac-type-dot ${facility.rateType}`} />
        <span className="mfac-label">
          {facility.label || facility.rateType || 'Facility'}
        </span>
        {facility.repaymentType && (
          <span className="tag">{facility.repaymentType}</span>
        )}
      </div>

      <div className="mfac-stats">
        <div className="mfac-stat">
          <span className="mfac-stat-label">Rate Type</span>
          <div className="mfac-stat-val" style={{ textTransform: 'capitalize' }}>
            {facility.rateType || '—'}
          </div>
        </div>
        <div className="mfac-stat">
          <span className="mfac-stat-label">Interest Rate</span>
          <div className="mfac-stat-val">{r > 0 ? `${r}%` : '—'}</div>
        </div>
        {b > 0 && (
          <div className="mfac-stat">
            <span className="mfac-stat-label">Outstanding</span>
            <div className="mfac-stat-val red">{fmtMoney(b)}</div>
          </div>
        )}
        {fn > 0 && (
          <div className="mfac-stat">
            <span className="mfac-stat-label">Repayment /fn</span>
            <div className="mfac-stat-val">{fmtMoney(fn)}</div>
          </div>
        )}
        {term && (
          <div className="mfac-stat">
            <span className="mfac-stat-label">Remaining Term</span>
            <div className="mfac-stat-val">{term.years > 0 ? `${term.years}y ` : ''}{term.months}m</div>
          </div>
        )}
        {interest > 0 && (
          <div className="mfac-stat">
            <span className="mfac-stat-label">Total Interest</span>
            <div className="mfac-stat-val amber">{fmtMoney(interest)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Early Repayment ───────────────────────────────────────────────────────────
//
// Allocation rule: extra payment is distributed pro-rata by outstanding balance.
//   Each facility receives: extra × (facilityBalance / totalBalance)
//
// Rationale: pro-rata is additive — facility savings can be summed directly
// and the implementation stays within the existing single-facility API
// (calcEarlyRepaymentSavings). Avalanche (highest-rate-first) would produce
// better interest savings in theory, but requires a multi-facility simulation
// to handle roll-overs after individual facilities clear, which is out of scope
// here. For most household mortgages the facilities have similar rates anyway.
//
function EarlyRepaymentSection() {
  const [extra, setExtra] = useState('');
  const { facilities, hasLoans } = useMortgageFacilities();
  const { payoffYear } = useMortgageSummary();

  const extraAmt     = Math.max(0, +extra || 0);
  const totalBalance = facilities.reduce((s, f) => s + (+f.balance || 0), 0);

  const result = useMemo(() => {
    if (!hasLoans || extraAmt <= 0 || totalBalance <= 0) return null;

    let totalSavedInterest  = 0;
    let currentMaxFortnights = 0;
    let newMaxFortnights     = 0;

    for (const f of facilities) {
      const b  = +f.balance  || 0;
      const r  = +f.rate     || 0;
      const fn = f.amountFn  || 0;

      // Pro-rata share of the extra payment for this facility
      const extraShare = extraAmt * (b / totalBalance);

      const currentTerm = calcRemainingTerm(b, r, fn);
      const newTerm     = calcRemainingTerm(b, r, fn + extraShare);
      const savings     = calcEarlyRepaymentSavings(b, r, fn, extraShare);

      totalSavedInterest += savings.savedInterest;

      // Track longest current term — determines when all debt clears today
      if (currentTerm && currentTerm.fortnights > currentMaxFortnights) {
        currentMaxFortnights = currentTerm.fortnights;
      }

      // Track longest new term — determines new debt-free date
      // If extra is too small to change the term, fall back to current term
      const effectiveTerm = newTerm ?? currentTerm;
      if (effectiveTerm && effectiveTerm.fortnights > newMaxFortnights) {
        newMaxFortnights = effectiveTerm.fortnights;
      }
    }

    const savedFortnights = Math.max(0, currentMaxFortnights - newMaxFortnights);
    const savedMonths     = Math.round(savedFortnights / 26 * 12);
    const savedYears      = Math.floor(savedMonths / 12);
    const savedRemMonths  = savedMonths % 12;
    const newPayoffYear   = newMaxFortnights > 0
      ? new Date().getFullYear() + Math.ceil(newMaxFortnights / 26)
      : payoffYear;

    return {
      totalSavedInterest: Math.max(0, totalSavedInterest),
      savedMonths,
      savedYears,
      savedRemMonths,
      newPayoffYear,
      meaningful: savedMonths > 0 || totalSavedInterest >= 1,
    };
  }, [facilities, extraAmt, totalBalance, payoffYear, hasLoans]);

  if (!hasLoans) return null;

  const timeSavedLabel = result?.meaningful
    ? result.savedYears > 0
      ? `${result.savedYears}y ${result.savedRemMonths}m`
      : `${result.savedMonths}m`
    : null;

  return (
    <Card variant="section">
      <SectionHeader title={<><Icon name="arrow-up" size={15} /> Early Repayment</>} />

      {/* Input */}
      <div className="mc-early-repay" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: 'var(--text2)' }}>Extra payment /fn</span>
        <input
          className="input mono mc-er-input"
          type="number" step="50" min="0" placeholder="0"
          value={extra}
          onChange={e => setExtra(e.target.value)}
        />
        {extraAmt > 0 && !result?.meaningful && (
          <span className="text3" style={{ fontSize: 12 }}>
            Too small to change the payoff term.
          </span>
        )}
      </div>

      {/* Outputs */}
      {result?.meaningful && (
        <div className="fn-summary">
          <StatTile label="New Payoff Year" value={result.newPayoffYear ?? '—'} valueClassName="teal" />
          <StatTile label="Interest Saved"  value={fmtMoney(result.totalSavedInterest)} valueClassName="green" />
          <StatTile label="Time Saved"      value={timeSavedLabel} valueClassName="green" />
        </div>
      )}
    </Card>
  );
}

// ── Page shell ────────────────────────────────────────────────────────────────
export default function MortgageOverview() {
  return (
    <div className="content-wrap">
      <div className="page-content">
        <CurrentPositionSection />
        <AmortisationSection />
        <FacilitiesSection />
        <EarlyRepaymentSection />
      </div>
    </div>
  );
}
