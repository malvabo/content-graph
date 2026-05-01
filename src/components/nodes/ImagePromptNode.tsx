import { useState, useCallback, useEffect, useRef } from 'react';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import { useGraphStore } from '../../store/graphStore';
import { ImageModal } from '../modals/Modals';
import { getDims } from '../../utils/imageDims';

import { useSettingsStore } from '../../store/settingsStore';
import { cssAspect } from '../../utils/imageDims';

function AbstractPlaceholder({ aspect }: { aspect: string | undefined }) {
  return (
    <div style={{ width: '100%', aspectRatio: cssAspect(aspect), borderRadius: 'var(--radius-lg)', overflow: 'hidden', position: 'relative' }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="ig-a" cx="30%" cy="30%" r="55%">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ig-b" cx="75%" cy="70%" r="50%">
            <stop offset="0%" stopColor="var(--p-violet-500)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--p-violet-500)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ig-c" cx="60%" cy="20%" r="40%">
            <stop offset="0%" stopColor="var(--p-amber-400)" stopOpacity="0.10" />
            <stop offset="100%" stopColor="var(--p-amber-400)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100" height="100" fill="var(--color-bg-surface)" />
        <rect width="100" height="100" fill="url(#ig-a)" />
        <rect width="100" height="100" fill="url(#ig-b)" />
        <rect width="100" height="100" fill="url(#ig-c)" />
        {/* horizontal bands */}
        <rect x="0" y="38" width="100" height="0.5" fill="var(--color-border)" opacity="0.5" />
        <rect x="0" y="62" width="100" height="0.5" fill="var(--color-border)" opacity="0.5" />
        {/* vertical bands */}
        <rect x="33" y="0" width="0.5" height="100" fill="var(--color-border)" opacity="0.5" />
        <rect x="66" y="0" width="0.5" height="100" fill="var(--color-border)" opacity="0.5" />
        {/* icon */}
        <g transform="translate(50,50)" opacity="0.3">
          <rect x="-9" y="-7" width="18" height="14" rx="2" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.2" />
          <circle cx="-4" cy="-2" r="2.5" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1" />
          <polyline points="-9,4 -3,-1 2,3 6,-2 9,4" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  );
}

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
  // Try Hugging Face Inference API first (free tier, good quality)
  const hfKey = useSettingsStore.getState().hfKey;
  if (hfKey) {
    const hfW = Math.min(snapToGrid(w), 1024);
    const hfH = Math.min(snapToGrid(h), 1024);
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await fetchWithTimeout('https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell', {
          method: 'POST',
          headers: { Authorization: `Bearer ${hfKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputs: prompt.slice(0, 1000), parameters: { width: hfW, height: hfH } }),
        }, 60000);
        if (res.status === 503) { await new Promise(r => setTimeout(r, 10000)); continue; }
        if (res.ok) {
          const blob = await res.blob();
          if (blob.size > 1000 && blob.type.startsWith('image')) return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
        break;
      }
    } catch { /* fall through */ }
  }

  // Try Together AI
  const togetherKey = useSettingsStore.getState().togetherKey;
  if (togetherKey) {
    const res = await fetchWithTimeout('https://api.together.xyz/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${togetherKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'black-forest-labs/FLUX.1-schnell-Free', prompt: prompt.slice(0, 1000), width: snapToGrid(w), height: snapToGrid(h), n: 1, seed, response_format: 'b64_json' }),
    });
    if (!res.ok) {
      console.warn('Together API error:', res.status, await res.text().catch(() => ''));
      // Fall through to Pollinations on any error
    } else {
      const data = await res.json();
      const b64 = data.data?.[0]?.b64_json;
      if (b64) return `data:image/png;base64,${b64}`;
      throw new Error('No image data in Together response');
    }
  }
  // Pollinations fallback (free, no key)
  const shortPrompt = prompt.slice(0, 500);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(shortPrompt)}?width=${w}&height=${h}&nologo=true&seed=${seed}`;
  const res = await fetchWithTimeout(url, {}, 60000);
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


export function ImagePromptInline({ id, expandOpen, onExpandClose }: { id: string; expandOpen?: boolean; onExpandClose?: () => void }) {
  const status = useExecutionStore((s) => s.status[id] ?? 'idle');
  const output = useOutputStore((s) => s.outputs[id]);
  const aspect = useGraphStore((s) => s.nodes.find(n => n.id === id)?.data.config.aspect as string | undefined);
  const [generating, setGenerating] = useState(false);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const generatingRef = useRef(false);

  // Open modal from parent expand button
  useEffect(() => {
    if (expandOpen && output?.imageBase64) { setViewImage(output.imageBase64); onExpandClose?.(); }
    else if (expandOpen) { onExpandClose?.(); }
  }, [expandOpen]);

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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <AbstractPlaceholder aspect={aspect} />
          <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)' }}>Connect a text source, then Run</span>
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
