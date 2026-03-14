import { memo, useMemo } from 'react';
import PropTypes from 'prop-types';
import { fmtMoneyRound } from '../../utils/finance/tax';
import { toFortnightly } from '../../utils/finance/frequency';

/**
 * Per-person income summary card (used in .map()).
 *
 * @param {object} props
 * @param {object} props.person - Person object with computed _effectivePay, _basePay, _eventLabel, _employer fields
 */
function IncomeCard({ person }) {
  // person._effectivePay = pay computed from today's active event/role
  // person._eventLabel   = active income event label (null if none)
  // person._employer     = current employer from employment history (null if none)
  // person._basePay      = pay at base grossAnnual (for comparison)
  const pay     = person._effectivePay || person.pay;
  const basePay = person._basePay || pay;
  const eventActive = !!person._eventLabel;

  const secFn = useMemo(() =>
    (person.secondaryIncomes || []).reduce((s, si) => s + toFortnightly(si.amount, si.frequency), 0),
    [person.secondaryIncomes]);

  return (
    <div className="income-card">
      <div className="ic-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="ic-name">{person.name || 'Unnamed'}</span>
          {person._employer && (
            <div className="ic-employer-line">{person._employer}</div>
          )}
        </div>
        <div className="ic-tags">
          <span className="tag">{person.taxCode}</span>
          {person.kiwiSaverRate > 0 && <span className="tag teal">KS {person.kiwiSaverRate}%</span>}
        </div>
      </div>

      <div className="ic-stats">
        <div className="ic-stat">
          <span className="ic-stat-label">Gross /fn</span>
          <span className="mono ic-stat-val">{fmtMoneyRound(pay.grossAnnual / 26)}</span>
        </div>
        <div className="ic-stat">
          <span className="ic-stat-label">Net /fn</span>
          <span className={`mono ic-stat-val ${eventActive ? 'amber' : 'green'}`}>{fmtMoneyRound(pay.netFortnightly)}</span>
        </div>
        <div className="ic-stat">
          <span className="ic-stat-label">Annual Gross</span>
          <span className="mono ic-stat-val">{fmtMoneyRound(pay.grossAnnual)}</span>
        </div>
        <div className="ic-stat">
          <span className="ic-stat-label">Annual Net</span>
          <span className={`mono ic-stat-val ${eventActive ? 'amber' : 'green'}`}>{fmtMoneyRound(pay.netAnnual)}</span>
        </div>
      </div>

      <div className="ic-deductions">
        <span className="ic-ded red">Tax {pay.effectiveRate.toFixed(1)}% · −{fmtMoneyRound(pay.taxAnnual / 26)}/fn</span>
        <span className="ic-ded red">ACC −{fmtMoneyRound(pay.accAnnual / 26)}/fn</span>
        {person.kiwiSaverRate > 0 && (
          <span className="ic-ded teal">KiwiSaver {person.kiwiSaverRate}% · −{fmtMoneyRound(pay.kiwiSaverAnnual / 26)}/fn</span>
        )}
        {pay.studentLoanAnnual > 0 && (
          <span className="ic-ded purple">Student Loan −{fmtMoneyRound(pay.studentLoanAnnual / 26)}/fn</span>
        )}
      </div>

      {secFn > 0 && (
        <div className="ic-secondary">
          <span className="ic-ded green">+ Secondary income {fmtMoneyRound(secFn)}/fn</span>
          <span className="ic-total-row">
            <span className="text3" style={{ fontSize: 10 }}>TOTAL /fn</span>
            <span className={`mono ${eventActive ? 'amber' : 'green'}`} style={{ fontSize: 15, fontWeight: 700 }}>
              {fmtMoneyRound(pay.netFortnightly + secFn)}
            </span>
          </span>
        </div>
      )}

      {/* Active income event banner — bottom of card */}
      {eventActive && (
        <div className="ic-event-banner">
          <span className="ic-event-icon">⚑</span>
          <span className="ic-event-name">{person._eventLabel}</span>
          <span className="mono ic-event-net">{fmtMoneyRound(pay.netFortnightly)}/fn</span>
          <span className="ic-event-base text3">base {fmtMoneyRound(basePay.netFortnightly)}/fn</span>
        </div>
      )}
    </div>
  );
}

IncomeCard.propTypes = {
  person: PropTypes.shape({
    name: PropTypes.string,
    taxCode: PropTypes.string,
    kiwiSaverRate: PropTypes.number,
    secondaryIncomes: PropTypes.arrayOf(PropTypes.shape({
      amount: PropTypes.number,
      frequency: PropTypes.string,
    })),
    _effectivePay: PropTypes.object,
    _basePay: PropTypes.object,
    _eventLabel: PropTypes.string,
    _employer: PropTypes.string,
  }).isRequired,
};

export default memo(IncomeCard);
