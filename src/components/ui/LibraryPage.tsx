import type { ReactNode } from 'react';

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 5v14"/><path d="M5 12h14"/>
  </svg>
);

interface EmptyState {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface LibraryPageProps {
  title: string;
  itemCount?: number;
  itemNoun?: { singular: string; plural: string };
  onNew?: () => void;
  newLabel?: string;
  isEmpty: boolean;
  isLoading?: boolean;
  emptyState: EmptyState;
  children?: ReactNode;
}

export default function LibraryPage({
  title, itemCount, itemNoun,
  onNew, newLabel,
  isEmpty, isLoading,
  emptyState, children,
}: LibraryPageProps) {
  const showCount = !isEmpty && !isLoading && itemCount !== undefined && itemNoun;
  const showNewButton = !isEmpty && !isLoading && onNew && newLabel;

  return (
    <div className="mobile-safe-scroll" style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)' }}>
      {/* Hero */}
      <div
        className="p-4 md:p-8"
        style={{
          height: '30vh', minHeight: 180,
          background: 'var(--color-bg-surface)',
          display: 'flex', alignItems: 'flex-end',
          position: 'relative', overflow: 'hidden',
        }}
      >
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{
            fontWeight: 'var(--weight-medium)',
            fontSize: 'var(--text-2xl)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-sans)',
            margin: 0,
            letterSpacing: 'var(--tracking-tight)',
          }}>{title}</h1>
          {showCount && (
            <p style={{
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-sans)',
              color: 'var(--color-text-tertiary)',
              margin: 'var(--space-1) 0 0',
            }}>
              {itemCount} {itemCount === 1 ? itemNoun!.singular : itemNoun!.plural}
            </p>
          )}
        </div>
        {showNewButton && (
          <div style={{ position: 'absolute', top: 'var(--space-4)', right: 'var(--space-4)', zIndex: 1 }}>
            <button className="btn btn-primary" onClick={onNew}>
              <PlusIcon />
              {newLabel}
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div
        className="p-4 md:px-8 md:py-6"
        style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}
      >
        {isLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-3)' }}>
            {[0, 1, 2].map(i => (
              <div key={i} className="skeleton-bar" style={{ height: 156, borderRadius: 'var(--radius-lg)' }} />
            ))}
          </div>
        ) : isEmpty ? (
          <div style={{
            flex: 1,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            textAlign: 'center',
            padding: 'var(--space-8)',
          }}>
            <div style={{
              width: 64, height: 64,
              borderRadius: 'var(--radius-xl)',
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-text-tertiary)',
              marginBottom: 'var(--space-5)',
            }}>
              {emptyState.icon}
            </div>
            <div style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-md)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--color-text-primary)',
              marginBottom: 'var(--space-2)',
            }}>
              {emptyState.title}
            </div>
            <div style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-tertiary)',
              maxWidth: 300,
              lineHeight: 'var(--leading-snug)',
              marginBottom: 'var(--space-6)',
            }}>
              {emptyState.description}
            </div>
            {emptyState.actionLabel && emptyState.onAction && (
              <button className="btn btn-primary" onClick={emptyState.onAction}>
                <PlusIcon />
                {emptyState.actionLabel}
              </button>
            )}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

/* ── Grid layout helper — standardizes card grid across libraries ── */
export function LibraryGrid({ children }: { children: ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: 'var(--space-3)',
    }}>
      {children}
    </div>
  );
}
