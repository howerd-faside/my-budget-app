import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import Portal from '../Portal.jsx';

/**
 * ConfirmDialog — modal confirmation replacing window.confirm().
 *
 * Props:
 *   open            — controls visibility
 *   title           — header string (e.g. "Delete holding")
 *   message         — body text / description
 *   onConfirm       — called when user confirms
 *   onCancel        — called when user cancels (overlay click, Escape, Cancel btn)
 *   confirmLabel    — confirm button text (default "Delete")
 *   confirmVariant  — confirm button CSS modifier (default "danger")
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Delete',
  confirmVariant = 'danger',
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (open && cancelRef.current) cancelRef.current.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <Portal>
      <div className="modal-overlay" onClick={onCancel}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          {title && (
            <div className="modal-header">
              <h3>{title}</h3>
            </div>
          )}
          <div className="modal-body">
            <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{message}</p>
          </div>
          <div className="modal-footer">
            <button className="btn" ref={cancelRef} onClick={onCancel}>
              Cancel
            </button>
            <button className={`btn ${confirmVariant}`} onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

ConfirmDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  title: PropTypes.string,
  message: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  confirmLabel: PropTypes.string,
  confirmVariant: PropTypes.string,
};

ConfirmDialog.defaultProps = {
  confirmLabel: 'Delete',
  confirmVariant: 'danger',
};
