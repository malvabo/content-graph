/* ── TemplateCard — DS component ── */

interface TemplateCardProps {
  title: string;
  meta: string;
  pills: string[];
  extraCount?: number;
  onClick?: () => void;
}

export default function TemplateCard({ title, meta, pills, extraCount, onClick }: TemplateCardProps) {
  return (
    <div role="button" tabIndex={0} onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
      padding: 'var(--space-4)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--color-border-default)',
      background: 'var(--color-bg-card)',
      cursor: 'pointer', textAlign: 'left',
      transition: 'border-color 150ms, box-shadow 150ms',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Title */}
      <div style={{
        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)',
        color: 'var(--color-text-primary)', lineHeight: 'var(--leading-tight)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{title}</div>

      {/* Pills with arrows */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {pills.map((label, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <span style={{ color: 'var(--color-text-disabled)', fontSize: 10 }}>→</span>}
            <span style={{
              fontSize: 11, fontWeight: 500, fontFamily: 'var(--font-sans)',
              padding: '2px 8px', borderRadius: 'var(--radius-sm)',
              background: 'var(--color-bg-surface)',
              color: 'var(--color-text-secondary)',
              lineHeight: '16px', whiteSpace: 'nowrap',
            }}>{label}</span>
          </span>
        ))}
        {extraCount && extraCount > 0 && (
          <span style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)' }}>+{extraCount}</span>
        )}
      </div>

      {/* Meta */}
      <div style={{
        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)',
        color: 'var(--color-text-disabled)', lineHeight: 'var(--leading-tight)',
      }}>{meta}</div>
    </div>
  );
}
