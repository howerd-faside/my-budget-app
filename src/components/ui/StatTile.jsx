import PropTypes from 'prop-types';

/**
 * StatTile — matches the .fns-item pattern used throughout the app.
 *
 * Props:
 *   label          — uppercase caption (string)
 *   value          — primary mono number / text (string)
 *   valueClassName — optional colour class: 'red' | 'green' | 'teal' | 'amber'
 *   meta           — optional secondary line below value (string | node)
 *   icon           — optional node rendered beside the value (e.g. a trend indicator)
 */
export default function StatTile({ label, value, valueClassName = '', meta, icon }) {
  return (
    <div className="fns-item">
      <span>{label}</span>
      <div className="fns-val-row">
        <span className={`mono ${valueClassName}`.trim()}>{value}</span>
        {icon}
      </div>
      {meta != null && <span className="text3" style={{ fontSize: 'var(--fs-meta)' }}>{meta}</span>}
    </div>
  );
}

StatTile.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  valueClassName: PropTypes.string,
  meta: PropTypes.node,
  icon: PropTypes.node,
};

StatTile.defaultProps = {
  valueClassName: '',
};
