import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useExecutionStore } from '../../store/executionStore';
import { BADGE_COLORS, NODE_DEFS_BY_SUBTYPE } from '../../utils/nodeDefs';
import type { ContentNode } from '../../store/graphStore';
import { TextSourceInline, ImageSourceInline } from './SourceNodes';
import { GenerateNodeInline } from './GenerateNodes';
import { RefineInline } from './TransformNodes';
import { ExportInline } from './OutputNodes';
import { ImagePromptInline } from './ImagePromptNode';

const STATUS_COLORS: Record<string, string> = {
  idle: '#C8D4CC', running: '#F0D8A0', complete: '#0DBF5A',
  error: '#C93030', warning: '#F0D8A0', stale: '#F0D8A0',
};

export default function BaseNode({ id, data, selected }: NodeProps<ContentNode>) {
  const status = useExecutionStore((s) => s.status[id] ?? 'idle');
  const error = useExecutionStore((s) => s.errors[id]);
  const def = NODE_DEFS_BY_SUBTYPE[data.subtype];
  const colors = BADGE_COLORS[data.category];
  const isError = status === 'error';
  const isStale = status === 'stale';

  let borderStyle = '1px solid var(--cg-border)';
  if (selected) borderStyle = '2px solid var(--cg-green)';
  else if (isError) borderStyle = '1px solid #E8BABA';
  else if (isStale) borderStyle = '1px solid var(--cg-amber-bdr)';

  return (
    <div style={{ width: 240, background: 'var(--cg-card)', border: borderStyle, borderRadius: 12, padding: '14px 16px' }}>
      {def?.hasInput && (
        <Handle type="target" position={Position.Left} id="text"
          className="!w-2.5 !h-2.5 !border-[1.5px] !border-[#94a3b8] !bg-[var(--cg-card)] hover:!border-[var(--cg-green)] hover:!bg-[var(--cg-green-lt)]" />
      )}

      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div style={{ font: '500 14px/20px var(--font-sans)', color: 'var(--cg-ink)', letterSpacing: '-.005em' }} className="truncate">{data.label}</div>
          <div style={{ font: '400 12px/1.6 var(--font-mono)', color: 'var(--cg-ink-2)' }} className="truncate mt-0.5">{data.description}</div>
        </div>
        <div className="shrink-0 w-[26px] h-[26px] rounded-md flex items-center justify-center" style={{ fontSize: 11, fontWeight: 500, fontFamily: 'var(--font-mono)', backgroundColor: colors.bg, color: colors.text }}>
          {data.badge}
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-2">
        <div className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: STATUS_COLORS[status], animation: status === 'running' ? 'pulse 1.5s infinite' : undefined }} />
        <span style={{ font: '400 11px/1 var(--font-mono)', letterSpacing: '.1em', textTransform: 'uppercase', color: status === 'complete' ? 'var(--cg-green)' : 'var(--cg-ink-3)' }}>{status}</span>
      </div>

      {isError && error && <div style={{ font: '400 12px/1.6 var(--font-mono)', color: 'var(--cg-red-text)' }} className="mt-2">{error}</div>}

      {data.subtype === 'text-source' && <TextSourceInline id={id} />}
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
