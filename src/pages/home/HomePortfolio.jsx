import PropTypes from 'prop-types';
import Icon from '../../components/Icon';
import { SectionHeader, StatTile, Card } from '../../components/ui';

/**
 * HomePortfolio — investment portfolio mini-summary.
 *
 * Presentational only. Shows a compact overview of the portfolio value
 * and performance. Hidden when hasData is false.
 */
export default function HomePortfolio({ totalValue, totalGain, gainPositive, returnPct, hasData, onNavigate }) {
  if (!hasData) return null;

  return (
    <Card variant="section">
      <SectionHeader
        title={<><Icon name="trend" size={15} /> Investments</>}
        actions={onNavigate && (
          <button className="btn-ghost small" onClick={onNavigate}>View Investments →</button>
        )}
      />
      <div className="fn-summary">
        <StatTile label="Portfolio Value" value={totalValue} />
        <StatTile
          label="Unrealised G/L"
          value={totalGain}
          valueClassName={gainPositive ? 'green' : 'red'}
        />
        <StatTile
          label="Return"
          value={returnPct}
          valueClassName={gainPositive ? 'green' : 'red'}
        />
      </div>
    </Card>
  );
}

HomePortfolio.propTypes = {
  totalValue:   PropTypes.string.isRequired,
  totalGain:    PropTypes.string.isRequired,
  gainPositive: PropTypes.bool.isRequired,
  returnPct:    PropTypes.string.isRequired,
  hasData:      PropTypes.bool.isRequired,
  onNavigate:   PropTypes.func,
};
