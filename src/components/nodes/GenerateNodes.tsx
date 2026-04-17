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

function OutputPreview({ id, subtype, expandOpen, onExpand, onExpandClose }: { id: string; subtype: string; expandOpen?: boolean; onExpand?: () => void; onExpandClose?: () => void }) {
  const text = useOutputStore((s) => s.outputs[id]?.text);
  const label = useGraphStore((s) => s.nodes.find((n) => n.id === id)?.data.label ?? subtype);
  const rerun = () => { useExecutionStore.getState().setStatus(id, 'running'); setTimeout(() => useExecutionStore.getState().setStatus(id, 'complete'), 1500); };
  if (!text) return null;

  const isThread = subtype === 'twitter-thread';
  const tweets = isThread ? text.split(/\n\n+/).filter((s: string) => s.trim()).map((s: string) => s.replace(/^\d+\/\s*/, '')) : [];

  const openModal = () => onExpand?.();

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, marginTop: 8 }}>
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
        {/* Fade overlay */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 48, background: 'linear-gradient(transparent, var(--color-bg-card))', pointerEvents: 'none' }} />
      </div>
      {/* Read more bar */}
      <button onMouseDown={e => e.stopPropagation()} onClick={openModal}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px 0 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)', color: 'var(--color-accent-subtle)' }}>
        Read more
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
      </button>
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
