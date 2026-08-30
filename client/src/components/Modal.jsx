import { useEffect } from 'react';

export function Modal({ title, subtitle, onClose, children }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function StatusBadge({ active, activeLabel = 'Active', inactiveLabel = 'Archived' }) {
  return (
    <span className={`badge ${active ? 'badge--success' : 'badge--muted'}`}>
      <span aria-hidden="true" />
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

export function PageMessage({ type = 'error', children }) {
  if (!children) return null;
  return <div className={`page-message page-message--${type}`} role={type === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export function EmptyState({ children }) {
  return <div className="empty-state">{children}</div>;
}
