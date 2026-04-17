import { useState, useCallback, useEffect, useRef } from 'react';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import { useGraphStore } from '../../store/graphStore';
import { ImageModal } from '../modals/Modals';
import { getDims } from '../../utils/imageDims';

async function genImage(prompt: string, seed: number, w: number, h: number): Promise<string> {
  const shortPrompt = prompt.slice(0, 500);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(shortPrompt)}?width=${w}&height=${h}&nologo=true&seed=${seed}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image generation failed: ${res.status}`);
  const blob = await res.blob();
  if (blob.size < 1000) throw new Error('Image generation returned empty result');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}


export function ImagePromptInline({ id }: { id: string }) {
  const status = useExecutionStore((s) => s.status[id] ?? 'idle');
  const output = useOutputStore((s) => s.outputs[id]);
  const aspect = useGraphStore((s) => s.nodes.find(n => n.id === id)?.data.config.aspect as string | undefined);
  const [generating, setGenerating] = useState(false);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const generatingRef = useRef(false);

  const generate = useCallback(async (text: string) => {
    if (generatingRef.current || !text.trim()) return;
    generatingRef.current = true;
    setGenerating(true);
    try {
      const d = getDims(aspect);
      const img = await genImage(text, Date.now(), d.w, d.h);
      const store = useOutputStore.getState();
      const existing = store.outputs[id] || {};
      store.setOutput(id, { ...existing, text, imageBase64: img, imgWidth: d.w, imgHeight: d.h });
      useExecutionStore.getState().setStatus(id, 'complete');
    } catch (e) {
      console.error('Image generation failed:', e);
      useExecutionStore.getState().setError(id, e instanceof Error ? e.message : 'Image generation failed');
    }
    generatingRef.current = false;
    setGenerating(false);
  }, [id, aspect]);

  // Also auto-generate when upstream text arrives via Run All
  useEffect(() => {
    if (status === 'complete' && output?.text && !output?.imageBase64 && !generatingRef.current) {
      generate(output.text);
    }
  }, [status, output?.text, output?.imageBase64, generate]);

  const showSkeleton = status === 'running' || generating;
  const showImage = output?.imageBase64 && !generating;
  const showInput = !showSkeleton && !showImage;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: 8 }}>
      {showInput && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <textarea
            className="form-input nowheel"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onMouseDown={e => e.stopPropagation()}
            placeholder="Describe the image you want..."
            style={{ flex: 1, resize: 'none', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', minHeight: 60 }}
          />
          <button className="btn btn-primary btn-sm" disabled={!prompt.trim()} onMouseDown={e => e.stopPropagation()} onClick={() => generate(prompt)}>
            Generate
          </button>
        </div>
      )}

      {showSkeleton && (
        <div className="rounded-lg skeleton-bar" style={{ flex: 1 }} />
      )}

      {showImage && (
        <div className="relative" style={{ flex: 1 }}>
          <div className="cursor-pointer h-full" onMouseDown={(e) => e.stopPropagation()} onClick={() => setViewImage(output!.imageBase64!)}>
            <img src={output!.imageBase64} alt="Generated" className="w-full h-full rounded-lg"
              style={{ objectFit: 'cover' }} />
          </div>
          <button className="btn-micro absolute bottom-2 right-2" style={{ background: 'var(--color-bg-card)', boxShadow: 'var(--shadow-sm)' }}
            onMouseDown={(e) => e.stopPropagation()} onClick={() => generate(output!.text || '')}>
            Regenerate
          </button>
          {viewImage && <ImageModal src={viewImage} prompt={output!.text} nodeLabel="Image Prompt" onClose={() => setViewImage(null)} aspect={aspect} nodeId={id}
            onUse={(img: string) => { useOutputStore.getState().setOutput(id, { ...output, imageBase64: img }); setViewImage(null); }} />}
        </div>
      )}

    </div>
  );
}
