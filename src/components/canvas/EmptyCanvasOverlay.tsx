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
    <svg viewBox="0 0 200 120" className="w-full h-full">
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
    <svg viewBox="0 0 200 120" className="w-full h-full">
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
    <svg viewBox="0 0 200 120" className="w-full h-full">
      <NodeBox x={20} y={49} label="Data" />
      <Edge x1={76} y1={60} x2={120} y2={60} />
      <NodeBox x={120} y={49} label="Infographic" />
    </svg>
  );
}

const THUMBS = [ArticleThumb, TranscriptThumb, ResearchThumb];

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

  const startEmpty = () => setGraphName('Untitled Graph');

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center" style={{ background: 'var(--color-bg)' }}>
      {/* Dotted grid background */}
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle, var(--color-border-subtle) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

      <div className="relative flex flex-col items-center gap-6 max-w-[640px] w-full px-6">
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
          Add a node to get started, or pick a template
        </p>

        <div className="grid grid-cols-2 gap-4 w-full">
          {/* Empty workflow card */}
          <button onClick={startEmpty} className="group flex flex-col rounded-xl overflow-hidden transition-shadow hover:shadow-md" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}
            onMouseEnter={e => e.currentTarget.style.background = '#E6E3DD'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--color-bg-card)'}>
            <div className="flex-1 flex items-center justify-center" style={{ minHeight: 160 }}>
            </div>
            <div className="px-4 pb-4">
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)' }}>Empty Workflow</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>Start from a blank canvas</div>
            </div>
          </button>

          {/* Template cards */}
          {TEMPLATES.map((t, i) => {
            const Thumb = THUMBS[i];
            return (
              <button key={t.name} onClick={() => loadTemplate(i)} className="group flex flex-col rounded-xl overflow-hidden transition-shadow hover:shadow-md" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)' }}
                onMouseEnter={e => e.currentTarget.style.background = '#E6E3DD'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--color-bg-card)'}>
                <div className="flex items-center justify-center px-4 pt-4" style={{ minHeight: 160 }}>
                  <Thumb />
                </div>
                <div className="px-4 pb-4 pt-2">
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)' }}>{t.name}</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>{t.description}</div>
                </div>
              </button>
            );
          })}
        </div>

        <button onClick={() => setDismissed(true)} className="mt-2 transition-colors" style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
