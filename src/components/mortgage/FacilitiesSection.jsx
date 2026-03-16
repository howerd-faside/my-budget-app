import { useMemo } from 'react';
import { useMortgageFacilities } from '../../store/hooks';
import { calcRemainingTerm, calcTotalInterest } from '../../utils/finance/mortgage';
import Icon from '../Icon';
import { SectionHeader, StatTile, Card } from '../ui';
import { fmtMoney } from '../../utils/finance/tax';

// ── Per-facility stat card ───────────────────────────────────────────────────

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

// ── Section ──────────────────────────────────────────────────────────────────

export default function FacilitiesSection() {
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
