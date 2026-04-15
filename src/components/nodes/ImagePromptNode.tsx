import { useState, useCallback } from 'react';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import { ImageModal } from '../modals/Modals';

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
  const [viewImage, setViewImage] = useState<string | null>(null);

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
    return <div style={{ fontWeight: 'var(--weight-normal)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-snug)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }} className="mt-2">Connect a text source, then Run</div>;
  }

  if (status === 'running' && !generating) {
    const phase = progress < 50 ? 'Writing prompt...' : 'Generating image...';
    return (
      <div className="mt-2">
        {progress < 50 ? (
          <div className="h-3 bg-[var(--color-bg-surface)] rounded animate-pulse w-full" />
        ) : (
          <div className="w-full h-1 bg-[var(--color-bg-surface)] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--color-accent)] rounded-full transition-all" style={{ width: `${(progress - 50) * 2}%` }} />
          </div>
        )}
        <div className="text-sm text-[var(--p-amber-600)] mt-1"><span role="status">{phase}</span></div>
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
                className="w-full min-h-[60px] text-sm text-[var(--color-text-secondary)] leading-relaxed rounded-[10px] p-2.5 resize-y"
                value={editPrompt || output.text}
                onChange={(e) => setEditPrompt(e.target.value)}
                style={{ scrollbarWidth: 'thin' }}
              />
            ) : (
              <div className="text-sm text-[var(--color-text-secondary)] leading-relaxed bg-[var(--color-bg-surface)] rounded-lg p-2 cursor-pointer"
                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
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

        {/* Generate single image */}
        <button className="btn-sm btn-primary w-full" disabled={generating}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => generate4(editPrompt || output?.text || '')}>
          {generating ? 'Generating...' : output?.imageBase64 ? 'Regenerate' : 'Generate image'}
        </button>

        {/* Generating skeleton */}
        {generating && (
          <div className="aspect-video rounded-lg skeleton-bar" />
        )}

        {/* Single image */}
        {!generating && (images.length > 0 || output?.imageBase64) && (
          <div className="relative cursor-pointer" onMouseDown={(e) => e.stopPropagation()} onClick={() => setViewImage(images[0] || output?.imageBase64!)}>
            <img src={images[0] || output?.imageBase64} alt="Generated image" className="w-full max-h-[200px] object-cover rounded-lg" />
          </div>
        )}

        {/* Image modal with generate 4 */}
        {viewImage && <ImageModal src={viewImage} prompt={editPrompt || output?.text} onClose={() => setViewImage(null)} onRegenerate={() => { setViewImage(null); generate4(editPrompt || output?.text || ''); }} />}
      </div>
    );
  }

  if (status === 'warning') return <div style={{ fontWeight: 'var(--weight-normal)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-snug)', fontFamily: 'var(--font-sans)', color: 'var(--color-warning-text)', background: 'var(--color-warning-bg)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)' }} className="mt-2">⚠ No input — connect a text node upstream</div>;
  return null;
}
