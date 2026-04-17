import { useGraphStore, type ContentNode } from '../../store/graphStore';
import { TEMPLATES } from '../../utils/templates';
import { useState, useRef, useEffect } from 'react';
import { useGraphLayout } from '../../hooks/useGraphLayout';
import { NODE_DEFS_BY_SUBTYPE } from '../../utils/nodeDefs';

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
function SchematicPreview({ idx }: { idx: number }) {
  const card = 'var(--color-bg-card)';
  const border = 'var(--color-border-default)';
  const accent = 'var(--color-accent)';
  const ns = { rx: 6, fill: card, stroke: border, strokeWidth: 1 };
  const ts: React.SVGAttributes<SVGTextElement> = { fontSize: 7, fontFamily: 'var(--font-sans)', fill: 'var(--color-text-tertiary)', fontWeight: 500, textAnchor: 'middle' as const };
  const es = { fill: 'none', stroke: accent, strokeWidth: 1.2, opacity: 0.4 };
  const dot = (cx: number, cy: number) => <circle cx={cx} cy={cy} r="2.5" fill={accent} opacity="0.5" />;

  if (idx === 0) return (
    <svg viewBox="0 0 260 140" style={{ width: '100%', height: '100%' }}>
      <rect x="10" y="50" width="60" height="40" {...ns} /><text x="40" y="74" {...ts}>Text</text>
      <rect x="100" y="10" width="60" height="34" {...ns} /><text x="130" y="31" {...ts}>LinkedIn</text>
      <rect x="100" y="53" width="60" height="34" {...ns} /><text x="130" y="74" {...ts}>Newsletter</text>
      <rect x="100" y="96" width="60" height="34" {...ns} /><text x="130" y="117" {...ts}>Thread</text>
      <rect x="190" y="50" width="60" height="40" {...ns} /><text x="220" y="74" {...ts}>Export</text>
      <path d="M70 65 Q85 27 100 27" {...es} /><path d="M70 70 L100 70" {...es} /><path d="M70 75 Q85 113 100 113" {...es} />
      <path d="M160 27 Q175 65 190 65" {...es} /><path d="M160 70 L190 70" {...es} /><path d="M160 113 Q175 75 190 75" {...es} />
      {dot(70, 70)}{dot(100, 27)}{dot(100, 70)}{dot(100, 113)}{dot(160, 27)}{dot(160, 70)}{dot(160, 113)}{dot(190, 70)}
    </svg>
  );
  if (idx === 1) return (
    <svg viewBox="0 0 260 140" style={{ width: '100%', height: '100%' }}>
      <rect x="10" y="50" width="60" height="40" {...ns} /><text x="40" y="74" {...ts}>Text</text>
      <rect x="100" y="10" width="60" height="34" {...ns} /><text x="130" y="31" {...ts}>Quote</text>
      <rect x="100" y="53" width="60" height="34" {...ns} /><text x="130" y="74" {...ts}>Thread</text>
      <rect x="100" y="96" width="60" height="34" {...ns} /><text x="130" y="117" {...ts}>LinkedIn</text>
      <rect x="190" y="50" width="60" height="40" {...ns} /><text x="220" y="74" {...ts}>Export</text>
      <path d="M70 65 Q85 27 100 27" {...es} /><path d="M70 70 L100 70" {...es} /><path d="M70 75 Q85 113 100 113" {...es} />
      <path d="M160 27 Q175 65 190 65" {...es} />
      {dot(70, 70)}{dot(100, 27)}{dot(100, 70)}{dot(100, 113)}{dot(160, 27)}{dot(190, 65)}
    </svg>
  );
  return (
    <svg viewBox="0 0 260 140" style={{ width: '100%', height: '100%' }}>
      <rect x="10" y="50" width="60" height="40" {...ns} /><text x="40" y="74" {...ts}>Text</text>
      <rect x="100" y="28" width="60" height="34" {...ns} /><text x="130" y="49" {...ts}>Infographic</text>
      <rect x="100" y="78" width="60" height="34" {...ns} /><text x="130" y="99" {...ts}>Image</text>
      <rect x="190" y="50" width="60" height="40" {...ns} /><text x="220" y="74" {...ts}>Export</text>
      <path d="M70 65 Q85 45 100 45" {...es} /><path d="M70 75 Q85 95 100 95" {...es} />
      <path d="M160 45 Q175 65 190 65" {...es} />
      {dot(70, 70)}{dot(100, 45)}{dot(100, 95)}{dot(160, 45)}{dot(190, 65)}
    </svg>
  );
}

