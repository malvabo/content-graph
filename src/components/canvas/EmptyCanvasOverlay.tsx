import { useGraphStore, type ContentNode } from '../../store/graphStore';
import { TEMPLATES } from '../../utils/templates';
import { useState, useRef, useEffect } from 'react';
import { useGraphLayout } from '../../hooks/useGraphLayout';
import { NODE_DEFS_BY_SUBTYPE } from '../../utils/nodeDefs';

function makeSourceNode(content: string): ContentNode {
  const def = NODE_DEFS_BY_SUBTYPE['text-source'];
  return {
    id: `text-source-${Date.now()}`,
    type: 'contentNode',
    position: { x: 200, y: 200 },
    deletable: true,
    data: { subtype: 'text-source', label: def.label, badge: def.badge, category: def.category, description: def.description, config: { text: content } },
  };
}

/* ── Schematic SVG preview for each template ── */
function SchematicPreview({ idx }: { idx: number }) {
  const accent = 'var(--color-accent)';
  const card = 'var(--color-bg-card)';
  const border = 'var(--color-border-default)';
  const ns = { rx: 4, fill: card, stroke: border, strokeWidth: 1 };
  const ts = { fontSize: 6, fontFamily: 'var(--font-sans)', fill: 'var(--color-text-tertiary)', fontWeight: 500 };
  const es = { fill: 'none', stroke: accent, strokeWidth: 1, opacity: 0.5 };

  if (idx === 0) return (
    <svg viewBox="0 0 240 140" style={{ width: '100%', height: '100%' }}>
      <rect x="10" y="50" width="56" height="40" {...ns} /><text x="38" y="73" textAnchor="middle" {...ts}>Text</text>
      <rect x="92" y="14" width="56" height="32" {...ns} /><text x="120" y="33" textAnchor="middle" {...ts}>LinkedIn</text>
      <rect x="92" y="54" width="56" height="32" {...ns} /><text x="120" y="73" textAnchor="middle" {...ts}>Newsletter</text>
      <rect x="92" y="94" width="56" height="32" {...ns} /><text x="120" y="113" textAnchor="middle" {...ts}>Thread</text>
      <rect x="174" y="50" width="56" height="40" {...ns} /><text x="202" y="73" textAnchor="middle" {...ts}>Export</text>
      <path d={`M66 65 L92 30`} {...es} /><path d={`M66 70 L92 70`} {...es} /><path d={`M66 75 L92 110`} {...es} />
      <path d={`M148 30 L174 65`} {...es} /><path d={`M148 70 L174 70`} {...es} /><path d={`M148 110 L174 75`} {...es} />
    </svg>
  );
  if (idx === 1) return (
    <svg viewBox="0 0 240 140" style={{ width: '100%', height: '100%' }}>
      <rect x="10" y="50" width="56" height="40" {...ns} /><text x="38" y="73" textAnchor="middle" {...ts}>Text</text>
      <rect x="92" y="14" width="56" height="32" {...ns} /><text x="120" y="33" textAnchor="middle" {...ts}>Quote</text>
      <rect x="92" y="54" width="56" height="32" {...ns} /><text x="120" y="73" textAnchor="middle" {...ts}>Thread</text>
      <rect x="92" y="94" width="56" height="32" {...ns} /><text x="120" y="113" textAnchor="middle" {...ts}>LinkedIn</text>
      <rect x="174" y="50" width="56" height="40" {...ns} /><text x="202" y="73" textAnchor="middle" {...ts}>Export</text>
      <path d={`M66 65 L92 30`} {...es} /><path d={`M66 70 L92 70`} {...es} /><path d={`M66 75 L92 110`} {...es} />
      <path d={`M148 30 L174 65`} {...es} />
    </svg>
  );
  return (
    <svg viewBox="0 0 240 140" style={{ width: '100%', height: '100%' }}>
      <rect x="10" y="50" width="56" height="40" {...ns} /><text x="38" y="73" textAnchor="middle" {...ts}>Text</text>
      <rect x="92" y="30" width="56" height="32" {...ns} /><text x="120" y="49" textAnchor="middle" {...ts}>Infographic</text>
      <rect x="92" y="78" width="56" height="32" {...ns} /><text x="120" y="97" textAnchor="middle" {...ts}>Image</text>
      <rect x="174" y="50" width="56" height="40" {...ns} /><text x="202" y="73" textAnchor="middle" {...ts}>Export</text>
      <path d={`M66 65 L92 46`} {...es} /><path d={`M66 75 L92 94`} {...es} />
      <path d={`M148 46 L174 65`} {...es} />
    </svg>
  );
}

