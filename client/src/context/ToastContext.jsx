import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) =>
    setToasts(prev => prev.filter(t => t.id !== id)), []);

  const showToast = useCallback((message, type = 'error') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/* ── Determine if an API error message is user-readable ── */
const TECHNICAL_PATTERNS = [
  /error:/i, /exception/i, /traceback/i, /typeerror/i,
  /cannot read/i, /undefined/i, /null/i, /stack/i,
];

export function getErrorMessage(err) {
  const apiMsg = err?.response?.data?.message;

  if (apiMsg) {
    const isTechnical = TECHNICAL_PATTERNS.some(p => p.test(apiMsg));
    return isTechnical ? 'Something went wrong. Please try again.' : apiMsg;
  }

  if (err?.message === 'Network Error')
    return 'Cannot connect to server. Please check your connection.';

  return 'Something went wrong. Please try again.';
}

/* ── Toast UI ── */
const TYPE_VARS = {
  error:   { bg: 'var(--toast-error-bg)',   border: 'var(--toast-error-border)',   text: 'var(--toast-error-text)',   icon: '✕' },
  success: { bg: 'var(--toast-success-bg)', border: 'var(--toast-success-border)', text: 'var(--toast-success-text)', icon: '✓' },
  info:    { bg: 'var(--toast-info-bg)',     border: 'var(--toast-info-border)',     text: 'var(--toast-info-text)',     icon: 'ℹ' },
};

function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-2" style={{ maxWidth: '360px' }}>
      {toasts.map(t => {
        const s = TYPE_VARS[t.type] ?? TYPE_VARS.error;
        return (
          <div
            key={t.id}
            className="flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg"
            style={{
              background: s.bg,
              border:     `1px solid ${s.border}`,
              animation:  'slideIn 0.2s ease',
            }}
          >
            <span className="text-sm font-bold mt-0.5 shrink-0" style={{ color: s.text }}>{s.icon}</span>
            <p className="text-sm flex-1" style={{ color: 'var(--text-primary)' }}>{t.message}</p>
            <button
              onClick={() => onDismiss(t.id)}
              className="text-xs shrink-0 mt-0.5"
              style={{ color: 'var(--text-muted)' }}
            >✕</button>
          </div>
        );
      })}
    </div>
  );
}
