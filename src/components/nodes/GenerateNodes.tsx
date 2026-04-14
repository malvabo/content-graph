import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import { useGraphStore } from '../../store/graphStore';

function ConfigPills({ id }: { id: string }) {
  const config = useGraphStore((s) => s.nodes.find((n) => n.id === id)?.data.config);
  const vals = Object.values(config ?? {}).filter((v) => typeof v === 'string' && v);
  if (!vals.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {vals.slice(0, 3).map((v, i) => (
        <span key={i} className="text-[10px] text-[#a1a1aa] bg-[#f4f4f5] px-1.5 py-0.5 rounded">{String(v)}</span>
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
        {lines.map((_, i) => (
          <div key={i} className="w-[50px] h-[50px] bg-[#f4f4f5] rounded-md shrink-0 animate-pulse" />
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 mt-2">
      {lines.map((w, i) => (
        <div key={i} className="h-2.5 bg-[#f4f4f5] rounded animate-pulse" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

function OutputPreview({ id, subtype }: { id: string; subtype: string }) {
  const text = useOutputStore((s) => s.outputs[id]?.text);
  if (!text) return null;

  if (subtype === 'ig-carousel') {
    const slides = text.split(/---/).filter(Boolean);
    return (
      <div className="mt-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {slides.map((s, i) => (
            <div key={i} className="w-[80px] h-[80px] bg-white border border-[#e5e7eb] rounded-md p-1.5 shrink-0 text-[10px] leading-tight overflow-hidden">
              <div className="text-[9px] text-[#a1a1aa] mb-0.5">{i + 1}</div>
              {s.trim().slice(0, 60)}
            </div>
          ))}
        </div>
        <div className="text-[10px] text-[#a1a1aa] mt-1 text-right">{slides.length} slides</div>
      </div>
    );
  }

  const words = text.split(/\s+/).length;
  return (
    <div className="mt-2">
      <div className="max-h-[180px] overflow-y-auto text-xs leading-relaxed text-[#18181b]" style={{ scrollbarWidth: 'thin' }}>
        {text}
      </div>
      <div className="flex items-center justify-end gap-2 mt-1.5">
        <span className="text-[10px] text-[#a1a1aa]">{words} words</span>
        <button
          className="text-[10px] text-[#71717a] hover:text-[#18181b] transition"
          onClick={() => navigator.clipboard.writeText(text)}
        >Copy</button>
        <button className="text-[10px] text-[#71717a]">↗</button>
      </div>
    </div>
  );
}

export function GenerateNodeInline({ id, subtype }: { id: string; subtype: string }) {
  const status = useExecutionStore((s) => s.status[id] ?? 'idle');

  if (status === 'idle' || status === 'stale') return <ConfigPills id={id} />;
  if (status === 'running') return <Skeleton subtype={subtype} />;
  if (status === 'complete') return <OutputPreview id={id} subtype={subtype} />;
  if (status === 'warning') return <div className="text-[11px] text-[#f59e0b] mt-2">⚠ No input</div>;
  return null;
}
