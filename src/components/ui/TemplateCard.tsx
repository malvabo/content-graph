/* ── TemplateCard — DS component matching Figma node 8-298 ── */

interface GraphNode { id: string; position: { x: number; y: number }; data: { category: string } }
interface GraphEdge { source: string; target: string }

interface TemplateCardProps {
  title: string;
  meta: string;
  pills: string[];
  extraCount?: number;
  onClick?: () => void;
  graphData?: { nodes: GraphNode[]; edges: GraphEdge[] };
}

const CATEGORY_FILL: Record<string, string> = {
  source: 'var(--color-badge-source-bg)',
  generate: 'var(--color-badge-generate-bg)',
  transform: 'var(--color-badge-transform-bg)',
  output: 'var(--color-badge-output-bg)',
};

function GraphThumb({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  if (nodes.length === 0) return null;
  const W = 280, H = 72, PAD = 20, R = 7;
  const xs = nodes.map(n => n.position.x);
  const ys = nodes.map(n => n.position.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const nx = (x: number) => PAD + ((x - minX) / rangeX) * (W - 2 * PAD);
  const ny = (y: number) => PAD + ((y - minY) / rangeY) * (H - 2 * PAD);
  const posMap = new Map(nodes.map(n => [n.id, { x: nx(n.position.x), y: ny(n.position.y) }]));
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
      {edges.map((e, i) => {
        const s = posMap.get(e.source), t = posMap.get(e.target);
        if (!s || !t) return null;
        return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="var(--color-border-strong)" strokeWidth={1.5} strokeLinecap="round" />;
      })}
      {nodes.map(n => {
        const p = posMap.get(n.id);
        if (!p) return null;
        return <circle key={n.id} cx={p.x} cy={p.y} r={R} style={{ fill: CATEGORY_FILL[n.data.category] ?? 'var(--color-border-strong)' }} />;
      })}
    </svg>
  );
}

export default function TemplateCard({ title, meta, pills, extraCount, onClick, graphData }: TemplateCardProps) {
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
      {graphData && graphData.nodes.length > 0 && (
        <>
          <div style={{ background: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border-subtle)', padding: '8px 0' }}>
            <GraphThumb nodes={graphData.nodes} edges={graphData.edges} />
          </div>
        </>
      )}

      {/* Title + meta */}
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
