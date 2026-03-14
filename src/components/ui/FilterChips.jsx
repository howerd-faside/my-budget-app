import PropTypes from 'prop-types';
import ActiveChip from './ActiveChip.jsx';

/**
 * FilterChips — renders active-filter indicator row with "Active:" label + clear-all button.
 *
 * Props:
 *   chips       — array of { key, label, onClear } objects
 *   onClearAll  — called when "Clear all" is clicked
 */
export default function FilterChips({ chips, onClearAll }) {
  const active = chips.filter(c => c.label);
  if (active.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 'var(--space-3)' }}>
      <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>Active:</span>
      {active.map(c => (
        <ActiveChip key={c.key} label={c.label} onClear={c.onClear} />
      ))}
      <button className="btn-ghost small" onClick={onClearAll} style={{ fontSize: 11, padding: '2px 8px' }}>
        Clear all
      </button>
    </div>
  );
}

FilterChips.propTypes = {
  chips: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string.isRequired,
    label: PropTypes.string,
    onClear: PropTypes.func.isRequired,
  })).isRequired,
  onClearAll: PropTypes.func.isRequired,
};
