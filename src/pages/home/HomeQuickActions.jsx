import PropTypes from 'prop-types';
import Icon from '../../components/Icon';

/**
 * HomeQuickActions — compact command panel for the Home dashboard.
 *
 * Primary: icon-first action tiles in a grid (high-frequency workflows).
 * Secondary: compact icon+label row buttons (setup / utility destinations).
 *
 * Presentational only. Hidden when navigateTo is not provided.
 */

const PRIMARY = [
  { id: 'tracking',   label: 'Record Transaction', icon: 'plus',      section: 'finances',    tab: 'tracking' },
  { id: 'expenses',   label: 'Manage Expenses',    icon: 'wallet',    section: 'finances',    tab: 'expenses' },
  { id: 'inv-dash',   label: 'Investments',         icon: 'trend',     section: 'investments', tab: 'inv-dashboard' },
];

const PRIMARY_PROPERTY = {
  id: 'prop-tasks', label: 'Property Tasks', icon: 'clipboard', section: 'property', tab: 'prop-tasks',
};

const SECONDARY = [
  { id: 'income',   label: 'Income & People', icon: 'person',   section: 'finances', tab: 'income'   },
  { id: 'mortgage', label: 'Mortgage',        icon: 'mortgage', section: 'finances', tab: 'mortgage' },
  { id: 'wishlist', label: 'Wishlist',        icon: 'tag',      section: 'finances', tab: 'wishlist' },
  { id: 'settings', label: 'Settings',        icon: 'settings', section: 'settings'                  },
];

export default function HomeQuickActions({ navigateTo, hasProperties }) {
  if (!navigateTo) return null;

  const primary = hasProperties ? [...PRIMARY, PRIMARY_PROPERTY] : PRIMARY;

  return (
    <div className="home-qa">
      <div className="qa-header">
        <span className="panel-hdr-icon"><Icon name="layers" size={12} /></span>
        <span className="qa-title">Quick Actions</span>
      </div>
      <div className="qa-grid">
        {primary.map(a => (
          <button
            key={a.id}
            className="qa-tile"
            onClick={() => navigateTo(a.section, a.tab)}
          >
            <span className="qa-tile-icon">
              <Icon name={a.icon} size={15} />
            </span>
            <span className="qa-tile-label">{a.label}</span>
          </button>
        ))}
      </div>
      <div className="qa-secondary">
        {SECONDARY.map(a => (
          <button
            key={a.id}
            className="qa-link"
            onClick={() => navigateTo(a.section, a.tab)}
          >
            <Icon name={a.icon} size={11} />
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

HomeQuickActions.propTypes = {
  navigateTo:    PropTypes.func,
  hasProperties: PropTypes.bool,
};
