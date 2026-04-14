import { useState, useCallback } from 'react';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';

async function genImage(prompt: string, seed: number): Promise<string> {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function ImagePromptInline({ id }: { id: string }) {
  const status = useExecutionStore((s) => s.status[id] ?? 'idle');
  const progress = useExecutionStore((s) => s.progress[id] ?? 0);
  const output = useOutputStore((s) => s.outputs[id]);
  const [editPrompt, setEditPrompt] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate4 = useCallback(async (prompt: string) => {
    setGenerating(true);
    setImages([]);
    const baseSeed = Date.now();
    const results = await Promise.all(
      [0, 1, 2, 3].map((i) => genImage(prompt, baseSeed + i))
    );
    setImages(results);
    setGenerating(false);
    // Store first image as the main output
    useOutputStore.getState().setOutput(id, { text: prompt, imageBase64: results[0] });
  }, [id]);

  if (status === 'idle' || status === 'stale') {
    return <div style={{ font: '400 14px/1.5 var(--font-sans)', color: 'var(--cg-ink-3)' }} className="mt-2">Connect a text source, then Run</div>;
  }

  if (status === 'running' && !generating) {
    const phase = progress < 50 ? 'Writing prompt...' : 'Generating image...';
    return (
      <div className="mt-2">
        {progress < 50 ? (
          <div className="h-3 bg-[var(--cg-surface)] rounded animate-pulse w-full" />
        ) : (
          <div className="w-full h-1 bg-[var(--cg-surface)] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--cg-green)] rounded-full transition-all" style={{ width: `${(progress - 50) * 2}%` }} />
          </div>
        )}
        <div className="text-[14px] text-[#f59e0b] mt-1">{phase}</div>
      </div>
    );
  }

  if (status === 'complete' || generating) {
    const prompt = editPrompt || output?.text || '';

    return (
      <div className="mt-2 flex flex-col gap-2">
        {/* Editable prompt */}
        {output?.text && (
          <div>
            {expanded ? (
              <textarea
                className="w-full min-h-[60px] text-[14px] text-[#57534e] leading-relaxed bg-[var(--cg-surface)] rounded-lg p-2 outline-none resize-y border-none"
                value={editPrompt || output.text}
                onChange={(e) => setEditPrompt(e.target.value)}
                style={{ scrollbarWidth: 'thin' }}
              />
            ) : (
              <div className="text-[14px] text-[#57534e] leading-relaxed max-h-[40px] overflow-hidden bg-[var(--cg-surface)] rounded-lg p-2 cursor-pointer"
                onClick={() => { setExpanded(true); if (!editPrompt) setEditPrompt(output.text!); }}>
                {output.text}
              </div>
            )}
            <div className="flex gap-2 mt-1">
              {expanded && (
                <button className="btn-micro" onClick={() => setExpanded(false)}>Collapse</button>
              )}
              {!expanded && (
                <button className="btn-micro" onClick={() => { setExpanded(true); if (!editPrompt) setEditPrompt(output.text!); }}>Edit</button>
              )}
              <button className="btn-micro" onClick={() => { navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {/* Generate / Regenerate button */}
        <button className="btn-sm btn-primary w-full" disabled={generating}
          onClick={() => generate4(editPrompt || output?.text || '')}>
          {generating ? 'Generating 4 options...' : images.length ? '↻ Regenerate 4' : '⚡ Generate 4 options'}
        </button>

        {/* Generating skeleton */}
        {generating && (
          <div className="grid grid-cols-2 gap-1.5">
            {[0,1,2,3].map((i) => (
              <div key={i} className="aspect-square rounded-lg animate-pulse" style={{ background: 'var(--cg-surface)' }} />
            ))}
          </div>
        )}

        {/* 2×2 image grid */}
        {!generating && images.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5">
            {images.map((img, i) => (
              <div key={i} className="relative group cursor-pointer" onClick={() => {
                useOutputStore.getState().setOutput(id, { text: editPrompt || output?.text || '', imageBase64: img });
              }}>
                <img src={img} className="w-full aspect-square object-cover rounded-lg" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition flex items-end justify-center pb-1.5 opacity-0 group-hover:opacity-100">
                  <span className="text-[11px] text-white bg-black/50 px-2 py-0.5 rounded">Use this</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Single image fallback (from initial run) */}
        {!generating && images.length === 0 && output?.imageBase64 && (
          <div className="relative">
            <img src={output.imageBase64} className="w-full max-h-[200px] object-cover rounded-lg" />
            <div className="flex gap-2 mt-1">
              <button className="btn-micro" onClick={() => { const a = document.createElement('a'); a.href = output.imageBase64!; a.download = 'image.png'; a.click(); }}>Download ↓</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (status === 'warning') return <div style={{ font: '400 14px/1.5 var(--font-sans)', color: 'var(--cg-amber-text)', background: 'var(--cg-amber-lt)', padding: '6px 8px', borderRadius: 6 }} className="mt-2">⚠ No input — connect a text node upstream</div>;
  return null;
}
