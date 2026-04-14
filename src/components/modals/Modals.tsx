import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

function cleanText(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

const AI_ACTIONS = [
  { label: '✨ More engaging', action: (t: string) => t.replace(/\.\s/g, '! ').replace(/^(.)/,(_: string,c: string)=>c.toUpperCase()) },
  { label: '↕ Expand', action: (t: string) => t + '\n\nFurthermore, this point deserves deeper exploration as it connects to broader themes that impact the overall narrative.' },
  { label: '⇕ Condense', action: (t: string) => { const s = t.split(/[.!?]\s+/).filter(Boolean); return s.slice(0, Math.max(1, Math.ceil(s.length / 2))).join('. ') + '.'; } },
  { label: '🔄 Rephrase', action: (t: string) => t.split('. ').reverse().join('. ') },
];

interface OutputModalProps { title: string; text: string; wordCount: number; onClose: () => void; onTextChange?: (text: string) => void }

export function OutputModal({ title, text, wordCount, onClose, onTextChange }: OutputModalProps) {
  const [copied, setCopied] = useState(false);
  const [editedText, setEditedText] = useState(text);
  const [editing, setEditing] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const copy = () => { navigator.clipboard.writeText(editedText); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const clean = cleanText(editedText);
  const charCount = clean.length;
  const readTime = Math.max(1, Math.round(wordCount / 230));

  const applyAi = (action: (t: string) => string) => {
    setEditedText(action(editedText));
    setAiOpen(false);
    if (onTextChange) onTextChange(action(editedText));
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="flex flex-col shadow-2xl w-full max-w-[780px] max-h-[85vh] rounded-2xl overflow-hidden" style={{ background: '#F7F5F1', border: '1px solid #e6e3dd' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #e6e3dd' }}>
          <div>
            <div style={{ font: '500 16px/22px var(--font-sans)', color: 'var(--cg-ink)' }}>{title}</div>
            <div className="flex gap-2 mt-1" style={{ font: '500 11px/1 var(--font-mono)', color: '#6d6d6d', letterSpacing: '0.1em' }}>
              <span>{wordCount} words</span><span>·</span><span>{charCount} chars</span><span>·</span><span>{readTime} min read</span>
            </div>
          </div>
          <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/5 transition" onMouseDown={(e) => e.stopPropagation()} onClick={onClose}>
            <span style={{ fontSize: 18, color: '#6d6d6d' }}>✕</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5" style={{ scrollbarWidth: 'thin' }}>
          {editing ? (
            <textarea className="w-full min-h-[200px] text-[15px] leading-[1.8] bg-white rounded-xl p-4 outline-none resize-y" style={{ color: 'var(--cg-ink)', border: '1px solid #e6e3dd' }}
              value={editedText} onChange={(e) => setEditedText(e.target.value)} />
          ) : (
            <div style={{ font: '400 15px/1.8 var(--font-sans)', color: 'var(--cg-ink)' }} className="whitespace-pre-wrap">{clean}</div>
          )}
        </div>

        {/* AI Actions */}
        {aiOpen && (
          <div className="px-6 pb-3 flex flex-wrap gap-2">
            {AI_ACTIONS.map((a) => (
              <button key={a.label} className="btn-xs btn-outline" onMouseDown={(e) => e.stopPropagation()} onClick={() => applyAi(a.action)}>{a.label}</button>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 px-6 py-4 shrink-0" style={{ borderTop: '1px solid #e6e3dd' }}>
          <button className="btn-xs btn-outline" onMouseDown={(e) => e.stopPropagation()} onClick={() => setAiOpen(!aiOpen)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
            AI Magic
          </button>
          <button className="btn-xs btn-outline" onMouseDown={(e) => e.stopPropagation()} onClick={() => setEditing(!editing)}>{editing ? '👁 Preview' : '✏ Edit'}</button>
          <button className={copied ? 'btn-xs btn-tonal' : 'btn-xs btn-outline'} onMouseDown={(e) => e.stopPropagation()} onClick={copy}>{copied ? '✓ Copied' : 'Copy'}</button>
          <button className="btn-xs btn-outline" onMouseDown={(e) => e.stopPropagation()} onClick={() => {
            const b = new Blob([editedText], { type: 'text/plain' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${title.replace(/\s+/g, '-').toLowerCase()}.txt`; a.click();
          }}>↓ Download</button>
          <div className="flex-1" />
          <button className="btn-xs btn-primary" onMouseDown={(e) => e.stopPropagation()} onClick={onClose}>Done</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

interface ImageModalProps { src: string; prompt?: string; onClose: () => void; onRegenerate?: () => void }

export function ImageModal({ src, prompt, onClose, onRegenerate }: ImageModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="flex w-full max-w-[1100px] max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl" style={{ background: '#F7F5F1', border: '1px solid #e6e3dd' }} onClick={(e) => e.stopPropagation()}>
        {/* Left: Image */}
        <div className="flex-1 flex items-center justify-center p-6 min-w-0" style={{ background: '#1a1a1f' }}>
          <img src={src} className="max-w-full max-h-[80vh] object-contain rounded-lg" />
        </div>

        {/* Right: Details */}
        <div className="w-[320px] shrink-0 flex flex-col" style={{ borderLeft: '1px solid #e6e3dd' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #e6e3dd' }}>
            <span style={{ font: '500 15px/1 var(--font-sans)', color: 'var(--cg-ink)' }}>Image Details</span>
            <button className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-black/5 transition" onClick={onClose}>
              <span style={{ fontSize: 16, color: '#6d6d6d' }}>✕</span>
            </button>
          </div>

          {/* Info rows */}
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4" style={{ scrollbarWidth: 'thin' }}>
            <div className="flex justify-between">
              <span style={{ font: '500 11px/1 var(--font-mono)', color: '#6d6d6d', letterSpacing: '0.3em', textTransform: 'uppercase' }}>Dimensions</span>
              <span style={{ font: '400 14px/1 var(--font-sans)', color: 'var(--cg-ink)' }}>1024 × 1024</span>
            </div>
            <div className="flex justify-between">
              <span style={{ font: '500 11px/1 var(--font-mono)', color: '#6d6d6d', letterSpacing: '0.3em', textTransform: 'uppercase' }}>Model</span>
              <span style={{ font: '400 14px/1 var(--font-sans)', color: 'var(--cg-ink)' }}>Pollinations</span>
            </div>
            {prompt && (
              <div>
                <div style={{ font: '500 11px/1 var(--font-mono)', color: '#6d6d6d', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 8 }}>Prompt</div>
                <div className="text-[14px] leading-relaxed rounded-lg p-3" style={{ background: 'white', color: 'var(--cg-ink)', border: '1px solid #e6e3dd' }}>{prompt}</div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-5 py-4 flex flex-col gap-2" style={{ borderTop: '1px solid #e6e3dd' }}>
            {onRegenerate && (
              <button className="btn btn-outline w-full" onMouseDown={(e) => e.stopPropagation()} onClick={onRegenerate}>↻ Regenerate</button>
            )}
            <button className={`btn w-full ${copied ? 'btn-tonal' : 'btn-outline'}`} onMouseDown={(e) => e.stopPropagation()} onClick={() => {
              navigator.clipboard.writeText(src); setCopied(true); setTimeout(() => setCopied(false), 1500);
            }}>{copied ? '✓ Copied' : 'Copy to Clipboard'}</button>
            <button className="btn btn-primary w-full" onMouseDown={(e) => e.stopPropagation()} onClick={() => {
              const a = document.createElement('a'); a.href = src; a.download = 'image.png'; a.click();
            }}>↓ Download</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
