import PropTypes from 'prop-types';
import Icon from '../../components/Icon';

/**
 * HomeAlerts — compact priority-sorted alert list for the Home dashboard.
 *
 * Presentational only. Sorts by severity, caps at 5 visible items.
 * Each alert row has a severity-tinted icon indicator, primary label,
 * and optional secondary detail line.
 *
 * - Items present → structured alert rows with severity indicators.
 * - No items + hasAnyData → compact "All clear" strip.
 * - No items + !hasAnyData → hidden (no domains configured yet).
 */

const SEVERITY_ORDER = { urgent: 0, warn: 1, info: 2 };
const MAX_VISIBLE = 5;

export default function HomeAlerts({ items, hasAnyData }) {
  const all = items || [];

  if (all.length === 0 && !hasAnyData) return null;

  // Sort by severity: urgent → warn → info
  const sorted = [...all].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
  const visible  = sorted.slice(0, MAX_VISIBLE);
  const overflow = sorted.length - visible.length;

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
        <span className="panel-hdr-icon"><Icon name="alertcir" size={12} /></span>
        <span className="ha-title">Needs Attention</span>
        <span className="ha-count">{sorted.length}</span>
      </div>
      <div className="ha-items">
        {visible.map(item => (
          <div key={item.id} className={`ha-row ha-${item.severity}`}>
            <span className="ha-indicator">
              <Icon name={item.icon} size={13} />
            </span>
            <div className="ha-content">
              <span className="ha-label">{item.label}</span>
              {item.detail && (
                <span className="ha-detail">{item.detail}</span>
              )}
            </div>
          </div>
        ))}
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
  })),
  hasAnyData: PropTypes.bool,
};
