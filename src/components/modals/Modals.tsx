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
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 100);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
  }, [onClose]);

  return (
    <div ref={ref} style={{ position: 'absolute', left: x, top: y, zIndex: 20, transform: 'translateY(-100%)' }}>
      <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', padding: 'var(--space-1)', display: 'flex', gap: 'var(--space-1)' }}>
        {AI_ACTIONS.map((a) => (
          <button key={a.label} className="btn-xs btn-ghost" onMouseDown={(e) => e.preventDefault()} onClick={() => { onApply(a.action(selectedText)); onClose(); }}>
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ padding: 'var(--space-8)', background: 'var(--color-overlay-backdrop)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" className="flex flex-col w-full overflow-hidden"
        style={{ maxWidth, maxHeight: '85vh', background: 'var(--color-bg-card)', borderRadius: 'var(--radius-xl)', boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px var(--color-border-default)' }}
        onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
}

function ModalHeader({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between shrink-0" style={{ padding: 'var(--space-5) var(--space-6) var(--space-2)' }}>
      <div>
        <div style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-md)', lineHeight: 'var(--leading-tight)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      <button aria-label="Close" onClick={onClose}
        className="btn-icon-sm btn-ghost" style={{ color: 'var(--color-text-tertiary)', borderRadius: 'var(--radius-md)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 shrink-0" style={{ padding: 'var(--space-2) var(--space-6) var(--space-5)' }}>
      {children}
    </div>
  );
}

/* ── Output Modal ── */
interface OutputModalProps { title: string; text: string; wordCount: number; onClose: () => void; onTextChange?: (text: string) => void; onRegenerate?: () => void }

export function OutputModal({ title, text, onClose, onTextChange, onRegenerate }: OutputModalProps) {
  const [copied, setCopied] = useState(false);
  const [editedText, setEditedText] = useState(text);
  const [aiPopover, setAiPopover] = useState<{ x: number; y: number; text: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const contentRef = useRef<HTMLDivElement>(null);

  const copy = () => { navigator.clipboard.writeText(editedText); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  const onMouseUp = useCallback(() => {
    const ta = textareaRef.current;
    const container = contentRef.current;
    if (!ta || !container) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    if (start === end || end - start < 3) { setAiPopover(null); return; }
    // Position popover above the textarea, horizontally centered
    const taRect = ta.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const x = (taRect.width / 2);
    const y = taRect.top - containerRect.top;
    setAiPopover({ x, y, text: editedText.slice(start, end) });
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

  const [expanded, setExpanded] = useState(false);

  return (
    <ModalShell onClose={onClose} maxWidth={expanded ? 1100 : 720}>
      {/* Custom header with icon actions */}
      <div className="flex items-center justify-between shrink-0" style={{ padding: 'var(--space-5) var(--space-6) var(--space-2)' }}>
        <div>
          <div style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-md)', lineHeight: 'var(--leading-tight)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>{title}</div>
        </div>
        <div className="flex items-center gap-1">
          <button aria-label={copied ? 'Copied' : 'Copy'} onClick={copy} className="btn-icon-sm btn-ghost" style={{ color: copied ? 'var(--color-accent)' : 'var(--color-text-tertiary)', borderRadius: 'var(--radius-md)' }}>
            {copied
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            }
          </button>
          <button aria-label="Expand" onClick={() => setExpanded(!expanded)} className="btn-icon-sm btn-ghost" style={{ color: 'var(--color-text-tertiary)', borderRadius: 'var(--radius-md)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">{expanded ? <><path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="m14 10 7-7"/><path d="m3 21 7-7"/></> : <><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/></>}</svg>
          </button>
          <button aria-label="Close" onClick={onClose} className="btn-icon-sm btn-ghost" style={{ color: 'var(--color-text-tertiary)', borderRadius: 'var(--radius-md)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      </div>

      <div ref={contentRef} className="flex-1 overflow-y-auto relative" style={{ padding: '0 var(--space-6)', scrollbarWidth: 'thin' }}>
        {aiPopover && <AiPopover x={aiPopover.x} y={aiPopover.y} selectedText={aiPopover.text} onApply={handleAiApply} onClose={() => setAiPopover(null)} />}
        <textarea ref={textareaRef} className="w-full outline-none"
          style={{ minHeight: 320, resize: 'none', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-loose)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', background: 'transparent', border: 'none', padding: 0 }}
          value={editedText} onChange={(e) => setEditedText(e.target.value)} onMouseUp={onMouseUp} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between shrink-0" style={{ padding: 'var(--space-4) var(--space-6) var(--space-5)' }}>
        <div>
          {onRegenerate && (
            <button className="btn btn-outline" onClick={() => { onRegenerate(); onClose(); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              Regenerate
            </button>
          )}
        </div>
        <button className="btn btn-lg btn-primary" onClick={onClose}>Done</button>
      </div>
    </ModalShell>
  );
}

/* ── Image Modal ── */
interface ImageModalProps { src: string; prompt?: string; onClose: () => void; onRegenerate?: () => void }

export function ImageModal({ src, prompt, onClose, onRegenerate }: ImageModalProps) {
  const [copied, setCopied] = useState(false);
  const [variants, setVariants] = useState<string[]>([]);
  const [genLoading, setGenLoading] = useState(false);
  const [activeSrc, setActiveSrc] = useState(src);

  const generate4 = async () => {
    if (!prompt) return;
    setGenLoading(true);
    try {
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
    } catch (error) {
      console.error('Failed to generate variants:', error);
    } finally {
      setGenLoading(false);
    }
  };

  return (
    <ModalShell onClose={onClose} maxWidth={1000}>
      <div className="flex flex-1 min-h-0">
        {/* Left: Image */}
        <div className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--color-bg-dark)' }}>
          <div className="flex-1 flex items-center justify-center" style={{ padding: 'var(--space-6)' }}>
            <img src={activeSrc} alt={prompt || 'Generated image'} className="max-w-full max-h-[60vh] object-contain" style={{ borderRadius: 'var(--radius-md)' }} />
          </div>
          {(variants.length > 0 || genLoading) && (
            <div style={{ padding: '0 var(--space-6) var(--space-4)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
              {genLoading ? [0,1,2,3].map((i) => (
                <div key={i} className="skeleton-bar" style={{ aspectRatio: '1', borderRadius: 'var(--radius-md)' }} />
              )) : variants.map((img, i) => (
                <img key={i} src={img} alt={`Variant ${i + 1}`} onClick={() => setActiveSrc(img)}
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 'var(--radius-md)', cursor: 'pointer', border: img === activeSrc ? '2px solid var(--color-accent)' : '2px solid transparent' }} />
              ))}
            </div>
          )}
        </div>

        {/* Right: Details */}
        <div className="flex flex-col shrink-0" style={{ width: 300, borderLeft: '1px solid var(--color-border-subtle)' }}>
          <ModalHeader title="Details" onClose={onClose} />

          <div className="flex-1 overflow-y-auto flex flex-col" style={{ padding: '0 var(--space-5)', gap: 'var(--space-4)', scrollbarWidth: 'thin' }}>
            <div className="flex justify-between"><span className="text-label">Size</span><span style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>1024 × 1024</span></div>
            <div className="flex justify-between"><span className="text-label">Model</span><span style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>Pollinations</span></div>
            {prompt && (
              <div>
                <div className="text-label" style={{ marginBottom: 'var(--space-2)' }}>Prompt</div>
                <div style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-normal)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-secondary)', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>{prompt}</div>
              </div>
            )}
          </div>

          <div className="flex flex-col shrink-0" style={{ padding: 'var(--space-4) var(--space-5)', gap: 'var(--space-2)' }}>
            {prompt && <button className="btn-sm btn-outline w-full" disabled={genLoading} onClick={generate4}>{genLoading ? 'Generating…' : variants.length ? 'Regenerate 4' : 'Generate 4 options'}</button>}
            {onRegenerate && <button className="btn-sm btn-outline w-full" onClick={onRegenerate}>Regenerate</button>}
            <div className="flex gap-2">
              <button className={`btn-sm flex-1 ${copied ? 'btn-tonal' : 'btn-ghost'}`} onClick={() => {
                navigator.clipboard.writeText(src); setCopied(true); setTimeout(() => setCopied(false), 1500);
              }}>{copied ? 'Copied ✓' : 'Copy'}</button>
              <button className="btn-sm btn-primary flex-1" onClick={() => {
                const a = document.createElement('a'); a.href = src; a.download = 'image.png'; a.click();
              }}>Download</button>
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

export { ModalShell, ModalHeader, ModalFooter, AiPopover };
