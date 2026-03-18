import { useState, useMemo } from 'react';
import { useMortgageFacilities, useMortgageSummary } from '../../store/hooks';
import {
  calcRemainingTerm, calcEarlyRepaymentSavings,
} from '../../utils/finance/mortgage';
import Icon from '../Icon';
import { SectionHeader, StatTile, Card } from '../ui';
import { fmtMoney } from '../../utils/finance/tax';

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

export default function EarlyRepaymentSection() {
  const [extra, setExtra] = useState('');
  const { facilities, hasLoans } = useMortgageFacilities();
  const { payoffYear } = useMortgageSummary();

  const extraAmt     = Math.max(0, +extra || 0);
  const totalBalance = facilities.reduce((s, f) => s + ((f.currentBalance ?? +f.balance) || 0), 0);

  const result = useMemo(() => {
    if (!hasLoans || extraAmt <= 0 || totalBalance <= 0) return null;

    let totalSavedInterest  = 0;
    let currentMaxFortnights = 0;
    let newMaxFortnights     = 0;

    for (const f of facilities) {
      const b  = (f.currentBalance ?? +f.balance) || 0;
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
