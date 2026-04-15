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
    data: { subtype: 'text-source', label: def.label, badge: def.badge, category: def.category, description: def.description, config: { content } },
  };
}

const PILL_ICONS: Record<string, string> = {
  'Article → Everywhere': '📄',
  'Transcript → Social Pack': '🎙',
  'Research → Visual': '📊',
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
      if (src) src.data.config = { ...src.data.config, content: trimmed };
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
            style={{
              width: '100%', minHeight: 200, maxHeight: 360, resize: 'vertical',
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-normal)',
              color: 'var(--color-text-primary)', background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-4)', outline: 'none',
              transition: 'border-color 150ms, box-shadow 150ms',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(13,191,90,0.1)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; e.currentTarget.style.boxShadow = 'none'; }}
          />
          {hasText && (
            <button onClick={handleGo}
              style={{
                position: 'absolute', bottom: 12, right: 12,
                background: 'var(--color-accent)', color: '#fff', border: 'none',
                borderRadius: 'var(--radius-md)', padding: '6px 16px',
                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500,
                cursor: 'pointer',
              }}>
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
                <span>{PILL_ICONS[t.name] ?? '📄'}</span>
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
            textDecoration: 'underline', textUnderlineOffset: 3,
          }}>
          Skip to blank canvas
        </button>
      </div>

      <style>{`
        .onboard-pill:hover { border-color: var(--color-border-strong) !important; box-shadow: var(--shadow-sm); }
      `}</style>
    </div>
  );
}
