import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';

export function ImagePromptInline({ id }: { id: string }) {
  const status = useExecutionStore((s) => s.status[id] ?? 'idle');
  const progress = useExecutionStore((s) => s.progress[id] ?? 0);
  const output = useOutputStore((s) => s.outputs[id]);

  if (status === 'idle' || status === 'stale') {
    return <div style={{ font: '400 14px/1.5 var(--font-sans)', color: 'var(--cg-ink-3)' }} className="mt-2">Connect a text source, then Run</div>;
  }

  if (status === 'running') {
    const phase = progress < 50 ? 'Writing prompt...' : 'Generating image...';
    return (
      <div className="mt-2">
        {progress < 50 ? (
          <div className="h-3 bg-[#f4f4f5] rounded animate-pulse w-full" />
        ) : (
          <>
            <div className="w-full h-1 bg-[#f4f4f5] rounded-full overflow-hidden">
              <div className="h-full bg-[#4f46e5] rounded-full transition-all" style={{ width: `${(progress - 50) * 2}%` }} />
            </div>
            <div className="text-[14px] text-[#a1a1aa] mt-0.5">Generating... {Math.round((progress - 50) * 2)}%</div>
          </>
        )}
        <div className="text-[14px] text-[#f59e0b] mt-1">{phase}</div>
      </div>
    );
  }

  if (status === 'complete') {
    return (
      <div className="mt-2 flex flex-col gap-2">
        {output?.text && (
          <div className="relative">
            <div className="text-[14px] text-[#71717a] leading-relaxed max-h-[60px] overflow-y-auto bg-[#f9fafb] rounded-md p-2" style={{ scrollbarWidth: 'thin' }}>
              {output.text}
            </div>
            <button className="text-[14px] text-[#71717a] hover:text-[#18181b] mt-1"
              onClick={() => navigator.clipboard.writeText(output.text!)}>Copy prompt</button>
          </div>
        )}
        {output?.imageBase64 && (
          <div className="relative">
            <img src={output.imageBase64} className="w-full max-h-[200px] object-cover rounded-lg" />
            <span className="absolute bottom-1.5 left-1.5 text-[14px] text-white bg-black/50 px-1.5 py-0.5 rounded">1024 × 1024</span>
            <div className="flex gap-2 mt-1.5">
              <button className="text-[14px] text-[#71717a] hover:text-[#18181b]">Open full size</button>
              <button className="text-[14px] text-[#71717a] hover:text-[#18181b]"
                onClick={() => { const a = document.createElement('a'); a.href = output.imageBase64!; a.download = 'image.png'; a.click(); }}>
                Download ↓
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (status === 'warning') return <div style={{ font: '400 14px/1.5 var(--font-sans)', color: 'var(--cg-amber-text)', background: 'var(--cg-amber-lt)', padding: '6px 8px', borderRadius: 6 }} className="mt-2">⚠ No input — connect a text node upstream</div>;
  return null;
}
