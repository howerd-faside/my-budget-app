import PropTypes from 'prop-types';
import Icon from '../../components/Icon';
import { SectionHeader, EmptyState, Card } from '../../components/ui';

/**
 * HomeGoals — savings goals progress overview.
 *
 * Presentational only. Shows each goal with a progress bar.
 * Reuses the .dg-* CSS classes from the existing GoalsSection in Dashboard.
 */
export default function HomeGoals({ goals, hasGoals, onNavigate }) {
  if (!hasGoals) return null;

  return (
    <Card variant="section">
      <SectionHeader
        title={<><Icon name="star" size={15} /> Goals</>}
        actions={onNavigate && (
          <button className="btn-ghost small" onClick={onNavigate}>View Finances →</button>
        )}
      />
      {goals.length === 0 ? (
        <EmptyState
          icon={<Icon name="star" size={24} />}
          title="No goals set yet."
        />
      ) : (
        <div className="dash-goals">
          {goals.map(g => (
            <div key={g.id} className="dash-goal-row">
              <div className="dg-info">
                <span className="dg-name">{g.name}</span>
                <span className="dg-target text3">{g.target}</span>
              </div>
              <div className="dg-bar-wrap">
                <div className="dg-bar">
                  <div className="dg-fill" style={{ width: `${g.progressPct}%` }} />
                </div>
                <span className="dg-pct">{g.progressPct}%</span>
              </div>
              {g.eta && <span className="dg-date teal">{g.eta}</span>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

HomeGoals.propTypes = {
  goals: PropTypes.arrayOf(PropTypes.shape({
    id:          PropTypes.string.isRequired,
    name:        PropTypes.string.isRequired,
    target:      PropTypes.string.isRequired,
    progressPct: PropTypes.number.isRequired,
    eta:         PropTypes.string,
  })).isRequired,
  hasGoals:   PropTypes.bool.isRequired,
  onNavigate: PropTypes.func,
};
