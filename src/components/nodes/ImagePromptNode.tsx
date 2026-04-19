import { useState, useCallback, useEffect, useRef } from 'react';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import { useGraphStore } from '../../store/graphStore';
import { ImageModal } from '../modals/Modals';
import { getDims } from '../../utils/imageDims';

import { useSettingsStore } from '../../store/settingsStore';

// Together AI only supports sizes that are multiples of 64
function snapToGrid(n: number, grid = 64): number { return Math.round(n / grid) * grid; }

async function fetchWithTimeout(url: string, opts: RequestInit, ms = 30000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally { clearTimeout(timer); }
}

async function genImage(prompt: string, seed: number, w: number, h: number): Promise<string> {
  const togetherKey = useSettingsStore.getState().togetherKey;
  if (togetherKey) {
    const res = await fetchWithTimeout('https://api.together.xyz/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${togetherKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'black-forest-labs/FLUX.1-schnell-Free', prompt: prompt.slice(0, 1000), width: snapToGrid(w), height: snapToGrid(h), n: 1, seed, response_format: 'b64_json' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.error?.message || `Together API error: ${res.status}`;
      if (msg.toLowerCase().includes('credit') || res.status === 402 || res.status === 429) {
        // Fall through to Pollinations
      } else {
        throw new Error(msg);
      }
    } else {
      const data = await res.json();
      const b64 = data.data?.[0]?.b64_json;
      if (b64) return `data:image/png;base64,${b64}`;
      throw new Error('No image data in Together response');
    }
  }
  // No Together key — use Pollinations fallback
  const shortPrompt = prompt.slice(0, 500);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(shortPrompt)}?width=${w}&height=${h}&nologo=true&seed=${seed}`;
  const res = await fetchWithTimeout(url, {});
  if (!res.ok) throw new Error(`Image generation failed: ${res.status}`);
  const blob = await res.blob();
  if (blob.size < 1000) throw new Error('Empty image returned');
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
  const generatingRef = useRef(false);

  // No auto-generate on mount — wait for upstream text via Run All

  const generate = useCallback(async (text: string) => {
    if (generatingRef.current || !text.trim()) return;
    generatingRef.current = true;
    setGenerating(true);
    try {
      const d = getDims(aspect);
      const img = await genImage(text, Date.now(), d.w, d.h);
      useOutputStore.getState().setOutput(id, { text, imageBase64: img, imgWidth: d.w, imgHeight: d.h });
      useExecutionStore.getState().setStatus(id, 'complete');
    } catch (e) {
      console.error('Image generation failed:', e);
      useExecutionStore.getState().setError(id, e instanceof Error ? e.message : 'Image generation failed');
    }
    generatingRef.current = false;
    setGenerating(false);
  }, [id, aspect]);

  // Auto-generate when upstream text arrives via Run All
  useEffect(() => {
    if (status === 'complete' && output?.text && !output?.imageBase64 && !generatingRef.current) {
      generate(output.text);
    }
  }, [status, output?.text, output?.imageBase64, generate]);

  const showSkeleton = generating;
  const showImage = output?.imageBase64 && !generating;
  const error = useExecutionStore((s) => s.errors[id]);
  const isError = useExecutionStore((s) => s.status[id] === 'error');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: 8 }}>
      {isError && error && !generating && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger-text)', background: 'var(--color-danger-bg)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-2)', fontFamily: 'var(--font-sans)' }}>
          {error}
          <button onClick={() => { useExecutionStore.getState().setStatus(id, 'idle'); if (output?.text) generate(output.text); }}
            style={{ marginLeft: 'var(--space-2)', background: 'none', border: 'none', color: 'var(--color-danger-text)', textDecoration: 'underline', cursor: 'pointer', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)' }}>Retry</button>
        </div>
      )}

      {!showImage && !showSkeleton && !isError && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>
          Connect a text source, then Run
        </div>
      )}

      {showSkeleton && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div className="skeleton-bar" style={{ width: 24, height: 24, borderRadius: '50%' }} />
            <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)' }}>Generating image…</span>
          </div>
        </div>
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
