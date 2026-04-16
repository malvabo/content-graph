import { useState, useCallback, useEffect } from 'react';
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
  const [generating, setGenerating] = useState(false);
  const [viewImage, setViewImage] = useState<string | null>(null);

  const generate = useCallback(async (prompt: string) => {
    setGenerating(true);
    try {
      const img = await genImage(prompt, Date.now());
      useOutputStore.getState().setOutput(id, { text: prompt, imageBase64: img });
    } catch { /* silent */ }
    setGenerating(false);
  }, [id]);

  // Clear old image when re-running so auto-generate triggers
  useEffect(() => {
    if (status === 'running') {
      const cur = useOutputStore.getState().outputs[id];
      if (cur?.imageBase64) {
        useOutputStore.getState().setOutput(id, { text: cur.text, imageBase64: undefined });
      }
    }
  }, [status, id]);

  // Auto-generate image when prompt is ready and no image exists yet
  useEffect(() => {
    if (status === 'complete' && output?.text && !output?.imageBase64 && !generating) {
      generate(output.text);
    }
  }, [status, output?.text, output?.imageBase64, generating, generate]);

  if (status === 'idle' || status === 'stale') {
    return <div style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }} className="mt-2">Connect a text source, then Run</div>;
  }

  if ((status === 'running' && !generating) || generating) {
    const phase = generating ? 'Generating image…' : progress < 50 ? 'Writing prompt…' : 'Generating image…';
    return (
      <div className="mt-2">
        <div className="aspect-video rounded-lg skeleton-bar" />
        <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-1)' }}>{phase}</div>
      </div>
    );
  }

  if (status === 'complete' && output?.imageBase64) {
    return (
      <div className="mt-2">
        <div className="relative cursor-pointer" onMouseDown={(e) => e.stopPropagation()} onClick={() => setViewImage(output.imageBase64!)}>
          <img src={output.imageBase64} alt="Generated" className="w-full max-h-[200px] object-cover rounded-lg" />
        </div>
        <button className="btn-micro mt-1.5" onMouseDown={(e) => e.stopPropagation()} onClick={() => generate(output.text || '')}>
          {generating ? 'Generating…' : 'Regenerate'}
        </button>
        {viewImage && <ImageModal src={viewImage} prompt={output.text} onClose={() => setViewImage(null)} onRegenerate={() => { setViewImage(null); generate(output.text || ''); }} />}
      </div>
    );
  }

  if (status === 'warning') return <div style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-warning-text)', background: 'var(--color-warning-bg)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)' }} className="mt-2">No input — connect a text node upstream</div>;
  return null;
}
