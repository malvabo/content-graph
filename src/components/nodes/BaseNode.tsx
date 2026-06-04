import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useState, useEffect, useRef, memo } from 'react';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import ContentModal from '../modals/ContentModal';
import { BADGE_COLORS, NODE_DEFS_BY_SUBTYPE, DEFAULT_MODELS } from '../../utils/nodeDefs';
import { aiExecute } from '../../utils/aiExecutor';
import { useNodeExecution } from '../../hooks/useNodeExecution';
import type { ContentNode } from '../../store/graphStore';
import { TextSourceInline, ImageSourceInline, FileSourceInline, LinkSourceInline } from './SourceNodes';
import { GenerateNodeInline } from './GenerateNodes';
import { RefineInline, PromptInline } from './TransformNodes';
import { ExportInline } from './OutputNodes';
import { ImagePromptInline } from './ImagePromptNode';
import { VoiceSourceInline, SAMPLE_VOICE_CONTENT } from './VoiceSourceNode';
import { useVoiceStore } from '../../store/voiceStore';
import { InfographicInline } from './InfographicNode';
import { NODE_ICONS } from '../../utils/nodeIcons';
import { useGraphStore } from '../../store/graphStore';
import { useSettingsStore } from '../../store/settingsStore';

function canConnect(fromSubtype: string, toSubtype: string): boolean {
  const from = NODE_DEFS_BY_SUBTYPE[fromSubtype];
  const to = NODE_DEFS_BY_SUBTYPE[toSubtype];
  if (!from || !to) return false;
  return from.hasOutput && to.hasInput;
}

const HANDLE_CLS = "!w-3 !h-3 !border-[1.5px] border-[var(--color-border-handle)] bg-[var(--color-bg-card)] hover:!border-[var(--color-accent)] hover:!bg-[var(--color-bg-surface)] !transition-colors";


const MODEL_SHORT: Record<string, string> = {
  'claude-haiku-4': 'Haiku', 'claude-sonnet-4': 'Sonnet', 'claude-opus-4': 'Opus',
  'gpt-4o-mini': '4o mini', 'gpt-4o': '4o', 'o4-mini': 'o4',
  'gemini-2.0-flash': 'Flash', 'gemini-2.5-flash': 'Flash 2.5',
  'llama-3.3-70b': 'Llama', 'llama-4-scout': 'L4 Scout',
};
const MODEL_OPTS = Object.keys(MODEL_SHORT);

type ChipDef = { key: string; opts: readonly string[]; fmt?: (v: string) => string };
const CHIP_DEFS: Record<string, ChipDef[]> = {
  'linkedin-post':  [{ key: 'tone',     opts: ['Authoritative','Conversational','Vulnerable','Data-driven','Contrarian'] }, { key: 'length', opts: ['Short ~150w','Medium ~280w','Long ~450w'], fmt: v => v.split(' ')[0] }],
  'twitter-thread': [{ key: 'tone',     opts: ['Analytical','Personal','Educational','Provocative'] }],
  'twitter-single': [{ key: 'angle',    opts: ['Most quotable insight','Strongest stat','Contrarian take','Call to action'], fmt: v => v.length > 16 ? v.slice(0,14)+'…' : v }],
  'newsletter':     [{ key: 'type',     opts: ['Full issue','Feature section','TL;DR','Deep dive','Roundup intro'] }],
  'infographic':    [{ key: 'type',     opts: ['Process','Statistical','Comparison','Timeline','Listicle','Anatomy'] }],
  'quote-card':     [{ key: 'format',   opts: ['Single quote','Multiple options'] }],
  'image-prompt':   [{ key: 'style',    opts: ['Photography','Flat illustration','3D render','Abstract','Editorial graphic'], fmt: v => v.length > 16 ? v.slice(0,14)+'…' : v }, { key: 'aspect', opts: ['1:1','4:5','16:9','9:16','1.91:1'] }],
  'brand-voice':    [{ key: 'strength', opts: ['Light touch','Moderate','Full rewrite'], fmt: v => v === 'Light touch' ? 'Light' : v }],
};
const MODEL_NODES = new Set(['linkedin-post','twitter-thread','twitter-single','newsletter','infographic','quote-card','brand-voice','refine']);

