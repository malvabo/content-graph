import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getDims, RATIO_DIMS, PURPOSE_RATIO } from '../../utils/imageDims';
import { IMAGE_MODEL_OPTIONS, IMAGE_RESOLUTION_OPTIONS } from '../../utils/nodeDefs';
import { useGraphStore } from '../../store/graphStore';
import { useSettingsStore } from '../../store/settingsStore';

/* ── AI Selection Popover ── */
const AI_ACTIONS = [
  { label: 'Shorter', action: (t: string) => {
    const sentences = t.match(/[^.!?]+[.!?]+\s*/g);
    if (!sentences || sentences.length <= 1) {
      // Single sentence: trim filler words
      return t.replace(/\b(very|really|just|quite|rather|somewhat|actually|basically|literally|definitely)\s+/gi, '').replace(/\s{2,}/g, ' ').trim();
    }
    // Multiple sentences: keep first ~60%
    const keep = Math.max(1, Math.ceil(sentences.length * 0.6));
    return sentences.slice(0, keep).join('').trim();
  }},
  { label: 'Longer', action: (t: string) => {
    const sentences = t.match(/[^.!?]+[.!?]+\s*/g) || [t];
    // Insert an elaboration after the first sentence
    const elaboration = sentences.length > 1
      ? ' This is particularly worth noting because it shapes how we think about the broader context.'
      : ' In other words, this carries more weight than it might first appear — and the implications extend further than expected.';
    return sentences[0].trim() + elaboration + ' ' + sentences.slice(1).join('').trim();
  }},
  { label: 'More engaging', action: (t: string) => {
    let result = t;
    // Swap passive constructions to active-sounding
    result = result.replace(/\bIt is\b/g, "It's").replace(/\bit is\b/g, "it's");
    result = result.replace(/\bdo not\b/g, "don't").replace(/\bDo not\b/g, "Don't");
    result = result.replace(/\bcannot\b/g, "can't").replace(/\bwill not\b/g, "won't");
    // Add a hook at the start if it's a plain statement
    if (/^[A-Z][a-z]/.test(result) && !result.startsWith('Here') && !result.startsWith('This')) {
      result = "Here's the thing \u2014 " + result.charAt(0).toLowerCase() + result.slice(1);
    }
    return result;
  }},
  { label: 'Rephrase', action: (t: string) => {
    const sentences = t.match(/[^.!?]+[.!?]+\s*/g);
    if (!sentences || sentences.length <= 1) {
      // Single sentence: try swapping around em-dash, colon, or semicolon
      if (t.includes(' — ')) { const [a, b] = t.split(' — ', 2); return b.charAt(0).toUpperCase() + b.slice(1).replace(/[.!?]\s*$/, '') + ' — ' + a.charAt(0).toLowerCase() + a.slice(1).trim() + '.'; }
      return t;
    }
    // Multiple sentences: reverse sentence order, fix capitalization
    const reversed = [...sentences].reverse().map(s => s.trim());
    return reversed.map((s, i) => i === 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s.charAt(0).toLowerCase() + s.slice(1)).join(' ').trim();
  }},
];

function AiPopover({ x, y, selectedText, onApply, onClose }: { x: number; y: number; selectedText: string; onApply: (text: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 100);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
  }, [onClose]);
  return createPortal(
    <div ref={ref} style={{ position: 'fixed', left: x, top: y, zIndex: 99999, transform: 'translate(-50%, -100%)', paddingBottom: 4 }}>
      <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', padding: 'var(--space-1)', display: 'flex', gap: 'var(--space-1)' }} role="menu">
        {AI_ACTIONS.map((a) => (
          <button key={a.label} role="menuitem" className="btn-xs btn-ghost" onMouseDown={(e) => e.preventDefault()} onClick={() => { onApply(a.action(selectedText)); onClose(); }}>{a.label}</button>
        ))}
      </div>
    </div>,
    document.body
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
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end md:items-center justify-center" style={{ padding: 0, background: 'var(--color-overlay-backdrop)', backdropFilter: 'blur(2px)', opacity: visible ? 1 : 0, transition: 'opacity 150ms ease' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Image Prompt" className="flex flex-col w-full overflow-hidden rounded-t-[var(--radius-xl)] md:rounded-[var(--radius-xl)]"
        style={{ maxWidth: isMobile ? '100%' : maxWidth, maxHeight: isMobile ? '95vh' : `min(92vh, calc(100vh - 48px))`, background: 'var(--color-bg-card)', boxShadow: '0 16px 48px rgba(0,0,0,0.18), 0 0 0 1px var(--color-border-default)', transform: visible ? 'translateY(0)' : 'translateY(16px)', opacity: visible ? 1 : 0, transition: 'transform 150ms ease, opacity 150ms ease' }}
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
        <button aria-label="Close" onClick={onClose} style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-md)', color: 'var(--color-text-tertiary)', transition: 'background 100ms' }}
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
interface ImageModalProps { src: string; prompt?: string; onClose: () => void; nodeLabel?: string; aspect?: string; imgWidth?: number; imgHeight?: number; onUse?: (src: string) => void; nodeId?: string }

