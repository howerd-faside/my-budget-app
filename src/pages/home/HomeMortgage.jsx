import PropTypes from 'prop-types';
import Icon from '../../components/Icon';
import { SectionHeader, StatTile, Card } from '../../components/ui';

/**
 * HomeMortgage — compact loan obligations snapshot.
 *
 * Presentational only. Hidden when hasLoans is false.
 */
export default function HomeMortgage({ totalBalance, repaymentFn, payoffYear, hasLoans, onNavigate }) {
  if (!hasLoans) return null;

  return (
    <Card variant="section">
      <SectionHeader
        title={<><Icon name="mortgage" size={15} /> Loan Obligations</>}
        actions={onNavigate && (
          <button className="btn-ghost small" onClick={onNavigate}>View Mortgage →</button>
        )}
      />
      <div className="fn-summary">
        <StatTile label="Total Outstanding" value={totalBalance} valueClassName="red" />
        <StatTile label="Repayment /fn"     value={repaymentFn}  valueClassName="red" />
        <StatTile label="Payoff Year"       value={payoffYear} />
      </div>
    </Card>
  );
}

HomeMortgage.propTypes = {
  totalBalance: PropTypes.string.isRequired,
  repaymentFn:  PropTypes.string.isRequired,
  payoffYear:   PropTypes.string.isRequired,
  hasLoans:     PropTypes.bool.isRequired,
  onNavigate:   PropTypes.func,
};
