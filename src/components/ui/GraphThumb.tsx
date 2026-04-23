/* ── GraphThumb — small SVG preview of a workflow's node layout ── */

interface GraphNode { id: string; position: { x: number; y: number }; data: { category: string } }
interface GraphEdge { source: string; target: string }

const CATEGORY_FILL: Record<string, string> = {
  source: 'var(--color-badge-source-bg)',
  generate: 'var(--color-badge-generate-bg)',
  transform: 'var(--color-badge-transform-bg)',
  output: 'var(--color-badge-output-bg)',
};

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width?: number;
  height?: number;
  radius?: number;
}

export default function GraphThumb({ nodes, edges, width = 280, height = 72, radius = 7 }: Props) {
  if (nodes.length === 0) return null;
  const PAD = Math.max(12, radius + 5);
  const xs = nodes.map(n => n.position.x);
  const ys = nodes.map(n => n.position.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const nx = (x: number) => PAD + ((x - minX) / rangeX) * (width - 2 * PAD);
  const ny = (y: number) => PAD + ((y - minY) / rangeY) * (height - 2 * PAD);
  const posMap = new Map(nodes.map(n => [n.id, { x: nx(n.position.x), y: ny(n.position.y) }]));
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
      {edges.map((e, i) => {
        const s = posMap.get(e.source), t = posMap.get(e.target);
        if (!s || !t) return null;
        return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="var(--color-border-strong)" strokeWidth={1.5} strokeLinecap="round" />;
      })}
      {nodes.map(n => {
        const p = posMap.get(n.id);
        if (!p) return null;
        return <circle key={n.id} cx={p.x} cy={p.y} r={radius} style={{ fill: CATEGORY_FILL[n.data.category] ?? 'var(--color-border-strong)' }} />;
      })}
    </svg>
  );
}
