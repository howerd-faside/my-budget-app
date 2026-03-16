import PropTypes from 'prop-types';
import Icon from '../../components/Icon';
import { SectionHeader, StatTile, EmptyState, Card } from '../../components/ui';

/**
 * HomeHousehold — unified household health snapshot.
 *
 * Merges the former HomeSummary (income/spend/savings rate) and HomeCashflow
 * (balance/projection) into a single card, removing duplicate cashflow tiles.
 *
 * Retained: Cash Balance, Net Income /fn, Total Spend /fn, Savings Rate, Projected Year-End.
 * Removed:  Net Cashflow /fn and Cashflow /fn (both redundant with Savings Rate).
 *
 * Presentational only. Shows setup CTA when no people configured.
 */
export default function HomeHousehold({
  currentBalance,
  netIncome,
  totalSpend,
  savingsRate,
  cashflowPositive,
  projectedBalance,
  projectedLabel,
  hasPeople,
  onSetup,
  onNavigate,
}) {
  return (
    <Card variant="section">
      <SectionHeader
        title={<><Icon name="home" size={15} /> Household Health</>}
        actions={hasPeople && onNavigate && (
          <button className="btn-ghost small" onClick={onNavigate}>View Overview →</button>
        )}
      />
      {hasPeople ? (
        <div className="fn-summary">
          <StatTile label="Cash Balance"    value={currentBalance} valueClassName="green" />
          <StatTile label="Net Income /fn"  value={netIncome} />
          <StatTile label="Total Spend /fn" value={totalSpend} />
          <StatTile
            label="Savings Rate"
            value={savingsRate}
            valueClassName={cashflowPositive ? 'green' : 'red'}
          />
          <StatTile label={projectedLabel}  value={projectedBalance} valueClassName="green" />
        </div>
      ) : (
        <>
          <div className="fn-summary">
            <StatTile label="Cash Balance" value={currentBalance} valueClassName="green" />
          </div>
          <EmptyState
            icon={<Icon name="person" size={24} />}
            title="Add income earners to see your household overview."
            action={onSetup && <button className="btn-ghost small" onClick={onSetup}>Set Up People →</button>}
          />
        </>
      )}
    </Card>
  );
}

HomeHousehold.propTypes = {
  currentBalance:   PropTypes.string.isRequired,
  netIncome:        PropTypes.string.isRequired,
  totalSpend:       PropTypes.string.isRequired,
  savingsRate:      PropTypes.string.isRequired,
  cashflowPositive: PropTypes.bool.isRequired,
  projectedBalance: PropTypes.string.isRequired,
  projectedLabel:   PropTypes.string.isRequired,
  hasPeople:        PropTypes.bool.isRequired,
  onSetup:          PropTypes.func,
  onNavigate:       PropTypes.func,
};
