import PropTypes from 'prop-types';
import Icon from '../../components/Icon';
import { SectionHeader, StatTile, Card } from '../../components/ui';

/**
 * HomeNetWorth — household net worth breakdown.
 *
 * Presentational only. Hidden when hasData is false.
 * Optional string props (investments, property, liabilities) show a dash
 * when null, distinguishing "not configured" from "$0 value".
 */
export default function HomeNetWorth({
  netWorth, cash, investments, property, liabilities, hasData, netPositive,
}) {
  if (!hasData) return null;

  return (
    <Card variant="section">
      <SectionHeader title={<><Icon name="bank" size={15} /> Net Worth</>} />
      <div className="fn-summary">
        <StatTile
          label="Net Worth"
          value={netWorth}
          valueClassName={netPositive ? 'green' : 'red'}
        />
        <StatTile label="Cash"        value={cash} />
        <StatTile label="Investments" value={investments || '\u2014'} />
        <StatTile label="Property"    value={property || '\u2014'} />
        <StatTile
          label="Liabilities"
          value={liabilities || '\u2014'}
          valueClassName={liabilities ? 'red' : ''}
        />
      </div>
    </Card>
  );
}

HomeNetWorth.propTypes = {
  netWorth:    PropTypes.string.isRequired,
  cash:        PropTypes.string.isRequired,
  investments: PropTypes.string,
  property:    PropTypes.string,
  liabilities: PropTypes.string,
  hasData:     PropTypes.bool.isRequired,
  netPositive: PropTypes.bool.isRequired,
};