/* ── Hero banner ── */
function HeroBanner({ onNew }: { onNew: () => void }) {
  return (
    <div style={{
      position: 'relative', width: '100%', borderRadius: 'var(--radius-xl)',
      background: 'linear-gradient(135deg, var(--color-bg-dark) 0%, #2a3028 100%)',
      overflow: 'hidden',
    }}>
      {/* Decorative graph */}
      <svg viewBox="0 0 800 200" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.12 }}>
        <rect x="400" y="35" width="110" height="55" rx="10" fill="none" stroke="#fff" strokeWidth="1" />
        <rect x="550" y="15" width="95" height="45" rx="10" fill="none" stroke="#fff" strokeWidth="1" />
        <rect x="550" y="85" width="95" height="45" rx="10" fill="none" stroke="#fff" strokeWidth="1" />
        <rect x="690" y="45" width="95" height="55" rx="10" fill="none" stroke="#fff" strokeWidth="1" />
        <path d="M510 62 Q530 37 550 37" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" opacity="0.5" />
        <path d="M510 62 Q530 107 550 107" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" opacity="0.5" />
        <path d="M645 37 Q667 72 690 72" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" opacity="0.35" />
        <path d="M645 107 Q667 72 690 72" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" opacity="0.35" />
        <circle cx="510" cy="62" r="3.5" fill="var(--color-accent)" opacity="0.5" />
        <circle cx="550" cy="37" r="3.5" fill="var(--color-accent)" opacity="0.4" />
        <circle cx="550" cy="107" r="3.5" fill="var(--color-accent)" opacity="0.4" />
        <circle cx="645" cy="37" r="3" fill="var(--color-accent)" opacity="0.3" />
        <circle cx="645" cy="107" r="3" fill="var(--color-accent)" opacity="0.3" />
        <circle cx="690" cy="72" r="3" fill="var(--color-accent)" opacity="0.3" />
      </svg>

      <div style={{ position: 'relative', padding: 'var(--space-8) var(--space-6) var(--space-8)' }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 20, fontWeight: 600, color: '#fff', margin: 0, letterSpacing: '-.02em' }}>
          Content Graph
        </h1>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.5)', margin: 'var(--space-2) 0 var(--space-5)', maxWidth: 360, lineHeight: 1.5 }}>
          Connect nodes to repurpose any content into LinkedIn posts, threads, newsletters, and more.
        </p>
        <button onClick={onNew}
          style={{
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500,
            color: 'var(--color-bg-dark)', background: 'var(--color-bg-card)',
            border: 'none', borderRadius: 'var(--radius-full)',
            padding: 'var(--space-2) var(--space-5)', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)',
            transition: 'opacity 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
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

  if (!(hydrated || forceReady) || nodes.length > 0 || dismissed) return null;

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
    setGraphName(TEMPLATES[idx].name);
    setDismissed(true);
    setTimeout(autoLayout, 0);
  };

  const handleNew = () => { setGraphName('Untitled Graph'); setDismissed(true); };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'var(--color-bg)', overflow: 'auto' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: 'var(--space-6) var(--space-6) var(--space-8)' }}>

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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
          {/* Empty workflow */}
          <button onClick={handleNew}
            style={{
              textAlign: 'left', cursor: 'pointer',
              background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-xl)', overflow: 'hidden',
              transition: 'border-color 150ms, box-shadow 150ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; e.currentTarget.style.boxShadow = 'none'; }}>
            <div style={{ height: 148, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-surface)' }}>
              <div style={{
                width: 44, height: 44, borderRadius: 'var(--radius-full)',
                background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              </div>
            </div>
            <div style={{ padding: 'var(--space-3) var(--space-4)' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)' }}>Empty Workflow</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-disabled)', marginTop: 'var(--space-1)' }}>Start from scratch</div>
            </div>
          </button>

          {/* Templates */}
          {TEMPLATES.map((t, i) => (
            <button key={t.name} onClick={() => loadTemplate(i)}
              style={{
                textAlign: 'left', cursor: 'pointer',
                background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-xl)', overflow: 'hidden',
                transition: 'border-color 150ms, box-shadow 150ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; e.currentTarget.style.boxShadow = 'none'; }}>
              <div style={{ height: 148, background: 'var(--color-bg-surface)', padding: 'var(--space-3)', display: 'flex', alignItems: 'center' }}>
                <SchematicPreview idx={i} />
              </div>
              <div style={{ padding: 'var(--space-3) var(--space-4)' }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)' }}>{t.name}</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-disabled)', marginTop: 'var(--space-1)' }}>{t.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
