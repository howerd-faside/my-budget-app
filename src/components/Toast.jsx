import { createContext, useContext, useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';

const ToastCtx = createContext(null);

/**
 * ToastProvider — mount once near the top of the tree.
 * Renders a fixed toast stack in the bottom-right corner.
 *
 * Usage:
 *   const toast = useToast();
 *   toast('Price refresh failed — check your connection', 'error');
 *   toast('Prices updated successfully', 'success');
 *   toast('Expense deleted', 'undo', {
 *     action: { label: 'Undo', onClick: () => restore() },
 *     duration: 7000,
 *   });
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const push = useCallback((message, type = 'error', options = {}) => {
    const id = ++counter.current;
    const duration = options.duration ?? 5000;
    setToasts(t => [...t, { id, message, type, action: options.action || null, duration }]);
    setTimeout(() => {
      setToasts(t => t.filter(x => x.id !== id));
    }, duration);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  const handleAction = useCallback((id, onClick) => {
    onClick();
    dismiss(id);
  }, [dismiss]);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      {toasts.length > 0 && (
        <div className="toast-container" role="status" aria-live="polite">
          {toasts.map(t => (
            <div key={t.id} className={`toast toast-${t.type}`}>
              <span className="toast-msg">{t.message}</span>
              {t.action && (
                <button
                  className="toast-action"
                  onClick={() => handleAction(t.id, t.action.onClick)}
                >
                  {t.action.label}
                </button>
              )}
              <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">✕</button>
              {t.type === 'undo' && (
                <div className="toast-progress" style={{ animationDuration: `${t.duration}ms` }} />
              )}
            </div>
          ))}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

ToastProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
