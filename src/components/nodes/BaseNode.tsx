import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useRef, useState, useEffect, memo } from 'react';
import { useExecutionStore } from '../../store/executionStore';
import { BADGE_COLORS, NODE_DEFS_BY_SUBTYPE, MODEL_OPTIONS, DEFAULT_MODELS } from '../../utils/nodeDefs';
import type { ContentNode } from '../../store/graphStore';
import { TextSourceInline, ImageSourceInline, FileSourceInline } from './SourceNodes';
import { GenerateNodeInline } from './GenerateNodes';
import { RefineInline } from './TransformNodes';
import { ExportInline } from './OutputNodes';
import { ImagePromptInline } from './ImagePromptNode';
import { NODE_ICONS } from '../../utils/nodeIcons';
import { useGraphStore } from '../../store/graphStore';

function canConnect(fromSubtype: string, toSubtype: string): boolean {
  const from = NODE_DEFS_BY_SUBTYPE[fromSubtype];
  const to = NODE_DEFS_BY_SUBTYPE[toSubtype];
  if (!from || !to) return false;
  return from.hasOutput && to.hasInput;
}

const HANDLE_CLS = "!w-3 !h-3 !border-[1.5px] border-[var(--color-border-handle)] bg-[var(--color-bg-card)] hover:!border-[var(--color-accent)] hover:!bg-[var(--color-bg-surface)] !transition-colors";

