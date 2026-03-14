import PropTypes from 'prop-types';
import Portal from '../Portal.jsx';

/**
 * Modal — standard macOS-sheet modal using existing .modal-* classes.
 *
 * Props:
 *   isOpen    — controls visibility
 *   onClose   — called when overlay is clicked
 *   title     — header title string
 *   children  — modal body content
 *   footer    — optional footer node (action buttons)
 *   wide      — boolean, expands to .modal.wide (580px)
 *   bodyStyle — optional style object applied to the .modal-body div
 */
export default function Modal({ isOpen, onClose, title, children, footer, wide = false, bodyStyle }) {
  if (!isOpen) return null;

  return (
    <Portal>
      <div className="modal-overlay" onClick={onClose}>
        <div
          className={wide ? 'modal wide' : 'modal'}
          onClick={e => e.stopPropagation()}
        >
          {title && (
            <div className="modal-header">
              <h3>{title}</h3>
              <button className="btn-icon" onClick={onClose} aria-label="Close">
                ✕
              </button>
            </div>
          )}
          <div className="modal-body" style={bodyStyle}>{children}</div>
          {footer && <div className="modal-footer">{footer}</div>}
        </div>
      </div>
    </Portal>
  );
}

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string,
  children: PropTypes.node.isRequired,
  footer: PropTypes.node,
  wide: PropTypes.bool,
  bodyStyle: PropTypes.object,
};

Modal.defaultProps = {
  wide: false,
};
