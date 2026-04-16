import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getDims, RATIO_DIMS } from '../../utils/imageDims';

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
interface ImageModalProps { src: string; prompt?: string; onClose: () => void; nodeLabel?: string; aspect?: string; imgWidth?: number; imgHeight?: number; onUse?: (src: string) => void }

export function ImageModal({ src, prompt, onClose, nodeLabel, aspect, onUse }: ImageModalProps) {
  const [variants, setVariants] = useState<string[]>([]);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [activeSrc, setActiveSrc] = useState(src);
  const [editPrompt, setEditPrompt] = useState(prompt || '');
  const [zoomed, setZoomed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [copiedImg, setCopiedImg] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [ratio, setRatio] = useState(aspect || '16:9');
  const abortRef = useRef<AbortController | null>(null);
  const origPrompt = useRef(prompt || '');

  const d = getDims(ratio);
  const promptChanged = editPrompt.trim() !== origPrompt.current.trim();
  const ratioChanged = ratio !== (aspect || '16:9');
  const needsRegen = promptChanged || ratioChanged;

  // Cleanup fetches on unmount (#20)
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // Incremental variant generation (#16)
  const generate4 = async () => {
    if (!editPrompt.trim()) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setGenLoading(true);
    setGenError(null);
    setVariants([]);
    const dims = getDims(ratio);
    const baseSeed = Date.now();
    const cleanPrompt = editPrompt.trim().replace(/\n+/g, ' ');
    const encoded = encodeURIComponent(cleanPrompt);
    try {
      for (let i = 0; i < 4; i++) {
        if (ctrl.signal.aborted) return;
        try {
          const url = `https://image.pollinations.ai/prompt/${encoded}?width=${dims.w}&height=${dims.h}&nologo=true&seed=${baseSeed + i}`;
          const res = await fetch(url, { signal: ctrl.signal });
          if (!res.ok) continue;
          const blob = await res.blob();
          if (!blob.type.startsWith('image/')) continue;
          const b64: string = await new Promise((resolve) => { const r = new FileReader(); r.onloadend = () => resolve(r.result as string); r.readAsDataURL(blob); });
          if (ctrl.signal.aborted) return;
          setVariants(prev => { const next = [...prev, b64]; if (next.length === 1) setActiveSrc(b64); return next; });
        } catch (e) {
          if (ctrl.signal.aborted) return;
          // Skip this variant, continue to next
        }
      }
    } catch (error) {
      if (!ctrl.signal.aborted) setGenError(error instanceof Error ? error.message : 'Generation failed');
    } finally {
      if (!ctrl.signal.aborted) setGenLoading(false);
    }
  };

  const copyImage = async () => {
    try {
      const res = await fetch(activeSrc);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopiedImg(true);
    } catch {
      await navigator.clipboard.writeText(editPrompt);
      setCopiedImg(true);
    }
    setTimeout(() => setCopiedImg(false), 1500);
  };

  const downloadImage = () => {
    const name = (nodeLabel || 'image').replace(/\s+/g, '-').toLowerCase();
    const a = document.createElement('a'); a.href = activeSrc; a.download = `${name}-${d.w}x${d.h}.png`; a.click();
  };

  const copyPrompt = () => { navigator.clipboard.writeText(editPrompt); setCopiedPrompt(true); setTimeout(() => setCopiedPrompt(false), 1500); };

  const handleUse = () => { onUse?.(activeSrc); onClose(); };

  const thumbH = Math.round(56 * d.h / d.w);

  return (
    <ModalShell onClose={onClose} maxWidth={fullscreen ? 1400 : 1000}>
      <div className="flex flex-1 min-h-0">

        {/* ── Left: image viewer ── */}
        <div className="flex-1 flex flex-col min-w-0 relative" style={{ background: 'var(--color-bg-dark)', borderRadius: 'var(--radius-xl) 0 0 var(--radius-xl)' }}>

          {/* Toolbar overlay */}
          <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 3, display: 'flex', gap: 4 }}>
            <button onClick={() => setFullscreen(!fullscreen)}
              style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.08)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {fullscreen ? <><path d="M4 14h6v6"/><path d="M20 10h-6V4"/></> : <><path d="M15 3h6v6"/><path d="M9 21H3v-6"/></>}
              </svg>
            </button>
            {zoomed && (
              <button onClick={() => setZoomed(false)}
                style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.08)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: 11, fontFamily: 'var(--font-sans)' }}>
                Fit
              </button>
            )}
          </div>

          {/* Image — zoom only on img click (#6) */}
          <div className="flex-1 flex items-center justify-center" style={{ padding: 'var(--space-8) var(--space-6)', overflow: zoomed ? 'auto' : 'hidden' }}>
            <img src={activeSrc} alt={editPrompt || 'Generated image'}
              onClick={(e) => { e.stopPropagation(); setZoomed(!zoomed); }}
              style={{
                maxWidth: zoomed ? 'none' : '100%',
                maxHeight: zoomed ? 'none' : '62vh',
                width: zoomed ? `${Math.max(d.w, 800)}px` : undefined,
                objectFit: 'contain',
                borderRadius: 'var(--radius-md)',
                cursor: zoomed ? 'zoom-out' : 'zoom-in',
                transition: 'opacity 150ms',
              }} />
          </div>

          {/* Variant strip */}
          {(variants.length > 0 || genLoading) && (
            <div style={{ padding: '0 var(--space-6) var(--space-4)', display: 'flex', gap: 'var(--space-2)', overflowX: 'auto', scrollbarWidth: 'thin' }}>
              {variants.map((img, i) => (
                <div key={i} className="shrink-0 relative" style={{ width: 56, height: thumbH }}>
                  <img src={img} onClick={() => { setActiveSrc(img); setZoomed(false); }}
                    style={{ width: 56, height: thumbH, objectFit: 'cover', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      border: img === activeSrc ? '2px solid var(--color-accent)' : '2px solid transparent',
                      opacity: img === activeSrc ? 1 : 0.6, transition: 'opacity 150ms, border-color 150ms',
                    }} />
                  {img === activeSrc && (
                    <div style={{ position: 'absolute', top: 3, right: 3, width: 14, height: 14, borderRadius: '50%', background: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>
                    </div>
                  )}
                </div>
              ))}
              {/* Loading placeholders for remaining */}
              {genLoading && Array.from({ length: 4 - variants.length }).map((_, i) => (
                <div key={`skel-${i}`} className="skeleton-bar shrink-0" style={{ width: 56, height: thumbH, borderRadius: 'var(--radius-sm)' }} />
              ))}
            </div>
          )}
        </div>

        {/* ── Right: controls ── */}
        <div className="flex flex-col shrink-0" style={{ width: 300 }}>
          <ModalHeader title={nodeLabel || 'Image'} onClose={onClose} />

          <div className="flex-1 overflow-y-auto flex flex-col" style={{ padding: '0 var(--space-5) var(--space-4)', gap: 'var(--space-5)', scrollbarWidth: 'thin' }}>

            {/* Ratio */}
            <div>
              <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-2)' }}>
                <span className="text-label">Ratio</span>
                <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-disabled)' }}>{d.w}×{d.h}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {Object.entries(RATIO_DIMS).map(([r, dims]) => {
                  const active = r === ratio;
                  const bw = 18, bh = Math.round(18 * dims.h / dims.w);
                  return (
                    <button key={r} onClick={() => setRatio(r)}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '6px 8px',
                        background: active ? 'var(--color-interactive-active)' : 'transparent', border: active ? '1px solid var(--color-border-strong)' : '1px solid transparent',
                        borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'background 100ms' }}>
                      <div style={{ width: bw, height: bh, borderRadius: 2, border: `1.5px solid ${active ? 'var(--color-accent)' : 'var(--color-text-disabled)'}` }} />
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: active ? 'var(--color-text-primary)' : 'var(--color-text-disabled)' }}>{r}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Prompt */}
            {editPrompt !== undefined && (
              <div>
                <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-2)' }}>
                  <span className="text-label">Prompt</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {promptChanged && <button className="btn-xs btn-ghost" style={{ fontSize: 10, height: 22, padding: '0 6px', color: 'var(--color-text-disabled)' }} onClick={() => setEditPrompt(origPrompt.current)}>Reset</button>}
                    <button className="btn-xs btn-ghost" style={{ fontSize: 10, height: 22, padding: '0 6px' }} onClick={copyPrompt}>{copiedPrompt ? '✓ Copied' : 'Copy'}</button>
                  </div>
                </div>
                <textarea value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)}
                  style={{ width: '100%', minHeight: 100, resize: 'vertical', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-normal)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', outline: 'none', scrollbarWidth: 'thin', transition: 'border-color 150ms' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border-subtle)'; }}
                />
                <div className="flex justify-between" style={{ marginTop: 4 }}>
                  <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: editPrompt.length > 500 ? 'var(--color-warning-text)' : 'var(--color-text-disabled)' }}>{editPrompt.length}</span>
                  {needsRegen && <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-accent)' }}>Regenerate to apply</span>}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col shrink-0" style={{ padding: 'var(--space-4) var(--space-5)', gap: 'var(--space-2)', borderTop: '1px solid var(--color-border-subtle)' }}>
            {genError && (
              <div className="flex items-center justify-between" style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-danger-text)', background: 'var(--color-danger-bg)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)' }}>
                <span>{genError}</span>
                <button className="btn-xs btn-ghost" style={{ color: 'var(--color-danger-text)', fontSize: 10, height: 20, padding: '0 6px' }} onClick={generate4}>Retry</button>
              </div>
            )}
            <button className="btn-sm btn-primary w-full" disabled={genLoading} onClick={generate4}>
              {genLoading ? `Generating ${variants.length}/4…` : needsRegen ? 'Generate with changes' : variants.length ? 'Regenerate 4' : 'Generate 4 variants'}
            </button>
            <div className="flex gap-2">
              <button className={`btn-sm flex-1 ${copiedImg ? 'btn-tonal' : 'btn-ghost'}`} onClick={copyImage}>{copiedImg ? 'Copied ✓' : 'Copy image'}</button>
              <button className="btn-sm btn-ghost flex-1" onClick={downloadImage}>Download</button>
            </div>
            {onUse && variants.length > 0 && (
              <button className="btn-sm btn-outline w-full" onClick={handleUse}>Use this image</button>
            )}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

export { ModalShell, ModalHeader, ModalFooter, AiPopover };
