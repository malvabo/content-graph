import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useRef, useState, useEffect, memo } from 'react';
import { useExecutionStore } from '../../store/executionStore';
import { BADGE_COLORS, NODE_DEFS_BY_SUBTYPE } from '../../utils/nodeDefs';
import type { ContentNode } from '../../store/graphStore';
import { TextSourceInline, ImageSourceInline, FileSourceInline } from './SourceNodes';
import { GenerateNodeInline } from './GenerateNodes';
import { RefineInline } from './TransformNodes';
import { ExportInline } from './OutputNodes';
import { ImagePromptInline } from './ImagePromptNode';

import { NODE_ICONS } from '../../utils/nodeIcons';

import { useGraphStore } from '../../store/graphStore';

const STATUS_COLORS: Record<string, string> = {
  idle: '#C8D4CC', running: '#F0D8A0', complete: '#0DBF5A',
  error: '#C93030', warning: '#F0D8A0', stale: '#F0D8A0',
};

function canConnect(fromSubtype: string, toSubtype: string): boolean {
  const from = NODE_DEFS_BY_SUBTYPE[fromSubtype];
  const to = NODE_DEFS_BY_SUBTYPE[toSubtype];
  if (!from || !to) return false;
  if (!from.hasOutput || !to.hasInput) return false;
  return true;
}

function BaseNodeInner({ id, data, selected }: NodeProps<ContentNode>) {
  const status = useExecutionStore((s) => s.status[id] ?? 'idle');
  const error = useExecutionStore((s) => s.errors[id]);
  const selectedId = useGraphStore((s) => s.selectedNodeId);
  const selectedSubtype = useGraphStore((s) => {
    const sel = s.nodes.find((n) => n.id === s.selectedNodeId);
    return sel?.data.subtype ?? null;
  });
  const prevStatus = useRef(status);
  const [justDone, setJustDone] = useState(false);

  useEffect(() => {
    if (prevStatus.current === 'running' && status === 'complete') {
      setJustDone(true);
      const t = setTimeout(() => setJustDone(false), 500);
      return () => clearTimeout(t);
    }
    prevStatus.current = status;
  }, [status]);

  const dotAnim = status === 'running'
    ? 'pulse 1.2s ease-in-out infinite'
    : justDone
      ? 'done-pulse 0.5s ease-out 1'
      : undefined;

  const def = NODE_DEFS_BY_SUBTYPE[data.subtype];
  const colors = BADGE_COLORS[data.category];
  const isError = status === 'error';
  const isStale = status === 'stale';

  let borderStyle = '1px solid var(--color-border-default)';
  if (isError) borderStyle = '1px solid #E8BABA';
  else if (isStale) borderStyle = '1px solid var(--color-warning-border)';

  // Compatibility: if another node is selected, dim this one if it can't connect
  const isOtherSelected = selectedId !== null && selectedId !== id;
  const isCompatible = !isOtherSelected || !selectedSubtype || 
    canConnect(selectedSubtype, data.subtype) || canConnect(data.subtype, selectedSubtype);
  const dimmed = isOtherSelected && !isCompatible;

  return (
    <div style={{
      width: 'var(--size-node)',
      maxWidth: 'var(--size-node)',
      overflow: data.subtype === 'image-prompt' ? 'visible' : 'hidden',
      background: 'var(--color-bg-card)',
      border: borderStyle,
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-4) var(--space-4)',
      position: 'relative',
      opacity: dimmed ? 0.4 : 1,
      transition: 'opacity 200ms ease, box-shadow 200ms ease',
      boxShadow: selected ? 'var(--shadow-md)' : 'none',
      outline: selected ? '2px solid var(--color-accent)' : 'none',
      outlineOffset: 1,
    }}>
      {selected && (
        <button
          aria-label="Delete node"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); if (confirm('Delete this node?')) useGraphStore.getState().removeNode(id); }}
          className="absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-[var(--color-danger)] text-white flex items-center justify-center z-10 hover:bg-[var(--color-danger-hover)]"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      )}
      {def?.hasInput && (
        <Handle type="target" position={Position.Left} id="text"
          className="!w-2.5 !h-2.5 !border-[1.5px] !border-[var(--color-border-handle)] !bg-[var(--color-bg-card)] hover:!border-[var(--color-accent)] hover:!bg-[var(--color-bg-surface)]" />
      )}

      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-fixed)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', letterSpacing: '-.005em' }} className="truncate">{data.label}</div>
        </div>
        <div className="shrink-0 w-[26px] h-[26px] rounded-md flex items-center justify-center" style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)', backgroundColor: colors.bg, color: colors.text }}>
          {NODE_ICONS[data.subtype]?.() ?? data.badge}
        </div>
      </div>

      <div className="mt-1">
        <span className="btn-pill" style={{ cursor: 'default', height: 20, fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)',
          background: status === 'complete' ? 'var(--color-bg-subtle)' : status === 'error' ? 'var(--color-danger-bg)' : status === 'running' ? 'var(--color-warning-bg)' : 'var(--color-bg-surface)',
          color: status === 'complete' ? '#52524e' : status === 'error' ? '#52524e' : status === 'running' ? '#52524e' : '#8a8a86',
          borderColor: status === 'complete' ? '#E0DCD6' : status === 'error' ? '#ECC0C0' : status === 'running' ? 'var(--color-warning-border)' : 'transparent',
        }}>
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[status], animation: dotAnim }} />
          {status}
        </span>
      </div>

      {isError && error && <div style={{ fontWeight: 'var(--weight-normal)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-snug)', fontFamily: 'var(--font-sans)', color: 'var(--color-danger-text)' }} className="mt-2">{error}</div>}

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

      {def?.hasOutput && (
        <Handle type="source" position={Position.Right} id="text"
          className="!w-2.5 !h-2.5 !border-[1.5px] !border-[var(--color-border-handle)] !bg-[var(--color-bg-card)] hover:!border-[var(--color-accent)] hover:!bg-[var(--color-bg-surface)]" />
      )}
    </div>
  );
}

export default memo(BaseNodeInner);