/* ── Chip-style MiniSelect ── */
function MiniSelect({ value, options, onChange }: { value: string; options: readonly string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div ref={ref} className="relative" onMouseDown={e => e.stopPropagation()}
      onMouseLeave={() => { if (open) setTimeout(() => { if (!ref.current?.matches(':hover')) setOpen(false); }, 100); }}>
      <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="h-6 text-xs rounded-full px-3 flex items-center gap-1"
        style={{ background: 'var(--color-bg-surface)', border: 'none', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
        <span style={{ color: 'var(--color-text-secondary)' }}>{value}</span>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.35, flexShrink: 0 }}><path d="m6 9 6 6 6-6"/></svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 pt-1 z-50">
        <div className="rounded-lg" style={{ background: 'var(--color-bg-card)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--color-border-subtle)', maxHeight: 220, overflowY: 'auto', scrollbarWidth: 'thin', minWidth: 160, padding: 'var(--space-1) 0' }}>
          {options.map((o, i) => (
            <button key={o} className="w-full px-3 py-2" style={{ textAlign: 'left', display: 'block', background: o === value ? 'var(--color-bg-surface)' : 'transparent', color: o === value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontWeight: o === value ? 500 : 400, fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', borderBottom: i < options.length - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}
              onMouseEnter={e => { if (o !== value) e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
              onMouseLeave={e => { if (o !== value) e.currentTarget.style.background = 'transparent'; }}
              onClick={(e) => { e.stopPropagation(); onChange(o); setOpen(false); }}>{o}</button>
          ))}
        </div>
        </div>
      )}
    </div>
  );
}

/* ── Inline config per node type — vertical stack with labels ── */
const INLINE_CONFIGS: Record<string, (c: Record<string, unknown>, s: (k: string, v: unknown) => void) => React.ReactNode> = {
  'linkedin-post': (c, s) => <>
    <MiniSelect value={c.goal as string ?? 'Thought leadership'} options={['Thought leadership', 'Personal story', 'Industry insight', 'Announcement', 'Call to action']} onChange={v => s('goal', v)} />
    <MiniSelect value={c.tone as string ?? 'Authoritative'} options={['Authoritative', 'Conversational', 'Vulnerable', 'Data-driven', 'Contrarian']} onChange={v => s('tone', v)} />
    <MiniSelect value={c.length as string ?? 'Medium ~280w'} options={['Short ~150w', 'Medium ~280w', 'Long ~450w']} onChange={v => s('length', v)} />
    <MiniSelect value={c.hook as string ?? 'Bold statement'} options={['Bold statement', 'Surprising stat', 'Personal micro-story', 'Counter-intuitive claim', 'Question']} onChange={v => s('hook', v)} />
    <MiniSelect value={c.model as string ?? DEFAULT_MODELS['linkedin-post']} options={MODEL_OPTIONS} onChange={v => s('model', v)} />
  </>,
  'twitter-thread': (c, s) => <>
    <MiniSelect value={c.style as string ?? 'Numbered 1/ 2/ 3/'} options={['Numbered 1/ 2/ 3/', 'Hook + thread', 'Narrative']} onChange={v => s('style', v)} />
    <MiniSelect value={c.tone as string ?? 'Analytical'} options={['Analytical', 'Personal', 'Educational', 'Provocative']} onChange={v => s('tone', v)} />
    <MiniSelect value={c.model as string ?? DEFAULT_MODELS['twitter-thread']} options={MODEL_OPTIONS} onChange={v => s('model', v)} />
  </>,
  'twitter-single': (c, s) => <>
    <MiniSelect value={c.angle as string ?? 'Most quotable insight'} options={['Most quotable insight', 'Strongest stat', 'Contrarian take', 'Call to action']} onChange={v => s('angle', v)} />
    <MiniSelect value={c.model as string ?? DEFAULT_MODELS['twitter-single']} options={MODEL_OPTIONS} onChange={v => s('model', v)} />
  </>,
  'ig-carousel': (c, s) => <>
    <MiniSelect value={c.format as string ?? 'Headline + bullets'} options={['Headline + bullets', 'Single bold statement', 'Numbered list', 'Story arc']} onChange={v => s('format', v)} />
    <MiniSelect value={c.platform as string ?? 'Instagram'} options={['Instagram', 'LinkedIn', 'TikTok']} onChange={v => s('platform', v)} />
    <MiniSelect value={c.model as string ?? DEFAULT_MODELS['ig-carousel']} options={MODEL_OPTIONS} onChange={v => s('model', v)} />
  </>,
  'blog-article': (c, s) => <>
    <MiniSelect value={c.type as string ?? 'How-to'} options={['How-to', 'Opinion', 'Listicle', 'Deep dive', 'Case study', 'Explainer']} onChange={v => s('type', v)} />
    <MiniSelect value={c.length as string ?? 'Medium 1000–1500w'} options={['Short 600–800w', 'Medium 1000–1500w', 'Long 2000–2500w']} onChange={v => s('length', v)} />
    <MiniSelect value={c.audience as string ?? 'Intermediate'} options={['Beginner', 'Intermediate', 'Expert']} onChange={v => s('audience', v)} />
    <MiniSelect value={c.model as string ?? DEFAULT_MODELS['blog-article']} options={MODEL_OPTIONS} onChange={v => s('model', v)} />
  </>,
  'newsletter': (c, s) => <>
    <MiniSelect value={c.type as string ?? 'Full issue'} options={['Full issue', 'Feature section', 'TL;DR', 'Deep dive', 'Roundup intro']} onChange={v => s('type', v)} />
    <MiniSelect value={c.model as string ?? DEFAULT_MODELS['newsletter']} options={MODEL_OPTIONS} onChange={v => s('model', v)} />
  </>,
  'infographic': (c, s) => <>
    <MiniSelect value={c.type as string ?? 'Process'} options={['Process', 'Statistical', 'Comparison', 'Timeline', 'Listicle', 'Anatomy']} onChange={v => s('type', v)} />
    <MiniSelect value={c.style as string ?? 'Clean Corporate'} options={['Clean Corporate', 'Bold Editorial', 'Illustrated', 'Dark Premium', 'Minimalist']} onChange={v => s('style', v)} />
    <MiniSelect value={c.model as string ?? DEFAULT_MODELS['infographic']} options={MODEL_OPTIONS} onChange={v => s('model', v)} />
  </>,
  'quote-card': (c, s) => <>
    <MiniSelect value={c.format as string ?? 'Single quote'} options={['Single quote', 'Multiple options']} onChange={v => s('format', v)} />
    <MiniSelect value={c.model as string ?? DEFAULT_MODELS['quote-card']} options={MODEL_OPTIONS} onChange={v => s('model', v)} />
  </>,
  'image-prompt': (c, s) => <>
    <MiniSelect value={c.purpose as string ?? 'Blog hero'} options={['Blog hero', 'LinkedIn post', 'Newsletter header', 'Instagram slide', 'Social concept']} onChange={v => s('purpose', v)} />
    <MiniSelect value={c.style as string ?? 'Photography'} options={['Photography', 'Flat illustration', '3D render', 'Abstract', 'Editorial graphic']} onChange={v => s('style', v)} />
    <MiniSelect value={c.aspect as string ?? '16:9'} options={['1:1', '4:5', '16:9', '9:16', '1.91:1']} onChange={v => s('aspect', v)} />
  </>,
};

function InlineConfig({ id, subtype }: { id: string; subtype: string }) {
  const config = useGraphStore(s => s.nodes.find(n => n.id === id)?.data.config ?? {});
  const updateConfig = useGraphStore(s => s.updateNodeConfig);
  const render = INLINE_CONFIGS[subtype];
  if (!render) return null;
  const set = (k: string, v: unknown) => updateConfig(id, { [k]: v });
  return (
    <div className="flex flex-wrap gap-1.5 mt-3 pt-3" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
      {render(config as Record<string, unknown>, set)}
    </div>
  );
}

function BaseNodeInner({ id, data, selected }: NodeProps<ContentNode>) {
  const status = useExecutionStore(s => s.status[id] ?? 'idle');
  const error = useExecutionStore(s => s.errors[id]);
  const selectedId = useGraphStore(s => s.selectedNodeId);
  const selectedSubtype = useGraphStore(s => {
    const sel = s.nodes.find(n => n.id === s.selectedNodeId);
    return sel?.data.subtype ?? null;
  });
  const [hovered, setHovered] = useState(false);

  const def = NODE_DEFS_BY_SUBTYPE[data.subtype];
  const colors = BADGE_COLORS[data.category];
  const isError = status === 'error';
  const isStale = status === 'stale';

  const isOtherSelected = selectedId !== null && selectedId !== id;

  // Check full compatibility: can connect in either direction, respecting maxInputs and existing edges
  const edges = useGraphStore(s => s.edges);
  const selectedDef = selectedSubtype ? NODE_DEFS_BY_SUBTYPE[selectedSubtype] : null;
  const thisDef = def;

  let connectionState: 'none' | 'compatible' | 'incompatible' = 'none';
  if (isOtherSelected && selectedSubtype && selectedId) {
    const canSendToThis = selectedDef?.hasOutput && thisDef?.hasInput && canConnect(selectedSubtype, data.subtype);
    const canReceiveFromThis = thisDef?.hasOutput && selectedDef?.hasInput && canConnect(data.subtype, selectedSubtype);

    if (canSendToThis || canReceiveFromThis) {
      // Check maxInputs constraint
      let blocked = false;
      if (canSendToThis) {
        const maxIn = thisDef?.maxInputs ?? 1;
        const currentIn = edges.filter(e => e.target === id).length;
        if (currentIn >= maxIn) blocked = true;
        // Check if already connected
        if (edges.some(e => e.source === selectedId && e.target === id)) blocked = true;
      }
      if (canReceiveFromThis && !canSendToThis) {
        const maxIn = selectedDef?.maxInputs ?? 1;
        const currentIn = edges.filter(e => e.target === selectedId).length;
        if (currentIn >= maxIn) blocked = true;
        if (edges.some(e => e.source === id && e.target === selectedId)) blocked = true;
      }
      connectionState = blocked ? 'incompatible' : 'compatible';
    } else {
      connectionState = 'incompatible';
    }
  }

  // Connection drag highlighting (separate from selection)
  const connectingFrom = useGraphStore(s => s.connectingNodeId);
  const connectingSubtype = useGraphStore(s => {
    if (!s.connectingNodeId) return null;
    const n = s.nodes.find(n => n.id === s.connectingNodeId);
    return n?.data.subtype ?? null;
  });
  const isDragging = connectingFrom !== null && connectingFrom !== id;
  const canReceive = isDragging && connectingSubtype ? canConnect(connectingSubtype, data.subtype) : false;
  const dragDimmed = isDragging && !canReceive;
  const isDragSource = connectingFrom === id;

  // Per-handle highlights: green when relevant
  const hiTarget = canReceive || selected || connectionState === 'compatible';
  const hiSource = isDragSource || selected || connectionState === 'compatible';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 'var(--size-node)',
        maxWidth: 'var(--size-node)',
        overflow: 'visible',
        background: 'var(--color-bg-card)',
        border: `1px solid ${isError ? 'var(--color-danger-border)' : isStale ? 'var(--color-warning-border)' : hovered ? 'var(--color-border-strong)' : 'var(--color-border-default)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4)',
        position: 'relative',
        opacity: (connectionState === 'incompatible' || dragDimmed) ? 0.4 : 1,
        transition: 'opacity 200ms ease, box-shadow 200ms ease, border-color 150ms ease, outline-color 150ms ease',
        boxShadow: selected ? 'var(--shadow-md)' : hovered ? 'var(--shadow-sm)' : 'none',
        outline: selected ? '2px solid var(--color-accent)' : 'none',
        outlineOffset: -2,
      }}
    >
      {/* Delete button (inside top-right, hover only) */}
      <button
        onMouseDown={e => e.stopPropagation()}
        onClick={() => useGraphStore.getState().removeNode(id)}
        style={{
          position: 'absolute', top: 8, right: 8,
          width: 28, height: 28, borderRadius: 'var(--radius-sm)',
          background: 'transparent', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', opacity: hovered ? 1 : 0,
          transition: 'opacity 150ms ease',
          pointerEvents: hovered ? 'auto' : 'none',
          zIndex: 10,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>

      {/* Run button (bottom-right, hover only) */}
      <button
        onMouseDown={e => e.stopPropagation()}
        onClick={() => { useExecutionStore.getState().setStatus(id, 'running'); setTimeout(() => { useExecutionStore.getState().setStatus(id, 'complete'); }, 1500); }}
        style={{
          position: 'absolute', bottom: 12, right: 12,
          width: 28, height: 28, borderRadius: '50%',
          background: 'var(--color-accent)', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', opacity: hovered ? 1 : 0,
          transition: 'opacity 150ms ease',
          pointerEvents: hovered ? 'auto' : 'none',
          zIndex: 10,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
      </button>

      {def?.hasInput && <Handle type="target" position={Position.Left} id="text" className={HANDLE_CLS} style={hiTarget ? { borderColor: 'var(--color-accent)', backgroundColor: 'var(--color-accent)' } : undefined} />}

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="shrink-0 w-[26px] h-[26px] rounded-md flex items-center justify-center" style={{ backgroundColor: colors.bg, color: colors.text }}>
          {NODE_ICONS[data.subtype]?.() ?? data.badge}
        </div>
        <div className="flex-1 min-w-0">
          <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-fixed)', color: 'var(--color-text-primary)' }} className="truncate">{data.label}</div>
        </div>
      </div>

      {/* Error */}
      {isError && error && (
        <div style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-snug)', color: 'var(--color-danger-text)' }} className="mt-2">{error}</div>
      )}

      {/* Inline content */}
      {data.subtype === 'text-source' && <TextSourceInline id={id} />}
      {data.subtype === 'file-source' && <FileSourceInline id={id} />}
      {data.subtype === 'image-source' && <ImageSourceInline id={id} />}
      {data.subtype === 'refine' && <RefineInline id={id} />}
      {data.subtype === 'image-prompt' && <ImagePromptInline id={id} />}
      {data.subtype === 'export' && <ExportInline id={id} />}
      {data.category === 'generate' && data.subtype !== 'image-prompt' && (
        <div style={{ height: 'var(--size-node-content)', overflow: 'hidden', position: 'relative' }}>
          <GenerateNodeInline id={id} subtype={data.subtype} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 24, background: 'linear-gradient(transparent, var(--color-bg-card))', pointerEvents: 'none' }} />
        </div>
      )}

      {/* Inline config dropdowns */}
      <InlineConfig id={id} subtype={data.subtype} />

      {def?.hasOutput && <Handle type="source" position={Position.Right} id="text" className={HANDLE_CLS} style={hiSource ? { borderColor: 'var(--color-accent)', backgroundColor: 'var(--color-accent)' } : undefined} />}
    </div>
  );
}

export default memo(BaseNodeInner);
