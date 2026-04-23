import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useRef, useState, useEffect, memo } from 'react';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import ContentModal from '../modals/ContentModal';
import { BADGE_COLORS, NODE_DEFS_BY_SUBTYPE } from '../../utils/nodeDefs';
import { aiExecute } from '../../utils/aiExecutor';
import { useNodeExecution } from '../../hooks/useNodeExecution';
import type { ContentNode } from '../../store/graphStore';
import { TextSourceInline, ImageSourceInline, FileSourceInline } from './SourceNodes';
import { GenerateNodeInline } from './GenerateNodes';
import { RefineInline } from './TransformNodes';
import { ExportInline } from './OutputNodes';
import { ImagePromptInline } from './ImagePromptNode';
import { VoiceSourceInline } from './VoiceSourceNode';
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

/* Compact list of upstream sources, shown only when 2+ inputs are fanned into a node. */
function UpstreamInputsList({ id }: { id: string }) {
  const edges = useGraphStore(s => s.edges);
  const nodes = useGraphStore(s => s.nodes);
  const status = useExecutionStore(s => s.status);
  const upstream = edges
    .filter(e => e.target === id)
    .map(e => {
      const n = nodes.find(x => x.id === e.source);
      if (!n) return null;
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
        height: 280,
        overflow: 'visible',
        background: 'var(--color-bg-card)',
        border: `1px solid ${isError ? 'var(--color-danger-border)' : isStale ? 'var(--color-warning-border)' : hovered ? 'var(--color-border-strong)' : 'var(--color-border-default)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        opacity: dragDimmed ? 0.4 : 1,
        transition: 'opacity 200ms ease, border-color 150ms ease, outline-color 150ms ease',
        boxShadow: selected ? 'var(--shadow-md)' : hovered ? 'var(--shadow-sm)' : isRunning ? `0 0 ${20 * glowIntensity}px ${4 * glowIntensity}px rgba(13,191,90,${0.25 * glowIntensity})` : 'none',
        outline: selected ? '2px solid var(--color-accent)' : 'none',
        outlineOffset: -2,
      }}
    >
      {/* Run button (bottom-right, hover only) — hide for source nodes */}
      {data.category !== 'source' && <button
        onMouseDown={e => e.stopPropagation()}
        onClick={() => runNode(id, async (input, config, meta) => aiExecute(input, config, data.subtype, meta))}
        style={{
          position: 'absolute', bottom: 'var(--space-3)', right: 'var(--space-3)',
          width: 28, height: 28, borderRadius: 'var(--radius-full)',
          background: 'var(--color-accent)', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', opacity: hovered ? 1 : 0.4,
          transition: 'opacity 150ms ease',
          zIndex: 10,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
      </button>}

      {def?.hasInput && <Handle type="target" position={Position.Left} id="text" className={HANDLE_CLS} style={hiTarget ? { borderColor: 'var(--color-accent)', backgroundColor: 'var(--color-accent)' } : undefined} />}

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div style={{ position: 'relative' }} className="shrink-0">
          <div className="w-[26px] h-[26px] rounded-md flex items-center justify-center" style={{ backgroundColor: colors.bg, color: colors.text }}>
            {NODE_ICONS[data.subtype]?.() ?? data.badge}
          </div>
          {brandActive && (data.category === 'generate' || data.subtype === 'brand-voice') && (
            <div style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 'var(--radius-full)', background: brandColor, border: '1.5px solid var(--color-bg-card)' }} title="Brand voice active" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-fixed)', color: 'var(--color-text-primary)' }} className="truncate" title={data.label}>{data.label}</div>
        </div>
        {/* Expand + Close — visible on hover */}
        <div className="flex items-center gap-0.5 shrink-0" style={{ opacity: hovered ? 1 : 0.5, transition: 'opacity 150ms' }}>
          <button onMouseDown={e => e.stopPropagation()} onClick={() => setExpandOpen(true)}
            style={{ width: 24, height: 24, borderRadius: 'var(--radius-sm)', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
          </button>
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
        {data.subtype === 'voice-source' && <VoiceSourceInline id={id} onExpand={() => setExpandOpen(true)} />}
        {data.subtype === 'refine' && <RefineInline id={id} />}
        {(data.subtype === 'image-prompt' || data.subtype === 'video') && <ImagePromptInline id={id} expandOpen={expandOpen} onExpandClose={() => setExpandOpen(false)} />}
        {data.subtype === 'export' && <ExportInline id={id} />}
        {data.subtype === 'infographic' && <InfographicInline id={id} />}
        {data.category === 'generate' && !['image-prompt', 'video', 'infographic'].includes(data.subtype) && (
          <GenerateNodeInline id={id} subtype={data.subtype} expandOpen={expandOpen} onExpand={() => setExpandOpen(true)} onExpandClose={() => setExpandOpen(false)} />
        )}
      </div>

      {/* Expand modal for source/transform nodes */}
      {expandOpen && ["text-source", "file-source", "refine", "voice-source"].includes(data.subtype) && (() => {
        const output = useOutputStore.getState().outputs[id]?.text;
        const configText = (data.config?.text as string) || "";
        return <ContentModal subtype={data.subtype} title={data.label} text={output || configText || ""} onClose={() => setExpandOpen(false)} onSave={(t: string) => { useOutputStore.getState().setOutput(id, { text: t }); if (data.subtype === 'text-source') useGraphStore.getState().updateNodeConfig(id, { text: t }); }} />;
      })()}
      {def?.hasOutput && <Handle type="source" position={Position.Right} id="text" className={HANDLE_CLS} style={hiSource ? { borderColor: 'var(--color-accent)', backgroundColor: 'var(--color-accent)' } : undefined} />}
    </div>
  );
}

export default memo(BaseNodeInner);
