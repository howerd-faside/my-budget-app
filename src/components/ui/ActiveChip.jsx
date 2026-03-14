import PropTypes from 'prop-types';

/**
 * Filter indicator pill with a close button.
 * @param {object} props
 * @param {string} props.label - Display text
 * @param {() => void} props.onClear - Called when the × button is clicked
 * @param {string} [props.className] - CSS class override (default: 'tag')
 */
export default function ActiveChip({ label, onClear, className }) {
  return (
    <span className={className || 'tag'} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {label}
      <button
        onClick={onClear}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'var(--text3)', fontSize: 13 }}
        aria-label="Remove filter"
      >×</button>
    </span>
  );
}

ActiveChip.propTypes = {
  label: PropTypes.string.isRequired,
  onClear: PropTypes.func.isRequired,
  className: PropTypes.string,
};
