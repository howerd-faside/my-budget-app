import PropTypes from 'prop-types';
import Icon from '../../components/Icon';

/**
 * HomeAlerts — compact priority-sorted alert list for the Home dashboard.
 *
 * Presentational only. Sorts by severity, caps at 5 visible items.
 * Each alert row is clickable and navigates to the associated page.
 *
 * - Items present → structured alert rows with severity indicators.
 * - No items + hasAnyData → compact "All clear" strip.
 * - No items + !hasAnyData → hidden (no domains configured yet).
 */

const SEVERITY_ORDER = { urgent: 0, warn: 1, info: 2 };
const MAX_VISIBLE = 5;

export default function HomeAlerts({ items, hasAnyData, navigateTo }) {
  const all = items || [];

  if (all.length === 0 && !hasAnyData) return null;

  // Sort by severity: urgent → warn → info
  const sorted = [...all].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
  const visible  = sorted.slice(0, MAX_VISIBLE);
  const overflow = sorted.length - visible.length;

  const handleClick = (item) => {
    if (navigateTo && item.target) {
      navigateTo(item.target.section, item.target.tab);
    }
  };

  // Empty state — compact all-clear strip
  if (visible.length === 0) {
    return (
      <div className="home-alerts home-alerts--clear">
        <span className="ha-clear-icon">
          <Icon name="check" size={13} />
        </span>
        <span>All clear — nothing needs attention.</span>
      </div>
    );
  }

  return (
    <div className="home-alerts">
      <div className="ha-header">
        <Icon name="alertcir" size={13} />
        <span className="ha-title">Needs Attention</span>
        <span className="ha-count">{sorted.length}</span>
      </div>
      <div className="ha-items">
        {visible.map(item => {
          const clickable = navigateTo && item.target;
          return (
            <button
              key={item.id}
              className={`ha-row ha-${item.severity}${clickable ? ' ha-clickable' : ''}`}
              onClick={() => handleClick(item)}
              type="button"
            >
              <span className="ha-indicator">
                <Icon name={item.icon} size={13} />
              </span>
              <div className="ha-content">
                <span className="ha-label">{item.label}</span>
                {item.detail && (
                  <span className="ha-detail">{item.detail}</span>
                )}
              </div>
              {clickable && (
                <Icon name="chevronR" size={10} className="ha-chevron" />
              )}
            </button>
          );
        })}
        {overflow > 0 && (
          <span className="ha-more">+{overflow} more</span>
        )}
      </div>
    </div>
  );
}

HomeAlerts.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    id:       PropTypes.string.isRequired,
    icon:     PropTypes.string.isRequired,
    label:    PropTypes.string.isRequired,
    detail:   PropTypes.string,
    severity: PropTypes.oneOf(['info', 'warn', 'urgent']).isRequired,
    target:   PropTypes.shape({
      section: PropTypes.string.isRequired,
      tab:     PropTypes.string.isRequired,
    }),
  })),
  hasAnyData:  PropTypes.bool,
  navigateTo:  PropTypes.func,
};