const chipStyle: React.CSSProperties = {
  fontSize: 11, lineHeight: '16px', padding: '3px 7px 3px 9px',
  borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border-subtle)',
  background: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)',
  cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
  display: 'inline-flex', alignItems: 'center', gap: 3,
  transition: 'background 100ms',
};

function ChipSelect({ value, opts, fmt, dimmed, onChange }: {
  value: string; opts: readonly string[]; fmt?: (v: string) => string;
  dimmed?: boolean; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const label = fmt ? fmt(value) : value;

  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handler, { capture: true });
    return () => document.removeEventListener('pointerdown', handler, { capture: true });
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        style={{ ...chipStyle, color: dimmed ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)', background: open ? 'var(--color-bg-muted, var(--color-bg-subtle))' : 'var(--color-bg-subtle)' }}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
      >
        <span>{label}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.5, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 120ms', flexShrink: 0 }}><path d="m6 9 6 6 6-6"/></svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 4px)', left: 0,
          background: 'var(--color-bg-popover)', border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-md)', padding: '3px 0', zIndex: 1000,
          minWidth: 150, boxShadow: 'var(--shadow-lg)',
        }}>
          {opts.map(o => (
            <button key={o} type="button"
              className="chip-select-option"
              style={{
                fontWeight: o === value ? 500 : 400,
                color: o === value ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              }}
              onClick={e => { e.stopPropagation(); onChange(o); setOpen(false); }}
            >{o}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function NodeConfigChips({ id, subtype }: { id: string; subtype: string }) {
  const config = useGraphStore(s => s.nodes.find(n => n.id === id)?.data.config);
  const updateConfig = useGraphStore(s => s.updateNodeConfig);

  const chipDefs = CHIP_DEFS[subtype] ?? [];
  const showModel = MODEL_NODES.has(subtype);
  if (!chipDefs.length && !showModel) return null;

  return (
    <div className="nowheel" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingTop: 8, marginTop: 'auto', flexShrink: 0 }}
      onMouseDown={e => e.stopPropagation()}>
      {chipDefs.map(({ key, opts, fmt }) => {
        const val = (config?.[key] as string) ?? opts[0];
        return <ChipSelect key={key} value={val} opts={opts} fmt={fmt} onChange={v => updateConfig(id, { [key]: v })} />;
      })}
      {showModel && (() => {
        const model = (config?.model as string) ?? DEFAULT_MODELS[subtype] ?? 'claude-opus-4';
        return <ChipSelect value={model} opts={MODEL_OPTS} fmt={v => MODEL_SHORT[v] ?? v} dimmed onChange={v => updateConfig(id, { model: v })} />;
      })()}
    </div>
  );
}

/* Compact list of upstream sources, shown only when 2+ inputs are fanned into a node. */
function UpstreamInputsList({ id }: { id: string }) {
  const edges = useGraphStore(s => s.edges);
  const nodes = useGraphStore(s => s.nodes);
  const status = useExecutionStore(s => s.status);
  const upstream = edges
    .filter(e => e.target === id)
    .map(e => {
      const n = nodes.find(x => x.id === e.source);
      if (!n || n.data.subtype === 'prompt') return null;
      return {
        id: n.id,
        label: n.data.label,
        y: n.position.y,
        x: n.position.x,
        done: status[n.id] === 'complete' || n.data.category === 'source',
      };
    })
    .filter((u): u is NonNullable<typeof u> => u !== null)
    .sort((a, b) => (a.y - b.y) || (a.x - b.x));
  if (upstream.length < 2) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid var(--color-border-subtle)' }}>
      {upstream.map(u => (
        <span key={u.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-secondary)', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-full)', padding: '2px 8px', maxWidth: '100%' }}>
          <span style={{ color: u.done ? 'var(--color-accent)' : 'var(--color-text-disabled)', flexShrink: 0 }}>{u.done ? '✓' : '○'}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.label}</span>
        </span>
      ))}
    </div>
  );
}


