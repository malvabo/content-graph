import { type ReactNode, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);
  if (!open) return null;
  return createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget) close(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, boxSizing: 'border-box' }}
    >
      {children}
    </div>,
    document.body,
  );
}

interface DialogContentProps {
  children: ReactNode;
  maxWidth?: number;
  hideClose?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function DialogContent({ children, maxWidth = 480, hideClose: _hideClose, className, style }: DialogContentProps) {
  return (
    <div
      className={className}
      onClick={e => e.stopPropagation()}
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', width: '100%', maxWidth, ...style }}
    >
      {children}
    </div>
  );
}

export function DialogTitle({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <h2 style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 500, lineHeight: 1.4, color: 'var(--color-text-primary)', ...style }}>
      {children}
    </h2>
  );
}
