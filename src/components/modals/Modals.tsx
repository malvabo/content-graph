import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getDims, RATIO_DIMS } from '../../utils/imageDims';

/* ── AI Selection Popover ── */
const AI_ACTIONS = [
  { label: 'Shorter', action: (t: string) => {
    const sentences = t.match(/[^.!?]+[.!?]+/g) || [t];
    if (sentences.length <= 1) return t.split(/,\s*/).slice(0, Math.ceil(t.split(/,\s*/).length / 2)).join(', ');
    return sentences.slice(0, Math.ceil(sentences.length / 2)).join(' ').trim();
  }},
  { label: 'Longer', action: (t: string) => {
    const sentences = t.match(/[^.!?]+[.!?]+/g) || [t];
    const last = sentences[sentences.length - 1]?.trim() || t;
    return t + ` To elaborate on this further — ${last.charAt(0).toLowerCase() + last.slice(1).replace(/[.!?]+$/, '')} has broader implications worth exploring.`;
  }},
  { label: 'More engaging', action: (t: string) => {
    let result = t;
    // Strengthen weak verbs
    result = result.replace(/\bis\b/g, 'becomes').replace(/\bwas\b/g, 'proved to be');
    // Add emphasis to first sentence
    const first = result.match(/^[^.!?]+/);
    if (first) result = result.replace(first[0], first[0].replace(/^(\w)/, (_, c) => c.toUpperCase()));
    return result;
  }},
  { label: 'Rephrase', action: (t: string) => {
    // Swap clause order within sentences where possible
    return t.replace(/([^,]+),\s*([^.!?]+)([.!?])/g, '$2, $1$3').trim();
  }},
];

function AiPopover({ x, y, selectedText, onApply, onClose }: { x: number; y: number; selectedText: string; onApply: (text: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 100);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
  }, [onClose]);
  return (
    <div ref={ref} style={{ position: 'absolute', left: x, top: y, zIndex: 9999, transform: 'translateY(-100%)' }}>
      <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', padding: 'var(--space-1)', display: 'flex', gap: 'var(--space-1)' }}>
        {AI_ACTIONS.map((a) => (
          <button key={a.label} className="btn-xs btn-ghost" onMouseDown={(e) => e.preventDefault()} onClick={() => { onApply(a.action(selectedText)); onClose(); }}>{a.label}</button>
        ))}
      </div>
    </div>
  );
}

/* ── Shared Modal Shell ── */
/* #1/#2: consistent padding on shell backdrop */
function ModalShell({ children, onClose, maxWidth = 780 }: { children: React.ReactNode; onClose: () => void; maxWidth?: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center" style={{ padding: 0, background: 'var(--color-overlay-backdrop)', backdropFilter: 'blur(2px)', opacity: visible ? 1 : 0, transition: 'opacity 150ms ease' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" className="flex flex-col w-full overflow-hidden"
        style={{ maxWidth: typeof window !== 'undefined' && window.innerWidth < 768 ? '100%' : maxWidth, maxHeight: typeof window !== 'undefined' && window.innerWidth < 768 ? '95vh' : 'min(92vh, calc(100vh - 48px))', background: 'var(--color-bg-card)', borderRadius: typeof window !== 'undefined' && window.innerWidth < 768 ? 'var(--radius-xl) var(--radius-xl) 0 0' : 'var(--radius-xl)', boxShadow: '0 16px 48px rgba(0,0,0,0.18), 0 0 0 1px var(--color-border-default)', transform: visible ? 'translateY(0)' : 'translateY(16px)', opacity: visible ? 1 : 0, transition: 'transform 150ms ease, opacity 150ms ease' }}
        onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
}

/* #1: consistent header padding 20 24 12 */
function ModalHeader({ title, subtitle, onClose, extra }: { title: string; subtitle?: string; onClose: () => void; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between shrink-0" style={{ padding: 'var(--space-5) var(--space-6) var(--space-4)' }}>
      <div>
        <div style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-md)', lineHeight: 'var(--leading-tight)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-1)' }}>{subtitle}</div>}
      </div>
      <div className="flex items-center gap-1">
        {extra}
        <button aria-label="Close" onClick={onClose} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-md)', color: 'var(--color-text-tertiary)', transition: 'background 100ms' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
    </div>
  );
}