function BaseNodeInner({ id, data, selected }: NodeProps<ContentNode>) {
  const status = useExecutionStore(s => s.status[id] ?? 'idle');
  const error = useExecutionStore(s => s.errors[id]);
  const { runNode } = useNodeExecution();
  const selectedId = useGraphStore(s => s.selectedNodeId);
  const selectedSubtype = useGraphStore(s => {
    const sel = s.nodes.find(n => n.id === s.selectedNodeId);
    return sel?.data.subtype ?? null;
  });
  const [hovered, setHovered] = useState(false);
  const [expandOpen, setExpandOpen] = useState(false);

  const def = NODE_DEFS_BY_SUBTYPE[data.subtype];
  const colors = BADGE_COLORS[data.category];
  const isError = status === 'error';
  const isStale = status === 'stale';
  const isRunning = status === 'running';

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

  const [glowIntensity, setGlowIntensity] = useState(0);
  const brandActive = useSettingsStore(s => !!s.brand?.voice?.personality);
  const brandColor = useSettingsStore(s => s.brand?.colors?.primary ?? '#0DBF5A');
  useEffect(() => {
    if (!isRunning) { setGlowIntensity(0); return; }
    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const t = ((now - start) % 2000) / 2000;
      const v = Math.sin(t * Math.PI);
      setGlowIntensity(v);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isRunning]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 'var(--size-node)',
        maxWidth: 'var(--size-node)',
        height: data.subtype === 'prompt' ? 260 : 310,
        overflow: 'visible',
        background: 'var(--color-node-bg, var(--color-bg-card))',
        backdropFilter: 'var(--node-backdrop, none)',
        WebkitBackdropFilter: 'var(--node-backdrop, none)',
        border: `1px solid ${isError ? 'var(--color-danger-border)' : isStale ? 'var(--color-warning-border)' : hovered ? 'var(--color-border-strong)' : 'var(--color-border-default)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        opacity: dragDimmed ? 0.4 : 1,
        transition: 'opacity 200ms ease, border-color 150ms ease',
        boxShadow: selected ? 'var(--shadow-md)' : hovered ? 'var(--shadow-sm)' : isRunning ? `0 0 ${20 * glowIntensity}px ${4 * glowIntensity}px rgba(13,191,90,${0.25 * glowIntensity})` : 'none',
        outline: '2px solid',
        outlineColor: selected ? 'var(--color-node-selected)' : 'transparent',
        outlineOffset: -2,
      }}
    >
      {/* Run button (bottom-right, hover only) — hide for source and prompt nodes */}
      {data.category !== 'source' && data.subtype !== 'prompt' && <button
        onMouseDown={e => e.stopPropagation()}
        onClick={() => runNode(id, async (input, config, meta) => aiExecute(input, config, data.subtype, meta))}
        style={{
          position: 'absolute', bottom: 'var(--space-3)', right: 'var(--space-3)',
          width: 28, height: 28, borderRadius: 'var(--radius-full)',
          background: 'var(--color-accent-fill)', border: '0.5px solid var(--color-accent)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', opacity: hovered ? 1 : 0.4,
          transition: 'opacity 150ms ease',
          zIndex: 10,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
      </button>}

      {def?.hasInput && <Handle type="target" position={Position.Left} id="text" className={HANDLE_CLS} style={hiTarget ? { borderColor: 'var(--color-accent)', backgroundColor: 'var(--color-accent-fill)' } : undefined} />}

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div style={{ position: 'relative' }} className="shrink-0">
          <div className="w-[26px] h-[26px] flex items-center justify-center" style={{ color: colors.text }}>
            {NODE_ICONS[data.subtype]?.() ?? data.badge}
          </div>
          {brandActive && (data.category === 'generate' || data.subtype === 'brand-voice') && (
            <div style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 'var(--radius-full)', background: brandColor, border: '1.5px solid var(--color-bg-card)' }} title="Brand voice active" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-fixed)', color: 'var(--color-text-primary)' }} className="truncate" title={data.label}>{data.label}</div>
        </div>
        {/* Expand + Close — visible on hover; hidden for prompt node */}
        <div className="flex items-center gap-0.5 shrink-0" style={{ opacity: hovered ? 1 : 0.5, transition: 'opacity 150ms' }}>
          {data.subtype !== 'prompt' && <button onMouseDown={e => e.stopPropagation()} onClick={() => setExpandOpen(true)}
            style={{ width: 24, height: 24, borderRadius: 'var(--radius-sm)', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
          </button>}
          <button onMouseDown={e => e.stopPropagation()} onClick={() => { if (window.confirm('Delete this node?')) { useGraphStore.getState().removeNode(id); } }}
            style={{ width: 24, height: 24, borderRadius: 'var(--radius-sm)', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      {/* Error */}
      {isError && error && (
        <div style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-snug)', color: 'var(--color-danger-text)' }} className="mt-2">
          {error}
          {error.includes('Settings') && (
            <button onMouseDown={e => e.stopPropagation()} onClick={() => { window.location.hash = '#settings'; }} style={{ display: 'block', marginTop: 4, background: 'none', border: 'none', color: 'var(--color-accent-subtle)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', padding: 0, textDecoration: 'underline' }}>Open Settings →</button>
          )}
        </div>
      )}

      {/* Inline content — flex:1 so it fills between header and chips */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: data.subtype === 'infographic' ? 'visible' : 'hidden' }}>
        {data.category === 'generate' && <UpstreamInputsList id={id} />}
        {data.subtype === 'text-source' && <TextSourceInline id={id} />}
        {data.subtype === 'file-source' && <FileSourceInline id={id} />}
        {data.subtype === 'image-source' && <ImageSourceInline id={id} />}
        {data.subtype === 'voice-source' && <VoiceSourceInline id={id} />}
        {data.subtype === 'link-source' && <LinkSourceInline id={id} />}
        {data.subtype === 'refine' && <RefineInline id={id} />}
        {data.subtype === 'prompt' && <PromptInline id={id} />}
        {(data.subtype === 'image-prompt' || data.subtype === 'video') && <ImagePromptInline id={id} expandOpen={expandOpen} onExpandClose={() => setExpandOpen(false)} />}
        {data.subtype === 'export' && <ExportInline id={id} />}
        {data.subtype === 'infographic' && <InfographicInline id={id} />}
        {data.category === 'generate' && !['image-prompt', 'video', 'infographic', 'prompt'].includes(data.subtype) && (
          <GenerateNodeInline id={id} subtype={data.subtype} expandOpen={expandOpen} onExpand={() => setExpandOpen(true)} onExpandClose={() => setExpandOpen(false)} />
        )}
      </div>

      <NodeConfigChips id={id} subtype={data.subtype} />

      {/* Expand modal for source/transform nodes */}
      {expandOpen && ["text-source", "file-source", "refine", "voice-source", "link-source"].includes(data.subtype) && (() => {
        const output = useOutputStore.getState().outputs[id]?.text;
        const configText = (data.config?.text as string) || "";
        let modalText = output || configText || "";
        if (data.subtype === 'voice-source') {
          const voiceNoteId = data.config?.voiceNoteId as string | undefined;
          const note = voiceNoteId ? useVoiceStore.getState().notes.find((n: { id: string }) => n.id === voiceNoteId) : null;
          modalText = note?.transcript || SAMPLE_VOICE_CONTENT;
        }
        if (data.subtype === 'link-source') {
          const url = data.config?.url as string | undefined;
          const title = data.config?.title as string | undefined;
          modalText = url ? `Title: ${title || ''}\nURL: ${url}` : '';
        }
        return <ContentModal subtype={data.subtype} title={data.label} text={modalText} onClose={() => setExpandOpen(false)} onSave={(t: string) => { useOutputStore.getState().setOutput(id, { text: t }); if (data.subtype === 'text-source') useGraphStore.getState().updateNodeConfig(id, { text: t }); }} />;
      })()}
      {def?.hasOutput && <Handle type="source" position={Position.Right} id="text" className={HANDLE_CLS} style={hiSource ? { borderColor: 'var(--color-accent)', backgroundColor: 'var(--color-accent-fill)' } : undefined} />}
    </div>
  );
}

export default memo(BaseNodeInner);
