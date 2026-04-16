import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import { useGraphStore } from '../../store/graphStore';
import ContentModal from '../modals/ContentModal';

const SKELETON_LINES: Record<string, number[]> = {
  'linkedin-post': [100, 85, 95, 70, 90, 60],
  'twitter-thread': [90, 80, 90, 75],
  'twitter-single': [95],
  'newsletter': [60, 95, 50, 90, 40],
  'quote-card': [95, 50],
  'infographic': [90, 80, 85, 75, 90],
  'image-prompt': [100, 90, 80],
};

function Skeleton({ subtype }: { subtype: string }) {
  const lines = SKELETON_LINES[subtype] ?? [90, 80, 70];
  return (
    <div className="flex flex-col gap-1.5 mt-2">
      {lines.map((w, i) => <div key={i} className="h-2.5 rounded skeleton-bar" style={{ width: `${w}%`, animationDelay: `${i * 0.15}s` }} />)}
    </div>
  );
}

function OutputPreview({ id, subtype, expandOpen, onExpandClose }: { id: string; subtype: string; expandOpen?: boolean; onExpandClose?: () => void }) {
  const text = useOutputStore((s) => s.outputs[id]?.text);
  const label = useGraphStore((s) => s.nodes.find((n) => n.id === id)?.data.label ?? subtype);
  const rerun = () => { useExecutionStore.getState().setStatus(id, 'running'); setTimeout(() => useExecutionStore.getState().setStatus(id, 'complete'), 1500); };
  if (!text) return null;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, marginTop: 8 }}>
      <div className="nowheel" style={{ flex: 1, overflowY: 'auto', fontWeight: 'var(--weight-normal)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-normal)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', scrollbarWidth: 'thin' }}>
        {text}
      </div>
      {expandOpen && <ContentModal subtype={subtype} title={label} text={text} onClose={() => onExpandClose?.()} onRegenerate={rerun} />}
    </div>
  );
}

export function GenerateNodeInline({ id, subtype, expandOpen, onExpandClose }: { id: string; subtype: string; expandOpen?: boolean; onExpandClose?: () => void }) {
  const status = useExecutionStore((s) => s.status[id] ?? 'idle');

  if (status === 'idle' || status === 'stale') return null;
  if (status === 'running') return <Skeleton subtype={subtype} />;
  if (status === 'complete') return <OutputPreview id={id} subtype={subtype} expandOpen={expandOpen} onExpandClose={onExpandClose} />;
  if (status === 'warning') return <div style={{ fontWeight: 'var(--weight-normal)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-snug)', fontFamily: 'var(--font-sans)', color: 'var(--color-warning-text)', background: 'var(--color-warning-bg)', padding: 'var(--space-2) var(--space-2)', borderRadius: 'var(--radius-sm)' }} className="mt-2">⚠ No input</div>;
  return null;
}
