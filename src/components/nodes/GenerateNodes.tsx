import { useState } from 'react';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import { useGraphStore } from '../../store/graphStore';
import { OutputModal } from '../modals/Modals';

function ConfigPills({ id }: { id: string }) {
  const config = useGraphStore((s) => s.nodes.find((n) => n.id === id)?.data.config);
  const vals = Object.values(config ?? {}).filter((v) => typeof v === 'string' && v);
  if (!vals.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {vals.slice(0, 3).map((v, i) => (
        <span key={i} className="btn-pill" style={{ cursor: 'default', height: 20, fontSize: 14 }}>{String(v)}</span>
      ))}
    </div>
  );
}

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
        {lines.map((_, i) => <div key={i} className="w-[50px] h-[50px] rounded-md shrink-0 animate-pulse" style={{ background: 'var(--cg-surface)' }} />)}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 mt-2">
      {lines.map((w, i) => <div key={i} className="h-2.5 rounded animate-pulse" style={{ width: `${w}%`, background: 'var(--cg-surface)' }} />)}
    </div>
  );
}

function OutputPreview({ id, subtype }: { id: string; subtype: string }) {
  const text = useOutputStore((s) => s.outputs[id]?.text);
  const label = useGraphStore((s) => s.nodes.find((n) => n.id === id)?.data.label ?? subtype);
  const [modalOpen, setModalOpen] = useState(false);
  if (!text) return null;

  if (subtype === 'ig-carousel') {
    const slides = text.split(/---/).filter(Boolean);
    return (
      <div className="mt-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {slides.map((s, i) => (
            <div key={i} className="w-[80px] h-[80px] border rounded-md p-1.5 shrink-0 overflow-hidden" style={{ background: 'var(--cg-card)', borderColor: 'var(--cg-border)', fontSize: 14, lineHeight: '1.3' }}>
              <div style={{ fontSize: 14, color: 'var(--cg-ink-3)' }}>{i + 1}</div>
              {s.trim().slice(0, 60)}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-1">
          <span style={{ font: '400 14px/1 var(--font-sans)', color: 'var(--cg-ink-3)' }}>{slides.length} slides</span>
          <button className="btn-micro" onClick={() => setModalOpen(true)}>Read more</button>
        </div>
        {modalOpen && <OutputModal title={label} text={text} wordCount={text.split(/\s+/).length} onClose={() => setModalOpen(false)} />}
      </div>
    );
  }

  const words = text.split(/\s+/).length;
  const isLong = text.length > 300;

  return (
    <div className="mt-2">
      <div className="max-h-[120px] overflow-y-auto" style={{ font: '400 14px/1.6 var(--font-mono)', color: 'var(--cg-ink)', scrollbarWidth: 'thin' }}>
        {text}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span style={{ font: '400 14px/1 var(--font-sans)', color: 'var(--cg-ink-3)' }}>{words} words</span>
        <div className="flex gap-1.5">
          <button className="btn-micro" onClick={() => navigator.clipboard.writeText(text)}>Copy</button>
          {isLong && <button className="btn-micro" onClick={() => setModalOpen(true)}>Read more</button>}
        </div>
      </div>
      {modalOpen && <OutputModal title={label} text={text} wordCount={words} onClose={() => setModalOpen(false)} />}
    </div>
  );
}

export function GenerateNodeInline({ id, subtype }: { id: string; subtype: string }) {
  const status = useExecutionStore((s) => s.status[id] ?? 'idle');

  if (status === 'idle' || status === 'stale') return <ConfigPills id={id} />;
  if (status === 'running') return <Skeleton subtype={subtype} />;
  if (status === 'complete') return <OutputPreview id={id} subtype={subtype} />;
  if (status === 'warning') return <div style={{ font: '400 14px/1.5 var(--font-sans)', color: 'var(--cg-amber-text)', background: 'var(--cg-amber-lt)', padding: '6px 8px', borderRadius: 6 }} className="mt-2">⚠ No input</div>;
  return null;
}
