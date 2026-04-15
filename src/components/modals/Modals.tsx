import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

/* ── AI Selection Popover ── */
const AI_ACTIONS = [
  { label: 'More engaging', action: (t: string) => t.replace(/\.\s/g, '! ').replace(/^(.)/,(_: string,c: string)=>c.toUpperCase()) },
  { label: 'Expand', action: (t: string) => t + ' Furthermore, this point deserves deeper exploration as it connects to broader themes.' },
  { label: 'Condense', action: (t: string) => { const s = t.split(/[.!?]\s+/).filter(Boolean); return s.slice(0, Math.max(1, Math.ceil(s.length / 2))).join('. ') + '.'; } },
  { label: 'Rephrase', action: (t: string) => t.split('. ').reverse().join('. ') },
];

function AiPopover({ x, y, selectedText, onApply, onClose }: { x: number; y: number; selectedText: string; onApply: (text: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    setTimeout(() => document.addEventListener('mousedown', handler), 10);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} style={{ position: 'absolute', left: x, top: y, zIndex: 10 }}>
      <div style={{ background: 'var(--color-bg-popover)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', padding: 'var(--space-1)', display: 'flex', gap: 'var(--space-1)' }}>
        {AI_ACTIONS.map((a) => (
          <button key={a.label} className="btn-xs btn-ghost" onMouseDown={(e) => e.stopPropagation()} onClick={() => { onApply(a.action(selectedText)); onClose(); }}>
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Shared Modal Shell ── */
function ModalShell({ children, onClose, maxWidth = 780 }: { children: React.ReactNode; onClose: () => void; maxWidth?: number }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ padding: 'var(--space-6)', background: 'var(--color-overlay-backdrop)' }} onClick={onClose}>
      <div className="flex flex-col w-full overflow-hidden" style={{ maxWidth, maxHeight: '85vh', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
}

function ModalHeader({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between shrink-0" style={{ padding: 'var(--space-5) var(--space-6)', borderBottom: '1px solid var(--color-border-subtle)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <div style={{ font: `var(--weight-medium) var(--text-md)/var(--leading-snug) var(--font-sans)`, color: 'var(--color-text-primary)' }}>{title}</div>
        {subtitle && <div style={{ font: `var(--weight-normal) var(--text-xs)/var(--leading-none) var(--font-sans)`, color: 'var(--color-text-tertiary)' }}>{subtitle}</div>}
      </div>
      <button onMouseDown={(e) => e.stopPropagation()} onClick={onClose} style={{ width: 44, height: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', transition: `background var(--duration-base)`, marginTop: 'calc(var(--space-1) * -1)', marginRight: 'calc(var(--space-2) * -1)' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-subtle)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 shrink-0" style={{ padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--color-border-subtle)' }}>
      {children}
    </div>
  );
}

/* ── Output Modal (edit-only) ── */
interface OutputModalProps { title: string; text: string; wordCount: number; onClose: () => void; onTextChange?: (text: string) => void }

export function OutputModal({ title, text, wordCount, onClose, onTextChange }: OutputModalProps) {
  const [copied, setCopied] = useState(false);
  const [editedText, setEditedText] = useState(text);
  const [aiPopover, setAiPopover] = useState<{ x: number; y: number; text: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charCount = editedText.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().length;
  const readTime = Math.max(1, Math.round(wordCount / 230));
  const copy = () => { navigator.clipboard.writeText(editedText); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  const onMouseUp = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    if (start === end || end - start < 3) { setAiPopover(null); return; }
    setAiPopover({ x: 0, y: -40, text: editedText.slice(start, end) });
  }, [editedText]);

  const handleAiApply = useCallback((newText: string) => {
    const ta = textareaRef.current;
    if (!ta || !aiPopover) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const updated = editedText.slice(0, start) + newText + editedText.slice(end);
    setEditedText(updated);
    if (onTextChange) onTextChange(updated);
    setAiPopover(null);
  }, [editedText, aiPopover, onTextChange]);

  return (
    <ModalShell onClose={onClose} maxWidth={780}>
      <ModalHeader title={title} subtitle={`${wordCount} words / ${charCount} chars / ${readTime} min read`} onClose={onClose} />

      <div className="flex-1 overflow-y-auto relative" style={{ padding: 'var(--space-5) var(--space-6)', scrollbarWidth: 'thin' }}>
        {aiPopover && <AiPopover x={aiPopover.x} y={aiPopover.y} selectedText={aiPopover.text} onApply={handleAiApply} onClose={() => setAiPopover(null)} />}
        <textarea ref={textareaRef} className="w-full outline-none"
          style={{ minHeight: 300, resize: 'none', font: `var(--weight-normal) 15px/var(--leading-loose) var(--font-sans)`, color: 'var(--color-text-primary)', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}
          value={editedText} onChange={(e) => setEditedText(e.target.value)} onMouseUp={onMouseUp} />
        <div style={{ font: `var(--weight-normal) var(--text-xs)/var(--leading-none) var(--font-sans)`, color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)' }}>Select text for AI actions</div>
      </div>

      <ModalFooter>
        <button className={copied ? 'btn-xs btn-tonal' : 'btn-xs btn-ghost'} onMouseDown={(e) => e.stopPropagation()} onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
        <button className="btn-xs btn-ghost" onMouseDown={(e) => e.stopPropagation()} onClick={() => {
          const b = new Blob([editedText], { type: 'text/plain' });
          const url = URL.createObjectURL(b);
          const a = document.createElement('a'); a.href = url; a.download = `${title.replace(/\s+/g, '-').toLowerCase()}.txt`; a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}>Download</button>
        <div className="flex-1" />
        <button className="btn-xs btn-primary" onMouseDown={(e) => e.stopPropagation()} onClick={onClose}>Done</button>
      </ModalFooter>
    </ModalShell>
  );
}

/* ── Image Modal (wide, split) ── */
interface ImageModalProps { src: string; prompt?: string; onClose: () => void; onRegenerate?: () => void }

export function ImageModal({ src, prompt, onClose, onRegenerate }: ImageModalProps) {
  const [copied, setCopied] = useState(false);
  const [variants, setVariants] = useState<string[]>([]);
  const [genLoading, setGenLoading] = useState(false);
  const [activeSrc, setActiveSrc] = useState(src);

  const generate4 = async () => {
    if (!prompt) return;
    setGenLoading(true);
    const baseSeed = Date.now();
    const encoded = encodeURIComponent(prompt);
    const results = await Promise.all(
      [0,1,2,3].map(async (i) => {
        const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&seed=${baseSeed + i}`;
        const res = await fetch(url);
        const blob = await res.blob();
        return new Promise<string>((resolve) => { const r = new FileReader(); r.onloadend = () => resolve(r.result as string); r.readAsDataURL(blob); });
      })
    );
    setVariants(results);
    setGenLoading(false);
  };

  return (
    <ModalShell onClose={onClose} maxWidth={1100}>
      <div className="flex flex-1 min-h-0">
        {/* Left: Image + variants */}
        <div className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--color-bg-dark)' }}>
          <div className="flex-1 flex items-center justify-center" style={{ padding: 'var(--space-6)' }}>
            <img src={activeSrc} className="max-w-full max-h-[60vh] object-contain" style={{ borderRadius: 'var(--radius-md)' }} />
          </div>
          {/* 2x2 variant grid */}
          {(variants.length > 0 || genLoading) && (
            <div style={{ padding: '0 var(--space-6) var(--space-4)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
              {genLoading ? [0,1,2,3].map((i) => (
                <div key={i} className="skeleton-bar" style={{ aspectRatio: '1', borderRadius: 'var(--radius-md)' }} />
              )) : variants.map((img, i) => (
                <img key={i} src={img} onClick={() => setActiveSrc(img)}
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 'var(--radius-md)', cursor: 'pointer', border: img === activeSrc ? '2px solid var(--color-accent)' : '2px solid transparent', transition: 'border-color var(--duration-base)' }} />
              ))}
            </div>
          )}
        </div>

        {/* Right: Details */}
        <div className="flex flex-col shrink-0" style={{ width: 320, borderLeft: '1px solid var(--color-border-subtle)' }}>
          <ModalHeader title="Image Details" onClose={onClose} />

          <div className="flex-1 overflow-y-auto flex flex-col" style={{ padding: 'var(--space-4) var(--space-5)', gap: 'var(--space-4)', scrollbarWidth: 'thin' }}>
            <div className="flex justify-between"><span className="text-label">Dimensions</span><span style={{ font: `var(--weight-normal) var(--text-sm)/1 var(--font-sans)`, color: 'var(--color-text-primary)' }}>1024 x 1024</span></div>
            <div className="flex justify-between"><span className="text-label">Model</span><span style={{ font: `var(--weight-normal) var(--text-sm)/1 var(--font-sans)`, color: 'var(--color-text-primary)' }}>Pollinations</span></div>
            {prompt && (
              <div>
                <div className="text-label" style={{ marginBottom: 'var(--space-2)' }}>Prompt</div>
                <div style={{ font: `var(--weight-normal) var(--text-sm)/var(--leading-normal) var(--font-sans)`, color: 'var(--color-text-primary)', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>{prompt}</div>
              </div>
            )}
          </div>

          <div className="flex flex-col shrink-0" style={{ padding: 'var(--space-4) var(--space-5)', gap: 'var(--space-2)', borderTop: '1px solid var(--color-border-subtle)' }}>
            {prompt && <button className="btn btn-outline w-full" disabled={genLoading} onMouseDown={(e) => e.stopPropagation()} onClick={generate4}>{genLoading ? 'Generating...' : variants.length ? 'Regenerate 4' : 'Generate 4 options'}</button>}
            {onRegenerate && <button className="btn btn-outline w-full" onMouseDown={(e) => e.stopPropagation()} onClick={onRegenerate}>Regenerate single</button>}
            <button className={`btn w-full ${copied ? 'btn-tonal' : 'btn-outline'}`} onMouseDown={(e) => e.stopPropagation()} onClick={() => {
              navigator.clipboard.writeText(src); setCopied(true); setTimeout(() => setCopied(false), 1500);
            }}>{copied ? 'Copied' : 'Copy to Clipboard'}</button>
            <button className="btn btn-primary w-full" onMouseDown={(e) => e.stopPropagation()} onClick={() => {
              const a = document.createElement('a'); a.href = src; a.download = 'image.png'; a.click();
            }}>Download</button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

/* ── Exports for design system ── */
export { ModalShell, ModalHeader, ModalFooter, AiPopover };
