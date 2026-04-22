/* ── TemplateCard — DS component matching Figma node 8-298 ── */

interface TemplateCardProps {
  title: string;
  meta: string;
  pills: string[];
  extraCount?: number;
  onClick?: () => void;
}

export default function TemplateCard({ title, meta, pills, extraCount, onClick }: TemplateCardProps) {
  // One horizontal inset used by both rows so the divider, title, and pill bar
  // all hang from the same gutter. Vertical rhythm: 16 top, 16 bottom, 14 between.
  const HP = 20;
  return (
    <button onClick={onClick} style={{
      display: 'flex', width: '100%', flexDirection: 'column',
      alignItems: 'stretch',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--color-border-default)',
      background: 'var(--color-bg-card)',
      cursor: 'pointer', textAlign: 'left', overflow: 'hidden',
      transition: 'border-color 150ms, box-shadow 150ms',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Top: title + meta — padding matches the bottom row */}
      <div style={{
        padding: `16px ${HP}px`,
        borderBottom: '1px solid var(--color-border-subtle)',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <div style={{
          fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)',
          color: 'var(--color-text-primary)', lineHeight: 1.4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{title}</div>
        <div style={{
          fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-normal)',
          color: 'var(--color-text-tertiary)', lineHeight: 1.4,
        }}>{meta}</div>
      </div>

      {/* Bottom: node pill bar */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: `12px ${HP}px`,
        gap: 8,
        overflow: 'hidden',
      }}>
        {pills.map((label, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {i > 0 && (
              <span style={{
                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)',
                color: 'var(--color-text-tertiary)', lineHeight: 1,
              }}>→</span>
            )}
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '5px 10px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-normal)', color: 'var(--color-text-secondary)',
              lineHeight: 1.25, whiteSpace: 'nowrap',
            }}>{label}</span>
          </div>
        ))}
        {extraCount && extraCount > 0 && (
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)',
            color: 'var(--color-text-tertiary)',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>+{extraCount}</span>
        )}
      </div>
    </button>
  );
}