export function ImageModal({ src, prompt, onClose, nodeLabel, aspect, onUse, nodeId }: ImageModalProps) {
  const config = useGraphStore((s) => nodeId ? s.nodes.find(n => n.id === nodeId)?.data.config as Record<string, unknown> ?? {} : {});
  const updateConfig = useGraphStore((s) => s.updateNodeConfig);
  const setConfig = (k: string, v: unknown) => { if (nodeId) updateConfig(nodeId, { [k]: v }); };

  const [variants, setVariants] = useState<string[]>([]);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [activeSrc, setActiveSrc] = useState(src);
  const [editPrompt, setEditPrompt] = useState(prompt || '');
  const [zoomed, setZoomed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [copiedImg, setCopiedImg] = useState(false);
  const [ratio, setRatio] = useState(aspect || (config.aspect as string) || '16:9');
  const abortRef = useRef<AbortController | null>(null);
  const origPrompt = useRef(prompt || '');

  const purpose = (config.purpose as string) ?? 'Blog hero';
  const style = (config.style as string) ?? 'Photography';
  const imageModel = (config.imageModel as string) ?? 'FLUX.1 schnell';
  const resolution = (config.resolution as string) ?? '1024x1024';

  const d = getDims(ratio);
  const promptChanged = editPrompt.trim() !== origPrompt.current.trim();
  const ratioChanged = ratio !== (aspect || (config.aspect as string) || '16:9');
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
    const { openaiKey, togetherKey } = useSettingsStore.getState();
    const prompt = editPrompt.trim().slice(0, 1000);
    const w = dims.w, h = dims.h;
    const snap = (n: number) => Math.round(n / 64) * 64;

    const genOne = async (seed: number): Promise<string | null> => {
      // Try OpenAI DALL-E 3
      if (openaiKey) {
        const size = w > h ? '1792x1024' : h > w ? '1024x1792' : '1024x1024';
        const res = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST', signal: ctrl.signal,
          headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size, response_format: 'b64_json' }),
        });
        if (res.ok) { const d = await res.json(); const b = d.data?.[0]?.b64_json; if (b) return `data:image/png;base64,${b}`; }
      }
      // Try Together AI
      if (togetherKey) {
        const res = await fetch('https://api.together.xyz/v1/images/generations', {
          method: 'POST', signal: ctrl.signal,
          headers: { Authorization: `Bearer ${togetherKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'black-forest-labs/FLUX.1-schnell-Free', prompt, width: snap(w), height: snap(h), n: 1, seed, response_format: 'b64_json' }),
        });
        if (res.ok) { const d = await res.json(); const b = d.data?.[0]?.b64_json; if (b) return `data:image/png;base64,${b}`; }
      }
      // Pollinations fallback
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true&seed=${seed}`;
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (blob.size < 1000) return null;
      return new Promise(resolve => { const r = new FileReader(); r.onloadend = () => resolve(r.result as string); r.onerror = () => resolve(null); r.readAsDataURL(blob); });
    };

    try {
      for (let i = 0; i < 4; i++) {
        if (ctrl.signal.aborted) return;
        try {
          const img = await genOne(Date.now() + i);
          if (ctrl.signal.aborted) return;
          if (img) setVariants(prev => { const next = [...prev, img]; if (next.length === 1) setActiveSrc(img); return next; });
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
      <div className="flex flex-col md:flex-row flex-1 min-h-0">

        {/* ── Left: image viewer ── */}
        <div className="flex-1 flex flex-col min-w-0 relative" style={{ background: 'var(--color-bg-dark)', borderRadius: /* on mobile should be top-only */ typeof window !== 'undefined' && window.innerWidth < 768 ? 'var(--radius-xl) var(--radius-xl) 0 0' : 'var(--radius-xl) 0 0 var(--radius-xl)' }}>
          {/* Vignette */}
          <div style={{ position: 'absolute', inset: 0, borderRadius: 'var(--radius-xl) 0 0 var(--radius-xl)', background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.2) 100%)', pointerEvents: 'none', zIndex: 1 }} />
          <div style={{ position: 'absolute', top: 'var(--space-3)', left: 'var(--space-3)', zIndex: 3, display: 'flex', gap: 'var(--space-1)' }}>
            <button onClick={() => setFullscreen(!fullscreen)} title={fullscreen ? 'Exit fullscreen' : 'Expand preview'} style={toolBtn}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {fullscreen ? <><path d="M4 14h6v6"/><path d="M20 10h-6V4"/></> : <><path d="M15 3h6v6"/><path d="M9 21H3v-6"/></>}
              </svg>
            </button>
            {zoomed && <button onClick={() => setZoomed(false)} style={{ ...toolBtn, fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)' }}>Fit</button>}
          </div>

          <div className="flex-1 flex items-center justify-center" style={{ padding: 'var(--space-6)', overflow: 'hidden' }}>
            <div style={{
              position: 'relative',
              width: '100%',
              maxHeight: '100%',
              aspectRatio: `${d.w} / ${d.h}`,
              borderRadius: 'var(--radius-md)', overflow: 'hidden',
              border: '2px solid rgba(255,255,255,0.15)',
              transition: 'aspect-ratio 600ms cubic-bezier(0.25, 0.1, 0.25, 1)',
            }}>
              <img src={activeSrc} alt={editPrompt || 'Generated image'}
                onClick={(e) => { e.stopPropagation(); setZoomed(!zoomed); }}
                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: zoomed ? 'zoom-out' : 'zoom-in' }} />
              <div style={{ position: 'absolute', bottom: 'var(--space-2)', left: 'var(--space-2)', background: 'rgba(0,0,0,0.6)', borderRadius: 'var(--radius-sm)', padding: '2px 8px', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'rgba(255,255,255,0.8)' }}>
                {ratio}
              </div>
            </div>
          </div>

          {(variants.length > 0 || genLoading) && (
            <div style={{ padding: '0 var(--space-6) var(--space-4)', display: 'flex', gap: 'var(--space-2)', overflowX: 'auto', scrollbarWidth: 'thin' }}>
              {Array.from({ length: 4 }).map((_, i) => {
                const img = variants[i];
                return (
                  <div key={i} className="shrink-0 flex flex-col items-center" style={{ gap: 3 }}>
                    <div className="relative" style={{ width: 56, height: thumbH }}>
                      {img ? (
                        <>
                          <img src={img} alt={`Variant ${i + 1}`} onClick={() => { setActiveSrc(img); setZoomed(false); }}
                            style={{ width: 56, height: thumbH, objectFit: 'cover', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: img === activeSrc ? '2px solid var(--color-accent)' : '2px solid transparent', opacity: img === activeSrc ? 1 : 0.6, transition: 'opacity 150ms' }} />
                          {img === activeSrc && (
                            <div style={{ position: 'absolute', top: 3, right: 3, width: 14, height: 14, borderRadius: '50%', background: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>
                            </div>
                          )}
                        </>
                      ) : genLoading ? (
                        <div className="skeleton-bar" style={{ width: 56, height: thumbH, borderRadius: 'var(--radius-sm)' }} />
                      ) : null}
                    </div>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: img && img === activeSrc ? 'var(--color-text-secondary)' : 'var(--color-text-disabled)' }}>{i + 1}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right panel ── */}
        {/* #6/#7: consistent horizontal padding var(--space-6) everywhere */}
        <div className="flex flex-col shrink-0 w-full md:w-[300px]">
          <ModalHeader title={nodeLabel || 'Image'} subtitle="Configure and generate variants" onClose={onClose} />

          <div className="flex-1 overflow-y-auto flex flex-col" style={{ padding: '0 var(--space-6) var(--space-4)', gap: 'var(--space-4)', scrollbarWidth: 'thin' }}>

            {/* #9: visual ratio picker with shape previews */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-field-label">Ratio</span>
                <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--color-text-disabled)' }}>{d.w}×{d.h}</span>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {Object.entries(RATIO_DIMS).map(([r, dims]) => {
                  const active = r === ratio;
                  const maxW = 18, maxH = 24;
                  const aspect_r = dims.w / dims.h;
                  let bw, bh;
                  if (aspect_r >= 1) { bw = maxW; bh = Math.round(maxW / aspect_r); }
                  else { bh = maxH; bw = Math.round(maxH * aspect_r); }
                  return (
                    <button key={r} aria-pressed={active} onClick={() => { setRatio(r); setConfig('aspect', r); }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)', padding: 'var(--space-1) var(--space-2)',
                        background: active ? 'var(--color-interactive-active)' : 'transparent', border: active ? '1px solid var(--color-border-strong)' : '1px solid transparent',
                        borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'background 100ms' }}>
                      <div style={{ width: bw, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: bw, height: bh, borderRadius: 2, border: `1.5px solid ${active ? 'var(--color-accent)' : 'var(--color-text-disabled)'}` }} />
                      </div>
                      <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: active ? 'var(--color-text-primary)' : 'var(--color-text-disabled)' }}>{r}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--color-border-subtle)' }} />

            {/* Node settings */}
            {nodeId && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div>
                  <span className="text-field-label">Purpose</span>
                  <select className="form-select w-full" value={purpose} onChange={e => { setConfig('purpose', e.target.value); const r = PURPOSE_RATIO[e.target.value]; if (r) { setRatio(r); setConfig('aspect', r); } }}>
                    {['Blog hero', 'LinkedIn post', 'Newsletter header', 'Instagram slide', 'Social concept'].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <span className="text-field-label">Style</span>
                  <select className="form-select w-full" value={style} onChange={e => setConfig('style', e.target.value)}>
                    {['Photography', 'Flat illustration', '3D render', 'Abstract', 'Editorial graphic'].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <span className="text-field-label">Image model</span>
                  <select className="form-select w-full" value={imageModel} onChange={e => setConfig('imageModel', e.target.value)}>
                    {IMAGE_MODEL_OPTIONS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <span className="text-field-label">Resolution</span>
                  <select className="form-select w-full" value={resolution} onChange={e => setConfig('resolution', e.target.value)}>
                    {IMAGE_RESOLUTION_OPTIONS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div style={{ height: 1, background: 'var(--color-border-subtle)' }} />

            {/* Prompt */}
            {editPrompt !== undefined && (
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-field-label">Prompt</span>
                  {promptChanged && <button className="btn-xs btn-ghost" style={{ color: 'var(--color-text-disabled)' }} onClick={() => setEditPrompt(origPrompt.current)}>Reset</button>}
                </div>
                <textarea value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)}
                  className="form-textarea" style={{ minHeight: 160, scrollbarWidth: 'thin' }}
                />
                <div className="flex justify-end" style={{ marginTop: 'var(--space-2)' }}>
                  {needsRegen && <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-accent)' }}>Regenerate to apply</span>}
                </div>
                <div style={{ borderTop: '1px solid var(--color-border-subtle)', marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {[
                    { label: 'Style', tags: ['cinematic', 'minimal', 'editorial', 'abstract', 'retro'] },
                    { label: 'Mood', tags: ['vibrant', 'moody', 'dreamy', 'warm', 'dark'] },
                  ].map(group => (
                    <div key={group.label}>
                      <span className="text-field-label">{group.label}</span>
                      <div className="flex flex-wrap gap-1">
                        {group.tags.map(s => {
                          const active = editPrompt.toLowerCase().includes(s);
                          return (
                            <button key={s}
                              onClick={() => setEditPrompt(p => active ? p.replace(new RegExp(`,?\\s*${s}`, 'gi'), '').trim() : `${p.trimEnd()}, ${s}`)}
                              style={{
                                fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', fontWeight: 500,
                                padding: '3px 10px', borderRadius: 'var(--radius-full)', cursor: 'pointer',
                                border: active ? '1px solid var(--color-accent)' : '1px solid var(--color-border-default)',
                                background: active ? 'var(--color-accent)' : 'transparent',
                                color: active ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                                transition: 'all 100ms',
                              }}>{s}</button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col shrink-0" style={{ padding: 'var(--space-4) var(--space-6) var(--space-5)', gap: 'var(--space-2)', borderTop: '1px solid var(--color-border-subtle)' }}>
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
              <button className="btn-sm btn-primary w-full" disabled={genLoading} onClick={generate4} style={{ position: 'relative', overflow: 'hidden' }}>
                {genLoading && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${variants.length * 25}%`, background: 'var(--color-overlay-light)', transition: 'width 300ms ease', borderRadius: 'inherit' }} />}
                <span style={{ position: 'relative' }}>{genLoading ? `Generating ${variants.length}/4…` : needsRegen ? 'Generate with changes' : variants.length ? 'Regenerate 4' : 'Generate 4 variants'}</span>
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
