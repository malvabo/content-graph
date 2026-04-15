import { useState } from 'react';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import { useGraphStore } from '../../store/graphStore';
import { OutputModal } from '../modals/Modals';

const SKELETON_LINES: Record<string, number[]> = {
  'linkedin-post': [100, 85, 95, 70, 90, 60],
  'twitter-thread': [90, 80, 90, 75],
  'twitter-single': [95],
  'blog-article': [100, 80, 90, 85, 75, 95, 80],
  'newsletter': [60, 95, 50, 90, 40],
  'quote-card': [95, 50],
  'ig-carousel': [20, 20, 20, 20, 20],
  'infographic': [90, 80, 85, 75, 90],
  'image-prompt': [100, 90, 80],
};

function Skeleton({ subtype }: { subtype: string }) {
  const lines = SKELETON_LINES[subtype] ?? [90, 80, 70];
  if (subtype === 'ig-carousel') {
    return (
      <div className="flex gap-1.5 mt-2 overflow-hidden">
        {lines.map((_, i) => <div key={i} className="w-[50px] h-[50px] rounded-md shrink-0 skeleton-bar" />)}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 mt-2">
      {lines.map((w, i) => <div key={i} className="h-2.5 rounded skeleton-bar" style={{ width: `${w}%`, animationDelay: `${i * 0.15}s` }} />)}
    </div>
  );
}

function OutputPreview({ id, subtype }: { id: string; subtype: string }) {
  const text = useOutputStore((s) => s.outputs[id]?.text);
  const label = useGraphStore((s) => s.nodes.find((n) => n.id === id)?.data.label ?? subtype);
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!text) return null;

  if (subtype === 'ig-carousel') {
    const slides = text.split(/---/).filter(Boolean);
    return (
      <div className="mt-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
          {slides.map((s, i) => (
            <div key={i} className="w-[60px] h-[60px] border rounded-md p-1 shrink-0 overflow-hidden" style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border-default)', fontSize: 'var(--text-xs)', lineHeight: '1.3' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{i + 1}</div>
              {s.trim().slice(0, 30)}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-1">
          <span style={{ fontWeight: 'var(--weight-normal)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-none)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>{slides.length} slides</span>
          <button className="btn-micro" onMouseDown={(e) => e.stopPropagation()} onClick={() => setModalOpen(true)}>Read more</button>
        </div>
        {modalOpen && <OutputModal title={label} text={text} wordCount={text.split(/\s+/).length} onClose={() => setModalOpen(false)} />}
      </div>
    );
  }

  const words = text.split(/\s+/).length;

  return (
    <div className="mt-2">
      <div className="max-h-[80px] overflow-y-auto" style={{ fontWeight: 'var(--weight-normal)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-normal)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', scrollbarWidth: 'thin' }}>
        {text}
      </div>
      <div className="flex items-center justify-end mt-1.5">
        <div className="flex gap-1.5">
          <button className="btn-micro" onMouseDown={(e) => e.stopPropagation()} onClick={() => { navigator.clipboard.writeText(text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? '✓ Copied' : 'Copy'}</button>
          <button className="btn-micro" onMouseDown={(e) => e.stopPropagation()} onClick={() => setModalOpen(true)}>Read more</button>
        </div>
      </div>
      {modalOpen && <OutputModal title={label} text={text} wordCount={words} onClose={() => setModalOpen(false)} />}
    </div>
  );
}

export function GenerateNodeInline({ id, subtype }: { id: string; subtype: string }) {
  const status = useExecutionStore((s) => s.status[id] ?? 'idle');

  if (status === 'idle' || status === 'stale') return null;
  if (status === 'running') return <Skeleton subtype={subtype} />;
  if (status === 'complete') return <OutputPreview id={id} subtype={subtype} />;
  if (status === 'warning') return <div style={{ fontWeight: 'var(--weight-normal)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-snug)', fontFamily: 'var(--font-sans)', color: 'var(--color-warning-text)', background: 'var(--color-warning-bg)', padding: 'var(--space-2) var(--space-2)', borderRadius: 'var(--radius-sm)' }} className="mt-2">⚠ No input</div>;
  return null;
}