/* #2: consistent footer padding 16 24 20 */
function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 shrink-0" style={{ padding: 'var(--space-4) var(--space-6) var(--space-5)' }}>
      {children}
    </div>
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
  const [ratio, setRatio] = useState(aspect || '16:9');
  const abortRef = useRef<AbortController | null>(null);
  const origPrompt = useRef(prompt || '');

  const d = getDims(ratio);
  const promptChanged = editPrompt.trim() !== origPrompt.current.trim();
  const ratioChanged = ratio !== (aspect || '16:9');
  const needsRegen = promptChanged || ratioChanged;
  const thumbH = Math.round(56 * d.h / d.w);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

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
    const encoded = encodeURIComponent(editPrompt.trim().replace(/\n+/g, ' '));
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
        } catch { if (ctrl.signal.aborted) return; }
      }
    } catch (error) {
      if (!ctrl.signal.aborted) setGenError(error instanceof Error ? error.message : 'Generation failed');
    } finally {
      if (!ctrl.signal.aborted) setGenLoading(false);
    }
  };

  const copyImage = async () => {
    try { const res = await fetch(activeSrc); const blob = await res.blob(); await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); setCopiedImg(true); }
    catch { await navigator.clipboard.writeText(editPrompt); setCopiedImg(true); }
    setTimeout(() => setCopiedImg(false), 1500);
  };
  const downloadImage = () => { const a = document.createElement('a'); a.href = activeSrc; a.download = `${(nodeLabel || 'image').replace(/\s+/g, '-').toLowerCase()}-${d.w}x${d.h}.png`; a.click(); };

  /* #19: image viewer toolbar uses consistent token-based styling */
  const toolBtn: React.CSSProperties = { width: 'var(--size-control-sm)', height: 'var(--size-control-sm)', borderRadius: 'var(--radius-sm)', background: 'var(--color-overlay-dark)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-disabled)' };

  return (
    <ModalShell onClose={onClose} maxWidth={fullscreen ? 1400 : 1000}>
      <div className="flex flex-1 min-h-0">

        {/* ── Left: image viewer ── */}
        <div className="flex-1 flex flex-col min-w-0 relative" style={{ background: 'var(--color-bg-dark)', borderRadius: 'var(--radius-xl) 0 0 var(--radius-xl)' }}>
          {/* Vignette */}
          <div style={{ position: 'absolute', inset: 0, borderRadius: 'var(--radius-xl) 0 0 var(--radius-xl)', background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.3) 100%)', pointerEvents: 'none', zIndex: 1 }} />
          <div style={{ position: 'absolute', top: 'var(--space-3)', left: 'var(--space-3)', zIndex: 3, display: 'flex', gap: 'var(--space-1)' }}>
            <button onClick={() => setFullscreen(!fullscreen)} style={toolBtn}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {fullscreen ? <><path d="M4 14h6v6"/><path d="M20 10h-6V4"/></> : <><path d="M15 3h6v6"/><path d="M9 21H3v-6"/></>}
              </svg>
            </button>
            {zoomed && <button onClick={() => setZoomed(false)} style={{ ...toolBtn, fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)' }}>Fit</button>}
          </div>

          <div className="flex-1 flex items-center justify-center" style={{ padding: 'var(--space-8) var(--space-6)', overflow: zoomed ? 'auto' : 'hidden' }}>
            <img src={activeSrc} alt={editPrompt || 'Generated image'}
              onClick={(e) => { e.stopPropagation(); setZoomed(!zoomed); }}
              style={{ maxWidth: zoomed ? 'none' : '100%', maxHeight: zoomed ? 'none' : '62vh', width: zoomed ? `${Math.max(d.w, 800)}px` : undefined, objectFit: 'contain', borderRadius: 'var(--radius-md)', cursor: zoomed ? 'zoom-out' : 'zoom-in', transition: 'opacity 150ms ease' }} />
          </div>

          {(variants.length > 0 || genLoading) && (
            <div style={{ padding: '0 var(--space-6) var(--space-4)', display: 'flex', gap: 'var(--space-2)', overflowX: 'auto', scrollbarWidth: 'thin' }}>
              {variants.map((img, i) => (
                <div key={i} className="shrink-0 flex flex-col items-center" style={{ gap: 3 }}>
                  <div className="relative" style={{ width: 56, height: thumbH }}>
                    <img src={img} onClick={() => { setActiveSrc(img); setZoomed(false); }}
                      style={{ width: 56, height: thumbH, objectFit: 'cover', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: img === activeSrc ? '2px solid var(--color-accent)' : '2px solid transparent', opacity: img === activeSrc ? 1 : 0.6, transition: 'opacity 150ms' }} />
                    {img === activeSrc && (
                      <div style={{ position: 'absolute', top: 3, right: 3, width: 14, height: 14, borderRadius: '50%', background: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: img === activeSrc ? 'var(--color-text-secondary)' : 'var(--color-text-disabled)' }}>{i + 1}</span>
                </div>
              ))}
              {genLoading && Array.from({ length: 4 - variants.length }).map((_, i) => (
                <div key={`s${i}`} className="skeleton-bar shrink-0" style={{ width: 56, height: thumbH, borderRadius: 'var(--radius-sm)' }} />
              ))}
            </div>
          )}
        </div>

        {/* ── Right panel ── */}
        {/* #6/#7: consistent horizontal padding var(--space-6) everywhere */}
        <div className="flex flex-col shrink-0" style={{ width: 300 }}>
          <ModalHeader title={nodeLabel || 'Image'} onClose={onClose} />

          <div className="flex-1 overflow-y-auto flex flex-col" style={{ padding: '0 var(--space-6) var(--space-4)', gap: 'var(--space-5)', scrollbarWidth: 'thin' }}>

            {/* #9: visual ratio picker with shape previews */}
            <div>
              <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-2)' }}>
                <span className="text-field-label">Ratio</span>
                <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-disabled)' }}>{d.w}×{d.h}</span>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {Object.entries(RATIO_DIMS).map(([r, dims]) => {
                  const active = r === ratio;
                  const bw = 18, bh = Math.round(18 * dims.h / dims.w);
                  return (
                    <button key={r} onClick={() => setRatio(r)}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)', padding: 'var(--space-1) var(--space-2)',
                        background: active ? 'var(--color-interactive-active)' : 'transparent', border: active ? '1px solid var(--color-border-strong)' : '1px solid transparent',
                        borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'background 100ms' }}>
                      <div style={{ width: bw, height: bh, borderRadius: 2, border: `1.5px solid ${active ? 'var(--color-accent)' : 'var(--color-text-disabled)'}` }} />
                      <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: active ? 'var(--color-text-primary)' : 'var(--color-text-disabled)' }}>{r}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* #18: divider between sections */}
            <div style={{ height: 1, background: 'var(--color-border-subtle)', margin: '0 calc(var(--space-1) * -1)' }} />

            {/* Prompt */}
            {editPrompt !== undefined && (
              <div>
                <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-2)' }}>
                  <span className="text-field-label">Prompt</span>
                  {promptChanged && <button className="btn-xs btn-ghost" style={{ color: 'var(--color-text-disabled)' }} onClick={() => setEditPrompt(origPrompt.current)}>Reset</button>}
                </div>
                <textarea value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)}
                  className="form-textarea" style={{ minHeight: 160, scrollbarWidth: 'thin' }}
                />
                <div className="flex justify-between" style={{ marginTop: 'var(--space-1)' }}>
                  <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: editPrompt.length > 500 ? 'var(--color-warning-text)' : 'var(--color-text-disabled)' }}>{editPrompt.length}</span>
                  {needsRegen && <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-accent)' }}>Regenerate to apply</span>}
                </div>
                <div className="flex flex-wrap gap-1" style={{ marginTop: 'var(--space-2)' }}>
                  {['cinematic', 'minimal', 'editorial', 'vibrant', 'moody'].map(s => (
                    <button key={s} className="btn-xs btn-ghost" style={{ fontSize: 'var(--text-xs)', textTransform: 'lowercase' }}
                      onClick={() => setEditPrompt(p => p.includes(s) ? p : `${p.trimEnd()}, ${s}`)}>+{s}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions — no top border */}
          <div className="flex flex-col shrink-0" style={{ padding: 'var(--space-4) var(--space-6) var(--space-5)', gap: 'var(--space-2)' }}>
            {genError && (
              <div className="flex items-center justify-between" style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-danger-text)', background: 'var(--color-danger-bg)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)' }}>
                <span>{genError}</span>
                <button className="btn-xs btn-ghost" style={{ color: 'var(--color-danger-text)' }} onClick={generate4}>Retry</button>
              </div>
            )}
            {/* #17: "Use this" is primary when variants exist, generate is secondary */}
            {onUse && variants.length > 0 ? (
              <>
                <button className="btn-sm btn-primary w-full" onClick={() => { onUse(activeSrc); onClose(); }}>Use variant {variants.indexOf(activeSrc) + 1}</button>
                <button className="btn-sm btn-ghost w-full" disabled={genLoading} onClick={generate4}>
                {genLoading ? `Generating ${variants.length}/4…` : 'Regenerate 4'}
                </button>
              </>
            ) : (
              <button className="btn-sm btn-primary w-full" disabled={genLoading} onClick={generate4}>
                {genLoading ? `Generating ${variants.length}/4…` : needsRegen ? 'Generate with changes' : variants.length ? 'Regenerate 4' : 'Generate 4 variants'}
              </button>
            )}
            {genLoading && <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)', textAlign: 'center' }}>~15s per image</div>}
            <div className="flex gap-2">
              <button className={`btn-sm flex-1 ${copiedImg ? 'btn-tonal' : 'btn-ghost'}`} onClick={copyImage}>{copiedImg ? 'Copied ✓' : 'Copy image'}</button>
              <button className="btn-sm btn-ghost flex-1" onClick={downloadImage}>Download</button>
            </div>
            {variants.length > 1 && (
              <button className="btn-sm btn-ghost w-full" onClick={() => { const name = (nodeLabel || 'image').replace(/\s+/g, '-').toLowerCase(); variants.forEach((v, i) => { const a = document.createElement('a'); a.href = v; a.download = `${name}-v${i + 1}-${d.w}x${d.h}.png`; a.click(); }); }}>Download all {variants.length}</button>
            )}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

export { ModalShell, ModalHeader, ModalFooter, AiPopover };
