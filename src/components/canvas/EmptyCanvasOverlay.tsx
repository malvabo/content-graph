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

/* Template card icons — colored circles with emoji */
const TEMPLATE_ICONS = ['📄', '🎙️', '📊'];
const TEMPLATE_ICON_BG = ['#EDE8F0', '#E8EDE5', '#E5ECF0'];

/* Node pills with category colors */
const PILL_COLORS: Record<string, { bg: string; text: string }> = {
  'Text': { bg: 'var(--color-badge-source-bg)', text: 'var(--color-badge-source-text)' },
  'LinkedIn': { bg: 'var(--color-badge-generate-bg)', text: 'var(--color-badge-generate-text)' },
  'LinkedIn ×2': { bg: 'var(--color-badge-generate-bg)', text: 'var(--color-badge-generate-text)' },
  'Newsletter': { bg: 'var(--color-badge-generate-bg)', text: 'var(--color-badge-generate-text)' },
  'Thread': { bg: 'var(--color-badge-generate-bg)', text: 'var(--color-badge-generate-text)' },
  'Thread ×2': { bg: 'var(--color-badge-generate-bg)', text: 'var(--color-badge-generate-text)' },
  'Quote': { bg: 'var(--color-badge-generate-bg)', text: 'var(--color-badge-generate-text)' },
  'Infographic': { bg: 'var(--color-badge-generate-bg)', text: 'var(--color-badge-generate-text)' },
  'Image': { bg: 'var(--color-badge-generate-bg)', text: 'var(--color-badge-generate-text)' },
  'Export': { bg: 'var(--color-badge-output-bg)', text: 'var(--color-badge-output-text)' },
};

/* Node count badges for template cards */
const TEMPLATE_NODES = [
  ['Text', 'LinkedIn ×2', 'Newsletter', 'Thread', 'Export'],
  ['Text', 'Quote', 'Thread ×2', 'LinkedIn', 'Export'],
  ['Text', 'Infographic', 'Image', 'Export'],
];

export default function EmptyCanvasOverlay() {
  const { nodes, setNodes, setEdges, setGraphName, addNode } = useGraphStore();
  const { autoLayout } = useGraphLayout();
  const [dismissed, setDismissed] = useState(false);
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'pick' | 'paste'>('pick');
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (mode === 'paste') setTimeout(() => taRef.current?.focus(), 100); }, [mode]);

  if (nodes.length > 0 || dismissed) return null;

  // Don't flash empty state while zustand persist is rehydrating
  const [ready, setReady] = useState(() => {
    try {
      const raw = localStorage.getItem('content-graph-store');
      if (raw && JSON.parse(raw)?.state?.nodes?.length > 0) return false;
    } catch { /* ignore */ }
    return true;
  });
  useEffect(() => { if (!ready) { const t = setTimeout(() => setReady(true), 100); return () => clearTimeout(t); } }, [ready]);
  if (!ready || nodes.length > 0) return null;

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

  const hasText = text.trim().length > 0;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', overflow: 'auto' }}>
      {/* Dot grid */}
      <div style={{ position: 'absolute', inset: 0, opacity: .2, backgroundImage: 'radial-gradient(circle, var(--color-dot) var(--dot-size), transparent var(--dot-size))', backgroundSize: 'var(--dot-gap) var(--dot-gap)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 600, width: '100%', padding: '0 24px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-.02em' }}>
            Repurpose anything
          </h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: '8px 0 0', lineHeight: 'var(--leading-loose)' }}>
            Turn one piece of content into LinkedIn posts, threads, newsletters, and more.
          </p>
        </div>

        {/* Template cards */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {TEMPLATES.map((t, i) => (
            <button key={t.name} onClick={() => loadTemplate(i)}
              style={{
                width: '100%', textAlign: 'left', cursor: 'pointer',
                background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-xl)', padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: 16,
                transition: 'border-color 150ms, box-shadow 150ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; e.currentTarget.style.boxShadow = 'none'; }}>
              <div style={{
                width: 44, height: 44, borderRadius: 'var(--radius-full)',
                background: TEMPLATE_ICON_BG[i],
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, flexShrink: 0, lineHeight: 1,
              }}>
                {TEMPLATE_ICONS[i]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)' }}>{t.name}</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-disabled)', marginTop: 2 }}>{t.description}</div>
                <div style={{ display: 'flex', gap: 5, marginTop: 10, flexWrap: 'wrap' }}>
                  {TEMPLATE_NODES[i].map((n, j) => {
                    const c = PILL_COLORS[n] || { bg: 'var(--color-bg-surface)', text: 'var(--color-text-disabled)' };
                    return (
                      <span key={n + j} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{
                          fontSize: 11, fontFamily: 'var(--font-sans)', fontWeight: 500,
                          color: c.text, background: c.bg,
                          borderRadius: 'var(--radius-full)', padding: '3px 10px',
                          lineHeight: '16px',
                        }}>{n}</span>
                        {j < TEMPLATE_NODES[i].length - 1 && (
                          <svg width="8" height="8" viewBox="0 0 8 8" style={{ opacity: 0.25, flexShrink: 0 }}>
                            <path d="M2 4h4M4.5 2.5L6 4l-1.5 1.5" fill="none" stroke="var(--color-text-disabled)" strokeWidth="1.2" strokeLinecap="round"/>
                          </svg>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-disabled)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="m9 18 6-6-6-6"/></svg>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', marginBottom: 24 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--color-border-subtle)' }} />
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-disabled)' }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--color-border-subtle)' }} />
        </div>

        {/* Paste / blank options */}
        {mode === 'pick' ? (
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <button onClick={() => setMode('paste')}
              style={{
                flex: 1, padding: '12px 16px', cursor: 'pointer', textAlign: 'left',
                background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: 12,
                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500,
                color: 'var(--color-text-secondary)', transition: 'border-color 150ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Paste content
            </button>
            <button onClick={() => { setGraphName('Untitled Graph'); setDismissed(true); }}
              style={{
                flex: 1, padding: '12px 16px', cursor: 'pointer', textAlign: 'left',
                background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: 12,
                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500,
                color: 'var(--color-text-secondary)', transition: 'border-color 150ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>
              Blank canvas
            </button>
          </div>
        ) : (
          <div style={{ width: '100%' }}>
            <div style={{ position: 'relative' }}>
              <textarea
                ref={taRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGo(); }}
                placeholder="Paste an article, transcript, or notes…"
                className="form-textarea"
                style={{ minHeight: 160, borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', background: 'var(--color-bg-card)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <button onClick={() => setMode('pick')}
                  style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-disabled)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  ← Back
                </button>
                <button onClick={handleGo} disabled={!hasText}
                  className="btn btn-primary" style={{ opacity: hasText ? 1 : 0.4 }}>
                  Create graph →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
