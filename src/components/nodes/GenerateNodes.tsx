import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import { useGraphStore } from '../../store/graphStore';
import { aiExecute } from '../../utils/aiExecutor';
import ContentModal from '../modals/ContentModal';

const SKELETON_LINES: Record<string, number[]> = {
  'linkedin-post': [100, 95, 88, 100, 92, 78, 100, 85, 95, 60],
  'twitter-thread': [100, 90, 95, 85, 100, 88, 92, 75],
  'twitter-single': [100, 95, 70],
  'newsletter': [100, 95, 88, 100, 92, 85, 100, 78, 95, 88, 60],
  'quote-card': [100, 95, 88, 70],
  'infographic': [100, 90, 95, 85, 100, 88, 92, 80],
  'image-prompt': [100, 95, 88, 100, 92, 75],
  'video': [100, 95, 88, 100, 92, 85, 78],
  'refine': [100, 95, 88, 100, 92, 85, 60],
};

function Skeleton({ subtype }: { subtype: string }) {
  const lines = SKELETON_LINES[subtype] ?? [100, 95, 88, 100, 92, 85, 78];
  return (
    <div className="flex flex-col gap-2 mt-2">
      {lines.map((w, i) => <div key={i} className="h-3 rounded-sm skeleton-bar" style={{ width: `${w}%`, animationDelay: `${i * 0.1}s` }} />)}
    </div>
  );
}

function OutputPreview({ id, subtype, expandOpen, onExpand, onExpandClose }: { id: string; subtype: string; expandOpen?: boolean; onExpand?: () => void; onExpandClose?: () => void }) {
  const text = useOutputStore((s) => s.outputs[id]?.text);
  const label = useGraphStore((s) => s.nodes.find((n) => n.id === id)?.data.label ?? subtype);
  const rerun = () => {
    const node = useGraphStore.getState().nodes.find(n => n.id === id);
    if (!node) return;
    const { edges } = useGraphStore.getState();
    const outputs = useOutputStore.getState().outputs;
    const upstream = edges.filter(e => e.target === id).map(e => e.source);
    const input = upstream.map(uid => outputs[uid]?.text || '').filter(Boolean).join('\n\n---\n\n');
    useExecutionStore.getState().setStatus(id, 'running');
    aiExecute(input, node.data.config as Record<string, unknown>, subtype)
      .then(result => { useOutputStore.getState().setOutput(id, { text: result }); useExecutionStore.getState().setStatus(id, 'complete'); })
      .catch(err => { useExecutionStore.getState().setError(id, err instanceof Error ? err.message : 'Regeneration failed'); });
  };
  if (!text) return null;

  const isThread = subtype === 'twitter-thread';
  const tweets = isThread ? text.split(/\n\n+/).filter((s: string) => s.trim()).map((s: string) => s.replace(/^\d+\/\s*/, '')) : [];

  const openModal = () => onExpand?.();

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, marginTop: 'var(--space-2)' }}>
      {/* Truncated preview with fade */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', cursor: 'pointer' }} onMouseDown={e => e.stopPropagation()} onClick={openModal}>
        {isThread ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {tweets.slice(0, 2).map((t, i) => (
              <div key={i} style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px' }}>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-secondary)', flex: 1 }}>Tweet {i + 1}</span>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--color-text-disabled)' }}>{t.length}</span>
                </div>
                <div style={{ borderTop: '1px solid var(--color-border-subtle)', padding: '4px 8px' }}>
                  <span style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-snug)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>{t}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontWeight: 'var(--weight-normal)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-normal)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>
            {text}
          </div>
        )}
        {/* Fade overlay with inline read-more */}
        <div onMouseDown={e => e.stopPropagation()} onClick={openModal}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 48, background: 'linear-gradient(transparent, var(--color-bg-card))', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 2, cursor: 'pointer' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', letterSpacing: '0.01em' }}>···</span>
        </div>
      </div>
      {expandOpen && <ContentModal subtype={subtype} title={label} text={text} onClose={() => onExpandClose?.()} onRegenerate={rerun} />}
    </div>
  );
}

export function GenerateNodeInline({ id, subtype, expandOpen, onExpand, onExpandClose }: { id: string; subtype: string; expandOpen?: boolean; onExpand?: () => void; onExpandClose?: () => void }) {
  const status = useExecutionStore((s) => s.status[id] ?? 'idle');

  if (status === 'idle' || status === 'stale') return null;
  if (status === 'running') return <Skeleton subtype={subtype} />;
  if (status === 'complete') return <OutputPreview id={id} subtype={subtype} expandOpen={expandOpen} onExpand={onExpand} onExpandClose={onExpandClose} />;
  if (status === 'warning') return <div style={{ fontWeight: 'var(--weight-normal)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-snug)', fontFamily: 'var(--font-sans)', color: 'var(--color-warning-text)', background: 'var(--color-warning-bg)', padding: 'var(--space-2) var(--space-2)', borderRadius: 'var(--radius-sm)' }} className="mt-2">⚠ No input</div>;
  return null;
}
