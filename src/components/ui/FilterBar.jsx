import PropTypes from 'prop-types';

/**
 * FilterBar — shared toolbar for search + select dropdowns.
 *
 * Wraps children in the standard flexbox row used across property pages.
 * Accepts an optional `secondary` node rendered below a separator when expanded.
 *
 * Props:
 *   children   — primary filter controls (inputs, selects)
 *   secondary  — optional secondary filter controls (shown below separator)
 *   showMore   — controls visibility of secondary filters
 */
export default function FilterBar({ children, secondary, showMore }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {children}
      </div>
      {showMore && secondary && (
        <div style={{
          display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
          marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)',
          borderTop: '1px solid var(--sep)',
        }}>
          {secondary}
        </div>
      )}
    </>
  );
}

FilterBar.propTypes = {
  children: PropTypes.node.isRequired,
  secondary: PropTypes.node,
  showMore: PropTypes.bool,
};