/* ── Hero banner SVG — abstract node graph ── */
function HeroBanner({ onNew }: { onNew: () => void }) {
  return (
    <div style={{
      position: 'relative', width: '100%', borderRadius: 'var(--radius-xl)',
      background: 'linear-gradient(135deg, var(--color-bg-dark) 0%, #2a3028 100%)',
      overflow: 'hidden', marginBottom: 24,
    }}>
      {/* Decorative nodes */}
      <svg viewBox="0 0 800 200" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15 }}>
        <rect x="420" y="30" width="100" height="60" rx="8" fill="none" stroke="#fff" strokeWidth="1" />
        <rect x="560" y="10" width="90" height="50" rx="8" fill="none" stroke="#fff" strokeWidth="1" />
        <rect x="560" y="80" width="90" height="50" rx="8" fill="none" stroke="#fff" strokeWidth="1" />
        <rect x="690" y="40" width="90" height="60" rx="8" fill="none" stroke="#fff" strokeWidth="1" />
        <path d="M520 60 L560 35" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" opacity="0.6" />
        <path d="M520 60 L560 105" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" opacity="0.6" />
        <path d="M650 35 L690 65" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" opacity="0.4" />
        <path d="M650 105 L690 75" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" opacity="0.4" />
        <circle cx="520" cy="60" r="3" fill="var(--color-accent)" opacity="0.5" />
        <circle cx="560" cy="35" r="3" fill="var(--color-accent)" opacity="0.5" />
        <circle cx="560" cy="105" r="3" fill="var(--color-accent)" opacity="0.5" />
        <circle cx="650" cy="35" r="3" fill="var(--color-accent)" opacity="0.3" />
        <circle cx="650" cy="105" r="3" fill="var(--color-accent)" opacity="0.3" />
      </svg>

      <div style={{ position: 'relative', padding: '40px 32px 36px' }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 20, fontWeight: 600, color: '#fff', margin: 0, letterSpacing: '-.02em' }}>
          Content Graph
        </h1>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.55)', margin: '6px 0 20px', maxWidth: 340, lineHeight: 1.5 }}>
          Connect nodes to repurpose any content into LinkedIn posts, threads, newsletters, and more.
        </p>
        <button onClick={onNew}
          style={{
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500,
            color: 'var(--color-text-primary)', background: '#fff',
            border: 'none', borderRadius: 'var(--radius-full)',
            padding: '8px 20px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
            transition: 'opacity 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
          New Workflow <span style={{ fontSize: 16 }}>→</span>
        </button>
      </div>
    </div>
  );
}

export default function EmptyCanvasOverlay() {
  const { nodes, setNodes, setEdges, setGraphName, addNode } = useGraphStore();
  const { autoLayout } = useGraphLayout();
  const [dismissed, setDismissed] = useState(false);
  const [text, setText] = useState('');
  const [pasting, setPasting] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (pasting) setTimeout(() => taRef.current?.focus(), 100); }, [pasting]);

  // Don't flash empty state while zustand persist is rehydrating
  const [ready, setReady] = useState(() => {
    try {
      const raw = localStorage.getItem('content-graph-store');
      if (raw && JSON.parse(raw)?.state?.nodes?.length > 0) return false;
    } catch { /* ignore */ }
    return true;
  });
  useEffect(() => { if (!ready) { const t = setTimeout(() => setReady(true), 100); return () => clearTimeout(t); } }, [ready]);
  if (!ready || nodes.length > 0 || dismissed) return null;

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
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 24px 48px' }}>

        {/* Hero banner */}
        <HeroBanner onNew={handleNew} />

        {/* Section label */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Start from a template
          </span>
          <button onClick={() => setPasting(!pasting)}
            style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-accent-subtle)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            {pasting ? '← Back' : 'Paste content instead'}
          </button>
        </div>

        {/* Paste area (collapsible) */}
        {pasting && (
          <div style={{ marginBottom: 20 }}>
            <textarea ref={taRef} value={text} onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGo(); }}
              placeholder="Paste an article, transcript, or notes…"
              className="form-textarea"
              style={{ minHeight: 120, borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', background: 'var(--color-bg-card)', marginBottom: 8 }} />
            <div style={{ textAlign: 'right' }}>
              <button onClick={handleGo} disabled={!text.trim()} className="btn btn-primary" style={{ opacity: text.trim() ? 1 : 0.4 }}>
                Create graph →
              </button>
            </div>
          </div>
        )}

        {/* Template grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12 }}>
          {/* Empty workflow card */}
          <button onClick={handleNew}
            style={{
              textAlign: 'left', cursor: 'pointer',
              background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-xl)', overflow: 'hidden',
              transition: 'border-color 150ms, box-shadow 150ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; e.currentTarget.style.boxShadow = 'none'; }}>
            <div style={{
              height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--color-bg-surface)',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 'var(--radius-full)',
                background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              </div>
            </div>
            <div style={{ padding: '12px 16px' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)' }}>Empty Workflow</div>
            </div>
          </button>

          {/* Template cards */}
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
              {/* Schematic preview */}
              <div style={{ height: 140, background: 'var(--color-bg-surface)', padding: '8px 12px', display: 'flex', alignItems: 'center' }}>
                <SchematicPreview idx={i} />
              </div>
              {/* Label */}
              <div style={{ padding: '12px 16px' }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)' }}>{t.name}</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-disabled)', marginTop: 2 }}>{t.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
