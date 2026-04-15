import { useGraphStore } from '../../store/graphStore';
import { TEMPLATES } from '../../utils/templates';
import { useState } from 'react';
import { useGraphLayout } from '../../hooks/useGraphLayout';

/* Minimal node-graph SVG thumbnails */
const NodeBox = ({ x, y, label }: { x: number; y: number; label: string }) => (
  <g>
    <rect x={x} y={y} width={56} height={22} rx={5} fill="var(--color-bg-card)" stroke="var(--color-border-subtle)" strokeWidth={1} />
    <text x={x + 28} y={y + 14} textAnchor="middle" fontSize={7} fontFamily="var(--font-sans)" fill="var(--color-text-tertiary)">{label}</text>
  </g>
);

const Edge = ({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) => {
  const mx = (x1 + x2) / 2;
  return <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke="var(--color-border-subtle)" strokeWidth={1} />;
};

function ArticleThumb() {
  return (
    <svg viewBox="0 0 200 120" style={{ width: '100%', height: '100%' }}>
      <NodeBox x={10} y={49} label="Article" />
      <Edge x1={66} y1={60} x2={130} y2={18} />
      <Edge x1={66} y1={60} x2={130} y2={44} />
      <Edge x1={66} y1={60} x2={130} y2={70} />
      <Edge x1={66} y1={60} x2={130} y2={96} />
      <NodeBox x={130} y={7} label="LinkedIn" />
      <NodeBox x={130} y={33} label="Newsletter" />
      <NodeBox x={130} y={59} label="Twitter" />
      <NodeBox x={130} y={85} label="Blog" />
    </svg>
  );
}

function TranscriptThumb() {
  return (
    <svg viewBox="0 0 200 120" style={{ width: '100%', height: '100%' }}>
      <NodeBox x={10} y={49} label="Transcript" />
      <Edge x1={66} y1={60} x2={130} y2={24} />
      <Edge x1={66} y1={60} x2={130} y2={60} />
      <Edge x1={66} y1={60} x2={130} y2={96} />
      <NodeBox x={130} y={13} label="Carousel" />
      <NodeBox x={130} y={49} label="Thread" />
      <NodeBox x={130} y={85} label="Post" />
    </svg>
  );
}

function ResearchThumb() {
  return (
    <svg viewBox="0 0 200 120" style={{ width: '100%', height: '100%' }}>
      <NodeBox x={20} y={49} label="Data" />
      <Edge x1={76} y1={60} x2={120} y2={60} />
      <NodeBox x={120} y={49} label="Infographic" />
    </svg>
  );
}

const THUMBS = [ArticleThumb, TranscriptThumb, ResearchThumb];

/* Shared card style */
const cardStyle: React.CSSProperties = {
  background: 'var(--color-bg-card)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 12,
  overflow: 'hidden',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  transition: 'box-shadow .2s, border-color .2s',
  outline: 'none',
};

export default function EmptyCanvasOverlay() {
  const { nodes, setNodes, setEdges, setGraphName } = useGraphStore();
  const { autoLayout } = useGraphLayout();
  const [dismissed, setDismissed] = useState(false);
  if (nodes.length > 0 || dismissed) return null;

  const loadTemplate = (idx: number) => {
    const { nodes, edges } = TEMPLATES[idx].build();
    setNodes(nodes);
    setEdges(edges);
    setGraphName(TEMPLATES[idx].name);
    setTimeout(autoLayout, 0);
  };

  const hover = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.borderColor = 'var(--color-text-tertiary)';
    e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,.08)';
  };
  const unhover = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.borderColor = 'var(--color-border-subtle)';
    e.currentTarget.style.boxShadow = 'none';
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
      {/* Dotted grid */}
      <div style={{ position: 'absolute', inset: 0, opacity: .3, backgroundImage: 'radial-gradient(circle, var(--color-border-subtle) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, maxWidth: 640, width: '100%', padding: '0 24px' }}>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: 0 }}>
          Add a node to get started, or pick a template
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, width: '100%' }}>
          {/* Empty workflow — dashed border placeholder */}
          <button
            onClick={() => setGraphName('Untitled Graph')}
            onMouseEnter={hover}
            onMouseLeave={unhover}
            style={{ ...cardStyle, borderStyle: 'dashed' }}
          >
            <div style={{ flex: 1, minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', opacity: .5 }}>Blank canvas</span>
            </div>
            <div style={{ padding: '0 16px 16px' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)' }}>Empty Workflow</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>Start from a blank canvas</div>
            </div>
          </button>

          {/* Template cards */}
          {TEMPLATES.map((t, i) => {
            const Thumb = THUMBS[i];
            return (
              <button
                key={t.name}
                onClick={() => loadTemplate(i)}
                onMouseEnter={hover}
                onMouseLeave={unhover}
                style={cardStyle}
              >
                <div style={{ minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 16px 0' }}>
                  <Thumb />
                </div>
                <div style={{ padding: '8px 16px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)' }}>{t.name}</div>
                  <div style={{
                    fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 2,
                  }} className="desc-clamp">{t.description}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Dismiss as ghost button */}
        <button
          onClick={() => setDismissed(true)}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-border-subtle)'; e.currentTarget.style.color = 'var(--color-text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
          style={{
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)',
            background: 'transparent', border: '1px solid var(--color-border-subtle)', borderRadius: 8,
            padding: '6px 20px', cursor: 'pointer', transition: 'background .15s, color .15s', outline: 'none',
          }}
        >
          Dismiss
        </button>
      </div>

      {/* focus-visible ring for all buttons */}
      <style>{`
        button:focus-visible { box-shadow: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-text-tertiary) !important; }
        .desc-clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>
    </div>
  );
}
