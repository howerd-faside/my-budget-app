import PropTypes from 'prop-types';

/**
 * EmptyState — matches the .empty-state pattern.
 *
 * Props:
 *   icon        — emoji string or node  (rendered in .es-icon)
 *   title       — primary message (string) — styled by .es-text (light gray, centred)
 *   description — optional secondary paragraph
 *   action      — optional node (Button, etc.) rendered below the text
 */
export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="empty-state">
      {icon && <div className="es-icon">{icon}</div>}
      {(title || description) && (
        <div className="es-text">
          {title}
          {description && (
            <span style={{ display: 'block', marginTop: title ? 4 : 0 }}>{description}</span>
          )}
        </div>
      )}
      {action}
    </div>
  );
}

EmptyState.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.string,
  description: PropTypes.node,
  action: PropTypes.node,
};
