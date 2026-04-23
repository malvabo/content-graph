/* ── GraphSchematic — Series-style node-chain illustration for template cards ── */

interface GraphNode {
  id: string;
  position: { x: number; y: number };
  data: { category: string; label: string; description?: string };
}
interface GraphEdge { source: string; target: string }

// Category → coloured icon block. Picks a soft pastel that reads well on the
// card-surface backdrop and matches the workflow node badge tokens.
const CATEGORY_COLORS: Record<string, { bg: string; stroke: string }> = {
  source:    { bg: '#FEF3C7', stroke: '#F59E0B' },    // amber — entry / source
  generate:  { bg: '#D1FAE5', stroke: '#10B981' },    // emerald — generate
  transform: { bg: '#EDE9FE', stroke: '#8B5CF6' },    // violet — transform
  output:    { bg: '#DBEAFE', stroke: '#3B82F6' },    // blue — output
};

// Tiny glyph per category so each cell reads at a glance.
function CategoryGlyph({ category }: { category: string }) {
  const common = { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (category === 'source') return <svg {...common}><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>;
  if (category === 'generate') return <svg {...common}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>;
  if (category === 'transform') return <svg {...common}><path d="M4 12h16"/><path d="m15 5 7 7-7 7"/><path d="m9 19-7-7 7-7"/></svg>;
  if (category === 'output') return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="4"/></svg>;
}

function NodeCell({ node }: { node: GraphNode }) {
  const colors = CATEGORY_COLORS[node.data.category] || CATEGORY_COLORS.source;
  return (
    <div style={{
      flex: '0 0 auto', width: 124, padding: '10px 12px',
      background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)',
      borderRadius: 'var(--radius-md)', boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 20, height: 20, borderRadius: 4, background: colors.bg, color: colors.stroke,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <CategoryGlyph category={node.data.category} />
        </span>
        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: 9, fontWeight: 'var(--weight-medium)',
          color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{node.data.category}</span>
      </div>
      <div style={{
        fontFamily: 'var(--font-sans)', fontSize: 11, lineHeight: 1.35,
        color: 'var(--color-text-primary)',
        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
        overflow: 'hidden', wordBreak: 'break-word',
      }}>{node.data.label}</div>
    </div>
  );
}

function Arrow() {
  return (
    <span aria-hidden style={{ flexShrink: 0, color: 'var(--color-text-tertiary)', display: 'inline-flex', alignItems: 'center' }}>
      <svg width="18" height="12" viewBox="0 0 24 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 6h18" />
        <path d="m16 2 4 4-4 4" />
      </svg>
    </span>
  );
}

interface Props {
  nodes: GraphNode[];
  edges?: GraphEdge[]; // reserved; current layout uses linear order
  maxVisible?: number;
  height?: number;
  background?: string;
  showBorder?: boolean;
}

export default function GraphSchematic({ nodes, maxVisible = 3, height = 124, background = 'var(--color-bg-surface)', showBorder = true }: Props) {
  if (!nodes || nodes.length === 0) return null;
  // Order by x position so the chain reads left→right like the canvas.
  const ordered = [...nodes].sort((a, b) => a.position.x - b.position.x);
  const visible = ordered.slice(0, maxVisible);
  const extra = ordered.length - visible.length;

  return (
    <div style={{
      height, padding: '12px 16px', background,
      borderBottom: showBorder ? '1px solid var(--color-border-subtle)' : 'none',
      display: 'flex', alignItems: 'center', gap: 8,
      overflow: 'hidden', position: 'relative',
    }}>
      {visible.map((node, i) => (
        <span key={node.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {i > 0 && <Arrow />}
          <NodeCell node={node} />
        </span>
      ))}
      {extra > 0 && (
        <>
          <Arrow />
          <span style={{
            flex: '0 0 auto', padding: '4px 10px', borderRadius: 'var(--radius-full)',
            background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)',
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)',
            fontWeight: 'var(--weight-medium)', color: 'var(--color-text-tertiary)',
          }}>+{extra}</span>
        </>
      )}
    </div>
  );
}
