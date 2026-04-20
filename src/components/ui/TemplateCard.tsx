/* ── TemplateCard — DS component matching Figma node 8-298 ── */

interface TemplateCardProps {
  title: string;
  meta: string;
  pills: string[];
  extraCount?: number;
  onClick?: () => void;
}

export default function TemplateCard({ title, meta, pills, extraCount, onClick }: TemplateCardProps) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', width: '100%', height: 129, flexDirection: 'column',
      justifyContent: 'space-between', alignItems: 'stretch',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--color-border-default)',
      background: 'var(--color-bg-dark)',
      cursor: 'pointer', textAlign: 'left', overflow: 'hidden',
      transition: 'border-color 150ms, box-shadow 150ms',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Top: title + meta */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 32px 0 16px' }}>
          <div style={{
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)',
            color: 'var(--p-neutral-200)', lineHeight: '21px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{title}</div>
        </div>
        <div style={{ padding: '8px 16px 12px 16px' }}>
          <div style={{
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-normal)',
            color: 'var(--color-text-tertiary)', lineHeight: '18px',
          }}>{meta}</div>
        </div>
      </div>

      {/* Bottom: node pill bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        padding: '12px 16px',
        background: 'var(--color-bg-dark)',
        borderTop: '1px solid var(--color-border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', overflow: 'hidden' }}>
          {pills.map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {i > 0 && (
                <span style={{
                  fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-tertiary)', padding: '0 4px',
                }}>→</span>
              )}
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '4px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-bg-dark)',
                border: '1px solid var(--color-border-subtle)',
                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-normal)', color: 'var(--color-text-secondary)',
                lineHeight: '18px', whiteSpace: 'nowrap',
              }}>{label}</span>
            </div>
          ))}
          {extraCount && extraCount > 0 && (
            <span style={{
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)',
              color: 'var(--color-text-tertiary)', marginLeft: 'var(--space-1)',
              whiteSpace: 'nowrap',
            }}> +{extraCount}</span>
          )}
        </div>
      </div>
    </button>
  );
}
