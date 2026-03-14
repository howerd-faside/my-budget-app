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
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const push = useCallback((message, type = 'error') => {
    const id = ++counter.current;
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => {
      setToasts(t => t.filter(x => x.id !== id));
    }, 5000);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      {toasts.length > 0 && (
        <div className="toast-container" role="status" aria-live="polite">
          {toasts.map(t => (
            <div key={t.id} className={`toast toast-${t.type}`}>
              <span className="toast-msg">{t.message}</span>
              <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">✕</button>
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
