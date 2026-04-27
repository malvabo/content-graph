import { useGraphStore, type ContentNode } from '../../store/graphStore';
import { TEMPLATES } from '../../utils/templates';
import { useState, useRef, useEffect } from 'react';
import { useGraphLayout } from '../../hooks/useGraphLayout';
import { NODE_DEFS_BY_SUBTYPE } from '../../utils/nodeDefs';

import TemplateCard from '../ui/TemplateCard';

function makeSourceNode(content: string): ContentNode {
  const def = NODE_DEFS_BY_SUBTYPE['text-source'];
  return {
    id: `text-source-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    type: 'contentNode',
    position: { x: 200, y: 200 },
    deletable: true,
    data: { subtype: 'text-source', label: def.label, badge: def.badge, category: def.category, description: def.description, config: { text: content } },
  };
}

/* ── Schematic SVG preview ── */

/* ── Hero banner ── */
function HeroBanner({ onNew }: { onNew: () => void }) {
  return (
    <div style={{
      position: 'relative', width: '100%', borderRadius: 'var(--radius-xl)',
      background: 'linear-gradient(135deg, var(--color-bg-dark) 0%, #2a3028 100%)',
      overflow: 'hidden',
    }}>
      {/* Decorative node graph illustration */}
      <svg viewBox="0 0 800 200" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
        {/* Node rectangles */}
        <rect x="400" y="35" width="110" height="55" rx="10" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        <text x="455" y="67" fontSize="11" fontFamily="var(--font-sans)" fill="rgba(255,255,255,0.25)" textAnchor="middle">Source</text>
        <rect x="560" y="15" width="95" height="45" rx="10" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
        <text x="607" y="42" fontSize="10" fontFamily="var(--font-sans)" fill="rgba(255,255,255,0.2)" textAnchor="middle">LinkedIn</text>
        <rect x="560" y="85" width="95" height="45" rx="10" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
        <text x="607" y="112" fontSize="10" fontFamily="var(--font-sans)" fill="rgba(255,255,255,0.2)" textAnchor="middle">Thread</text>
        <rect x="700" y="45" width="85" height="55" rx="10" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
        <text x="742" y="77" fontSize="10" fontFamily="var(--font-sans)" fill="rgba(255,255,255,0.18)" textAnchor="middle">Export</text>
        {/* Connecting lines with arrow tips */}
        <path d="M510 55 Q535 37 560 37" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" />
        <path d="M510 70 Q535 107 560 107" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" />
        <path d="M655 37 Q677 65 700 65" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" />
        <path d="M655 107 Q677 80 700 80" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" />
        {/* Arrow tips */}
        <polygon points="558,33 558,41 565,37" fill="rgba(255,255,255,0.2)" />
        <polygon points="558,103 558,111 565,107" fill="rgba(255,255,255,0.2)" />
        <polygon points="698,61 698,69 705,65" fill="rgba(255,255,255,0.15)" />
        {/* Connection dots */}
        <circle cx="510" cy="55" r="3" fill="rgba(255,255,255,0.25)" />
        <circle cx="510" cy="70" r="3" fill="rgba(255,255,255,0.25)" />
        <circle cx="655" cy="37" r="2.5" fill="rgba(255,255,255,0.18)" />
        <circle cx="655" cy="107" r="2.5" fill="rgba(255,255,255,0.18)" />
      </svg>

      <div style={{ position: 'relative', padding: 'var(--space-8) var(--space-6) var(--space-8)' }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--p-white)', margin: 0, letterSpacing: '-.02em' }}>
          Content Graph
        </h1>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-on-dark)', margin: 'var(--space-2) 0 var(--space-5)', maxWidth: 360, lineHeight: 1.5 }}>
          Connect nodes to repurpose any content into LinkedIn posts, threads, newsletters, and more.
        </p>
        <button onClick={onNew} className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          New Workflow →
        </button>
      </div>
    </div>
  );
}

export default function EmptyCanvasOverlay() {
  const { nodes, setNodes, setEdges, setGraphName, addNode } = useGraphStore();
  const hydrated = useGraphStore((s) => s._hydrated);
  const [forceReady, setForceReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setForceReady(true), 500); return () => clearTimeout(t); }, []);
  const { autoLayout } = useGraphLayout();
  const [dismissed, setDismissed] = useState(false);
  const [text, setText] = useState('');
  const [pasting, setPasting] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (pasting) setTimeout(() => taRef.current?.focus(), 100); }, [pasting]);

  const shouldHide = !(hydrated || forceReady) || nodes.length > 0 || dismissed;
  const [visible, setVisible] = useState(!shouldHide);
  useEffect(() => { if (shouldHide) { const t = setTimeout(() => setVisible(false), 200); return () => clearTimeout(t); } else { setVisible(true); } }, [shouldHide]);
  if (!visible && shouldHide) return null;

  const handleGo = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    addNode(makeSourceNode(trimmed));
    setGraphName('Untitled Graph');
    setDismissed(true);
  };

  const loadTemplate = (idx: number) => {
    const { nodes: n, edges: e } = TEMPLATES[idx].build();
    const trimmed = text.trim();
    if (trimmed) {
      const src = n.find(nd => nd.data.subtype === 'text-source');
      if (src) src.data.config = { ...src.data.config, text: trimmed };
    }
    setNodes(n);
    setEdges(e);
    setGraphName(`${TEMPLATES[idx].name} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    setDismissed(true);
    setTimeout(autoLayout, 0);
  };

  const handleNew = () => { setGraphName('Untitled Graph'); setDismissed(true); };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'var(--color-bg)', overflow: 'auto', opacity: shouldHide ? 0 : 1, transition: 'opacity 200ms ease', pointerEvents: shouldHide ? 'none' : 'auto' }}>
      <div style={{ width: '100%', margin: '0 auto', padding: 'var(--space-6) var(--space-8) var(--space-8)' }}>

        {/* Hero */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <HeroBanner onNew={handleNew} />
        </div>

        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <span className="text-label">Start from a template</span>
          <button onClick={() => setPasting(!pasting)}
            style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-accent-subtle)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            {pasting ? '← Back' : 'Paste content instead'}
          </button>
        </div>

        {/* Paste area */}
        {pasting && (
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <textarea ref={taRef} value={text} onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGo(); }}
              placeholder="Paste an article, transcript, or notes…"
              className="form-textarea"
              style={{ minHeight: 120, borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', background: 'var(--color-bg-card)', marginBottom: 'var(--space-2)' }} />
            <div style={{ textAlign: 'right' }}>
              <button onClick={handleGo} disabled={!text.trim()} className="btn btn-primary" style={{ opacity: text.trim() ? 1 : 0.4 }}>
                Create graph →
              </button>
            </div>
          </div>
        )}

        {/* Template grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-3)', paddingBottom: 'var(--space-8)' }}>
          <TemplateCard title="+ Empty Workflow" meta="Start from scratch" pills={[]} onClick={handleNew} />
          {TEMPLATES.map((t, i) => {
            const { nodes: n } = t.build();
            const nodeLabels = n.slice(0, 2).map(nd => nd.data.label);
            const extra = n.length - 2;
            return <TemplateCard key={t.name} title={t.name} meta={`${n.length} nodes`} pills={nodeLabels} extraCount={extra > 0 ? extra : undefined} icon={t.icon} onClick={() => loadTemplate(i)} />;
          })}
        </div>
      </div>
    </div>
  );
}
