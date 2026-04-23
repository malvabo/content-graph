/* ── TemplateCard — DS component matching Figma node 8-298 ── */
import GraphThumb from './GraphThumb';

interface GraphNode { id: string; position: { x: number; y: number }; data: { category: string } }
interface GraphEdge { source: string; target: string }

interface TemplateCardProps {
  title: string;
  meta: string;
  description?: string;
  pills: string[];
  extraCount?: number;
  onClick?: () => void;
  graphData?: { nodes: GraphNode[]; edges: GraphEdge[] };
}

export default function TemplateCard({ title, meta, description, pills, extraCount, onClick, graphData }: TemplateCardProps) {
  const HP = 20;
  return (
    <button onClick={onClick} style={{
      display: 'flex', width: '100%', flexDirection: 'column',
      alignItems: 'stretch',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--color-border-default)',
      background: 'var(--color-bg-card)',
      cursor: 'pointer', textAlign: 'left', overflow: 'hidden',
      transition: 'border-color 150ms ease-out, box-shadow 150ms ease-out, transform 150ms ease-out',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--color-border-strong)';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--color-border-default)';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {graphData && graphData.nodes.length > 0 && (
        <div style={{ background: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border-subtle)', padding: '8px 0' }}>
          <GraphThumb nodes={graphData.nodes} edges={graphData.edges} />
        </div>
      )}

      {/* Title + meta + optional description */}
      <div style={{
        padding: `14px ${HP}px`,
        borderBottom: pills.length > 0 && !graphData ? '1px solid var(--color-border-subtle)' : 'none',
        display: 'flex', flexDirection: 'column', gap: 3,
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
        {description && (
          <div style={{
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-normal)',
            color: 'var(--color-text-secondary)', lineHeight: 1.5, marginTop: 4,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>{description}</div>
        )}
      </div>

      {/* Pill bar — shown only when no graphData thumbnail */}
      {!graphData && pills.length > 0 && (
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
      )}
    </button>
  );
}
