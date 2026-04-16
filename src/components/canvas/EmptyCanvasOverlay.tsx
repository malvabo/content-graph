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

const PillIcon = ({ name }: { name: string }) => {
  const s = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (name.startsWith('Article')) return <svg {...s}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>;
  if (name.startsWith('Transcript')) return <svg {...s}><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>;
  return <svg {...s}><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>;
};

export default function EmptyCanvasOverlay() {
  const { nodes, setNodes, setEdges, setGraphName, addNode } = useGraphStore();
  const { autoLayout } = useGraphLayout();
  const [dismissed, setDismissed] = useState(false);
  const [text, setText] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (!dismissed && nodes.length === 0) taRef.current?.focus(); }, [dismissed, nodes.length]);

  if (nodes.length > 0 || dismissed) return null;

  const handleGo = () => {
    const trimmed = text.trim();
    if (!trimmed) { setDismissed(true); return; }
    addNode(makeSourceNode(trimmed));
    setGraphName('Untitled Graph');
    setDismissed(true);
  };

  const loadTemplate = (idx: number) => {
    const { nodes: n, edges: e } = TEMPLATES[idx].build();
    // If user pasted content, inject it into the source node
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
    <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
      {/* Dot grid */}
      <div style={{ position: 'absolute', inset: 0, opacity: .25, backgroundImage: 'radial-gradient(circle, var(--color-dot) var(--dot-size), transparent var(--dot-size))', backgroundSize: 'var(--dot-gap) var(--dot-gap)' }} />

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, maxWidth: 520, width: '100%', padding: '0 24px' }}>
        {/* Headline */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-lg)', fontWeight: 500, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-.02em' }}>
            What do you want to repurpose?
          </h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: '6px 0 0' }}>
            Paste an article, transcript, or notes
          </p>
        </div>

        {/* Textarea */}
        <div style={{ width: '100%', position: 'relative' }}>
          <textarea
            ref={taRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGo(); }}
            placeholder="Paste your content here…"
            className="form-textarea"
            style={{ minHeight: 200, maxHeight: 360, borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', background: 'var(--color-bg-card)' }}
          />
          {hasText && (
            <button onClick={handleGo}
              style={{
                position: 'absolute', bottom: 12, right: 12,
                background: 'var(--color-accent)', color: 'var(--p-white)', border: 'none',
                borderRadius: 'var(--radius-md)', padding: '6px 16px',
                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500,
                cursor: 'pointer', transition: 'background 150ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-accent-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-accent)'; }}>
              Go →
            </button>
          )}
        </div>

        {/* Template pills */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-disabled)' }}>
            or start from a template
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {TEMPLATES.map((t, i) => (
              <button key={t.name} onClick={() => loadTemplate(i)}
                className="onboard-pill"
                style={{
                  fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500,
                  color: 'var(--color-text-secondary)', background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-full)',
                  padding: '6px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'border-color 150ms, box-shadow 150ms',
                }}>
                <PillIcon name={t.name} />
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {/* Skip link */}
        <button onClick={() => { setGraphName('Untitled Graph'); setDismissed(true); }}
          style={{
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-disabled)',
            background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
            textDecoration: 'underline', textUnderlineOffset: 3, transition: 'color 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-disabled)'; }}>
          Skip to blank canvas
        </button>
      </div>

      <style>{`
        .onboard-pill:hover { border-color: var(--color-border-strong) !important; box-shadow: var(--shadow-sm); background: var(--color-bg-surface) !important; }
      `}</style>
    </div>
  );
}
