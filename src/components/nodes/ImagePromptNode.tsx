import { useState, useCallback, useEffect } from 'react';
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

  const generate = useCallback(async (prompt: string) => {
    setGenerating(true);
    try {
      const d = getDims(aspect);
      const img = await genImage(prompt, Date.now(), d.w, d.h);
      useOutputStore.getState().setOutput(id, { text: prompt, imageBase64: img, imgWidth: d.w, imgHeight: d.h });
    } catch { /* silent */ }
    setGenerating(false);
  }, [id, aspect]);

  useEffect(() => {
    if (status === 'running') {
      const cur = useOutputStore.getState().outputs[id];
      if (cur?.imageBase64) {
        useOutputStore.getState().setOutput(id, { text: cur.text, imageBase64: undefined });
      }
    }
  }, [status, id]);

  useEffect(() => {
    if (status === 'complete' && output?.text && !output?.imageBase64 && !generating) {
      generate(output.text);
    }
  }, [status, output?.text, output?.imageBase64, generating, generate]);

  const content = (() => {
    if (status === 'idle' || status === 'stale') {
      return (
        <div style={{ height: BOX_H, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>
          Connect a text source, then Run
        </div>
      );
    }

    if ((status === 'running' && !generating) || generating) {
      return <div className="rounded-lg skeleton-bar" style={{ height: BOX_H }} />;
    }

    if (status === 'complete' && output?.imageBase64) {
      return (
        <div className="relative" style={{ height: BOX_H }}>
          <div className="cursor-pointer" onMouseDown={(e) => e.stopPropagation()} onClick={() => setViewImage(output.imageBase64!)}>
            <img src={output.imageBase64} alt="Generated" className="w-full rounded-lg"
              style={{ height: BOX_H, objectFit: 'cover' }} />
          </div>
          <button className="btn-micro absolute bottom-2 right-2" style={{ background: 'var(--color-bg-card)', boxShadow: 'var(--shadow-sm)' }}
            onMouseDown={(e) => e.stopPropagation()} onClick={() => generate(output.text || '')}>
            {generating ? 'Generating…' : 'Regenerate'}
          </button>
          {viewImage && <ImageModal src={viewImage} prompt={output.text} nodeLabel="Image Prompt" onClose={() => setViewImage(null)} aspect={aspect}
            onUse={(img: string) => { useOutputStore.getState().setOutput(id, { ...output, imageBase64: img }); setViewImage(null); }} />}
        </div>
      );
    }

    if (status === 'warning') {
      return (
        <div style={{ height: BOX_H, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-warning-text)', background: 'var(--color-warning-bg)', borderRadius: 'var(--radius-sm)' }}>
          No input — connect a text node upstream
        </div>
      );
    }

    return null;
  })();

  return <div className="mt-2">{content}</div>;
}
