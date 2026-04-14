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

  let borderStyle = '1px solid var(--cg-border)';
  if (selected) borderStyle = '2px solid var(--cg-green)';
  else if (isError) borderStyle = '1px solid #E8BABA';
  else if (isStale) borderStyle = '1px solid var(--cg-amber-bdr)';

  const isSource = data.category === 'source';

  // Compatibility: if another node is selected, dim this one if it can't connect
  const isOtherSelected = selectedId !== null && selectedId !== id;
  const isCompatible = !isOtherSelected || !selectedSubtype || 
    canConnect(selectedSubtype, data.subtype) || canConnect(data.subtype, selectedSubtype);
  const dimmed = isOtherSelected && !isCompatible;

  return (
    <div style={{
      width: 240,
      minHeight: isSource ? undefined : 160,
      background: 'var(--cg-card)',
      border: borderStyle,
      borderRadius: 12,
      padding: '14px 16px',
      transform: selected ? 'scale(1.04)' : 'scale(1)',
      opacity: dimmed ? 0.35 : 1,
      transition: 'transform 200ms ease, opacity 200ms ease, box-shadow 200ms ease',
      boxShadow: selected ? '0 8px 24px rgba(0,0,0,0.1)' : 'none',
    }}>
      {def?.hasInput && (
        <Handle type="target" position={Position.Left} id="text"
          className="!w-2.5 !h-2.5 !border-[1.5px] !border-[#94a3b8] !bg-[var(--cg-card)] hover:!border-[var(--cg-green)] hover:!bg-[var(--cg-green-lt)]" />
      )}

      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div style={{ font: '500 14px/20px var(--font-sans)', color: 'var(--cg-ink)', letterSpacing: '-.005em' }} className="truncate">{data.label}</div>
        </div>
        <div className="shrink-0 w-[26px] h-[26px] rounded-md flex items-center justify-center" style={{ fontSize: 14, fontWeight: 500, fontFamily: 'var(--font-sans)', backgroundColor: colors.bg, color: colors.text }}>
          {NODE_ICONS[data.subtype]?.() ?? data.badge}
        </div>
      </div>

      <div className="mt-1">
        <span className="btn-pill" style={{ cursor: 'default', height: 20, fontSize: 14, fontWeight: 500, fontFamily: 'var(--font-sans)',
          background: status === 'complete' ? 'var(--cg-green-tint)' : status === 'error' ? 'var(--cg-red-lt)' : status === 'running' ? 'var(--cg-amber-lt)' : 'var(--cg-surface)',
          color: status === 'complete' ? '#52524e' : status === 'error' ? '#52524e' : status === 'running' ? '#52524e' : '#8a8a86',
          borderColor: status === 'complete' ? '#E0DCD6' : status === 'error' ? '#ECC0C0' : status === 'running' ? 'var(--cg-amber-bdr)' : 'transparent',
        }}>
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[status], animation: dotAnim }} />
          {status}
        </span>
      </div>

      {isError && error && <div style={{ font: '400 14px/1.5 var(--font-sans)', color: 'var(--cg-red-text)' }} className="mt-2">{error}</div>}

      {data.subtype === 'text-source' && <TextSourceInline id={id} />}
      {data.subtype === 'file-source' && <FileSourceInline id={id} />}
      {data.subtype === 'image-source' && <ImageSourceInline id={id} />}
      {data.subtype === 'refine' && <RefineInline id={id} />}
      {data.subtype === 'image-prompt' && <ImagePromptInline id={id} />}
      {data.subtype === 'export' && <ExportInline id={id} />}
      {data.category === 'generate' && data.subtype !== 'image-prompt' && <GenerateNodeInline id={id} subtype={data.subtype} />}

      {def?.hasOutput && (
        <Handle type="source" position={Position.Right} id="text"
          className="!w-2.5 !h-2.5 !border-[1.5px] !border-[#94a3b8] !bg-[var(--cg-card)] hover:!border-[var(--cg-green)] hover:!bg-[var(--cg-green-lt)]" />
      )}
    </div>
  );
}

export default memo(BaseNodeInner);
