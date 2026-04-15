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
  idle: 'var(--p-status-idle)', running: 'var(--p-status-running)', complete: 'var(--p-status-complete)',
  error: 'var(--p-status-error)', warning: 'var(--p-status-running)', stale: 'var(--p-status-running)',
};

function canConnect(fromSubtype: string, toSubtype: string): boolean {
  const from = NODE_DEFS_BY_SUBTYPE[fromSubtype];
  const to = NODE_DEFS_BY_SUBTYPE[toSubtype];
  if (!from || !to) return false;
  return from.hasOutput && to.hasInput;
}

const HANDLE_CLS = "!w-3 !h-3 !border-[1.5px] !border-[var(--color-border-handle)] !bg-[var(--color-bg-card)] hover:!border-[var(--color-accent)] hover:!bg-[var(--color-bg-surface)] !transition-colors";

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
    : justDone ? 'done-pulse 0.5s ease-out 1' : undefined;

  const def = NODE_DEFS_BY_SUBTYPE[data.subtype];
  const colors = BADGE_COLORS[data.category];
  const isError = status === 'error';
  const isStale = status === 'stale';

  let borderStyle = '1px solid var(--color-border-default)';
  if (isError) borderStyle = '1px solid var(--color-danger-border)';
  else if (isStale) borderStyle = '1px solid var(--color-warning-border)';

  const isOtherSelected = selectedId !== null && selectedId !== id;
  const isCompatible = !isOtherSelected || !selectedSubtype ||
    canConnect(selectedSubtype, data.subtype) || canConnect(data.subtype, selectedSubtype);
  const dimmed = isOtherSelected && !isCompatible;

  return (
    <div style={{
      width: 'var(--size-node)',
      maxWidth: 'var(--size-node)',
      overflow: 'visible',
      background: 'var(--color-bg-card)',
      border: borderStyle,
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-4)',
      position: 'relative',
      opacity: dimmed ? 0.4 : 1,
      transition: 'opacity 200ms ease, box-shadow 200ms ease',
      boxShadow: selected ? 'var(--shadow-md)' : 'none',
      outline: selected ? '2px solid var(--color-accent)' : 'none',
      outlineOffset: -2,
    }}>
      {/* Input handle */}
      {def?.hasInput && <Handle type="target" position={Position.Left} id="text" className={HANDLE_CLS} />}

      {/* Header: badge + title + description */}
      <div className="flex items-start gap-3 mb-3">
        <div className="shrink-0 w-[30px] h-[30px] rounded-lg flex items-center justify-center" style={{ backgroundColor: colors.bg, color: colors.text }}>
          {NODE_ICONS[data.subtype]?.() ?? data.badge}
        </div>
        <div className="flex-1 min-w-0">
          <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-fixed)', color: 'var(--color-text-primary)' }} className="truncate">{data.label}</div>
          {data.description && (
            <div style={{ fontSize: 'var(--text-xs)', lineHeight: 'var(--leading-snug)', color: 'var(--color-text-tertiary)', marginTop: 2 }} className="truncate">{data.description}</div>
          )}
        </div>
      </div>

      {/* Status pill */}
      <div>
        <span className="btn-pill" style={{
          cursor: 'default', height: 22, fontSize: 'var(--text-xs)', fontWeight: 500,
          background: status === 'complete' ? 'var(--color-success-bg)' : status === 'error' ? 'var(--color-danger-bg)' : status === 'running' ? 'var(--color-warning-bg)' : 'var(--color-bg-surface)',
          color: status === 'complete' ? 'var(--color-success-text)' : status === 'error' ? 'var(--color-danger-text)' : status === 'running' ? 'var(--color-warning-text)' : 'var(--color-text-disabled)',
          borderColor: status === 'complete' ? 'var(--color-success-border)' : status === 'error' ? 'var(--color-danger-border)' : status === 'running' ? 'var(--color-warning-border)' : 'transparent',
        }}>
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[status], animation: dotAnim }} />
          {status}
        </span>
      </div>

      {/* Error message */}
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

      {/* Output handle */}
      {def?.hasOutput && <Handle type="source" position={Position.Right} id="text" className={HANDLE_CLS} />}
    </div>
  );
}

export default memo(BaseNodeInner);
