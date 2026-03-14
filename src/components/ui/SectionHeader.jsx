import PropTypes from 'prop-types';

/**
 * SectionHeader — matches the .section-header pattern used across all pages.
 *
 * Props:
 *   title    — section heading (string)
 *   subtitle — optional smaller line below the title
 *   actions  — optional node (buttons / controls) rendered on the right
 */
export default function SectionHeader({ title, subtitle, actions }) {
  return (
    <div className="section-header">
      {subtitle ? (
        <div>
          <h3>{title}</h3>
          <p style={{ fontSize: 'var(--fs-meta)', color: 'var(--text3)', marginTop: 'var(--space-1)', fontWeight: 400 }}>
            {subtitle}
          </p>
        </div>
      ) : (
        <h3>{title}</h3>
      )}
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {actions}
        </div>
      )}
    </div>
  );
}

SectionHeader.propTypes = {
  title: PropTypes.node.isRequired,
  subtitle: PropTypes.string,
  actions: PropTypes.node,
};
