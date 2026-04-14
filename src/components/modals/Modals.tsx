import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

function cleanText(raw: string): string {
  return raw.replace(/\n{3,}/g, '\n\n').trim();
}

interface OutputModalProps { title: string; text: string; wordCount: number; onClose: () => void }

export function OutputModal({ title, text, wordCount, onClose }: OutputModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const clean = cleanText(text);
  const charCount = clean.length;
  const readTime = Math.max(1, Math.round(wordCount / 230));

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-[720px] max-h-[85vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: '1px solid var(--cg-border)' }}>
          <div>
            <div style={{ font: '500 15px/22px var(--font-sans)', color: 'var(--cg-ink)' }}>{title}</div>
            <div className="flex gap-2 mt-0.5" style={{ font: '400 14px/1 var(--font-sans)', color: 'var(--cg-ink-3)' }}>
              <span>{wordCount.toLocaleString()} words</span>
              <span>·</span>
              <span>{charCount.toLocaleString()} chars</span>
              <span>·</span>
              <span>{readTime} min read</span>
            </div>
          </div>
          <button className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[var(--cg-surface)] transition" onClick={onClose}>
            <span style={{ fontSize: 16, color: 'var(--cg-ink-3)' }}>✕</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: 'thin' }}>
          <div style={{ font: '400 14px/1.75 var(--font-sans)', color: 'var(--cg-ink)' }} className="whitespace-pre-wrap">{clean}</div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-3 shrink-0" style={{ borderTop: '1px solid var(--cg-border)' }}>
          <button className={copied ? 'btn-xs btn-tonal' : 'btn-xs btn-outline'} onClick={copy}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
          <button className="btn-xs btn-outline" onClick={() => {
            const b = new Blob([text], { type: 'text/markdown' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${title.replace(/\s+/g, '-').toLowerCase()}.md`; a.click();
          }}>Download .md</button>
          <button className="btn-xs btn-outline" onClick={() => {
            const b = new Blob([text], { type: 'text/plain' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${title.replace(/\s+/g, '-').toLowerCase()}.txt`; a.click();
          }}>Download .txt</button>
          <div className="flex-1" />
          <button className="btn-xs btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

interface ImageModalProps { src: string; info: string; onClose: () => void; onRegenerate?: () => void }

export function ImageModal({ src, info, onClose, onRegenerate }: ImageModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const copyImage = async () => {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      navigator.clipboard.writeText(src);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1a1a1f] rounded-xl w-full max-w-[860px] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ font: '400 14px/1 var(--font-sans)', color: 'rgba(255,255,255,0.5)' }}>{info}</div>
          <button className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10 transition" onClick={onClose}>
            <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)' }}>✕</span>
          </button>
        </div>

        {/* Image */}
        <div className="flex-1 flex items-center justify-center p-5 overflow-hidden min-h-0">
          <img src={src} className="max-w-full max-h-full object-contain rounded-lg" style={{ boxShadow: '0 4px 40px rgba(0,0,0,0.4)' }} />
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-3 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button className="btn-xs" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' }}
            onClick={() => { const a = document.createElement('a'); a.href = src; a.download = 'image.png'; a.click(); }}>
            ↓ Download
          </button>
          <button className="btn-xs" style={{ background: copied ? 'rgba(13,191,90,0.2)' : 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' }}
            onClick={copyImage}>
            {copied ? '✓ Copied' : 'Copy image'}
          </button>
          {onRegenerate && (
            <button className="btn-xs" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' }}
              onClick={onRegenerate}>
              ↻ Regenerate
            </button>
          )}
          <div className="flex-1" />
          <button className="btn-xs" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
