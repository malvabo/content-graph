import { useState, useCallback, useEffect, useRef } from 'react';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import { useGraphStore } from '../../store/graphStore';
import { ImageModal } from '../modals/Modals';
import { getDims } from '../../utils/imageDims';

async function genImage(prompt: string, seed: number, w: number, h: number): Promise<string> {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true&seed=${seed}`;
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const BOX_H = 160;

export function ImagePromptInline({ id }: { id: string }) {
  const status = useExecutionStore((s) => s.status[id] ?? 'idle');
  const output = useOutputStore((s) => s.outputs[id]);
  const aspect = useGraphStore((s) => s.nodes.find(n => n.id === id)?.data.config.aspect as string | undefined);
  const [generating, setGenerating] = useState(false);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const generatingRef = useRef(false);

  const generate = useCallback(async (prompt: string) => {
    if (generatingRef.current) return;
    generatingRef.current = true;
    setGenerating(true);
    try {
      const d = getDims(aspect);
      const img = await genImage(prompt, Date.now(), d.w, d.h);
      // Replace entire output to ensure imageBase64 is set (merge won't clear undefined)
      const store = useOutputStore.getState();
      const existing = store.outputs[id] || {};
      store.setOutput(id, { ...existing, text: prompt, imageBase64: img, imgWidth: d.w, imgHeight: d.h });
    } catch (e) {
      console.warn('Image generation failed:', e);
    }
    generatingRef.current = false;
    setGenerating(false);
  }, [id, aspect]);

  // Auto-generate when execution completes with a prompt but no image
  useEffect(() => {
    if (status === 'complete' && output?.text && !output?.imageBase64 && !generatingRef.current) {
      generate(output.text);
    }
  }, [status, output?.text, output?.imageBase64, generate]);

  // Show skeleton when running OR generating (no gap between states)
  const showSkeleton = status === 'running' || generating || (status === 'complete' && output?.text && !output?.imageBase64);
  const showImage = status === 'complete' && output?.imageBase64 && !generating;
  const showIdle = status === 'idle' || status === 'stale';
  const showWarning = status === 'warning';

  return (
    <div className="mt-2" style={{ height: BOX_H }}>
      {showIdle && (
        <div style={{ height: BOX_H, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>
          Connect a text source, then Run
        </div>
      )}

      {showSkeleton && (
        <div className="rounded-lg skeleton-bar" style={{ height: BOX_H }} />
      )}

      {showImage && (
        <div className="relative" style={{ height: BOX_H }}>
          <div className="cursor-pointer" onMouseDown={(e) => e.stopPropagation()} onClick={() => setViewImage(output!.imageBase64!)}>
            <img src={output!.imageBase64} alt="Generated" className="w-full rounded-lg"
              style={{ height: BOX_H, objectFit: 'cover' }} />
          </div>
          <button className="btn-micro absolute bottom-2 right-2" style={{ background: 'var(--color-bg-card)', boxShadow: 'var(--shadow-sm)' }}
            onMouseDown={(e) => e.stopPropagation()} onClick={() => generate(output!.text || '')}>
            Regenerate
          </button>
          {viewImage && <ImageModal src={viewImage} prompt={output!.text} nodeLabel="Image Prompt" onClose={() => setViewImage(null)} aspect={aspect}
            onUse={(img: string) => { useOutputStore.getState().setOutput(id, { ...output, imageBase64: img }); setViewImage(null); }} />}
        </div>
      )}

      {showWarning && (
        <div style={{ height: BOX_H, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-warning-text)', background: 'var(--color-warning-bg)', borderRadius: 'var(--radius-sm)' }}>
          No input — connect a text node upstream
        </div>
      )}
    </div>
  );
}
