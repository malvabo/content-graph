import { useState, useRef, useEffect, useCallback } from 'react';
import { AiPopover } from './Modals';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

/* ── Measure viewport Y of selection start within a textarea ── */
function getSelectionY(ta: HTMLTextAreaElement, selStart: number): number {
  const mirror = document.createElement('div');
  const cs = getComputedStyle(ta);
  mirror.style.cssText = `position:absolute;visibility:hidden;white-space:pre-wrap;word-wrap:break-word;overflow:hidden;width:${ta.clientWidth}px;font:${cs.font};font-size:${cs.fontSize};font-family:${cs.fontFamily};line-height:${cs.lineHeight};padding:${cs.padding};border:${cs.border};letter-spacing:${cs.letterSpacing};`;
  mirror.textContent = ta.value.slice(0, selStart);
  document.body.appendChild(mirror);
  const h = mirror.scrollHeight;
  document.body.removeChild(mirror);
  const taRect = ta.getBoundingClientRect();
  return taRect.top + h - ta.scrollTop;
}

interface ContentModalProps {
  subtype: string;
  title: string;
  subtitle?: string;
  text: string;
  onClose: () => void;
  onRegenerate?: () => void;
  onSave?: (text: string) => void;
  onTitleChange?: (title: string) => void;
  extraActions?: { label: string; onClick: (text: string) => void }[];
}

/* ── Icons ── */
const CopyIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
const CheckIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>;
const RegenIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>;

/* ── Auto-resize textarea ── */
function useAutoResize(ref: React.RefObject<HTMLTextAreaElement | null>) {
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [ref]);
  useEffect(() => { resize(); }, [resize]);
  return resize;
}

function useCopy(getText: () => string) {
  const [copied, setCopied] = useState(false);
  const copy = () => { try { navigator.clipboard.writeText(getText()); } catch { /* clipboard unavailable */ } setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return { copied, copy };
}

/* ── ContentFooter: regen + copy footer used by most modals ── */
function ContentFooter({ onClose, onRegenerate, onCopy, copied }: { onClose: () => void; onRegenerate?: () => void; onCopy: () => void; copied: boolean }) {
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const regen = () => {
    if (!onRegenerate || loading) return;
    setLoading(true);
    onRegenerate();
    timerRef.current = setTimeout(() => { setLoading(false); onClose(); }, 1600);
  };
  useEffect(() => () => { clearTimeout(timerRef.current); }, []);
  return (
    <DialogFooter className="justify-between">
      <div>
        {onRegenerate && (
          <button className="btn btn-outline" onClick={regen} disabled={loading}>
            <RegenIcon /> {loading ? 'Regenerating…' : 'Regenerate'}
          </button>
        )}
      </div>
      <button className="btn btn-sm btn-ghost" onClick={onCopy}>{copied ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}</button>
    </DialogFooter>
  );
}

/* ════════════════════════════════════════════
   TWITTER THREAD
   ════════════════════════════════════════════ */
function TwitterThreadModal({ title, text, onClose, onSave, onRegenerate }: ContentModalProps) {
  const parseTweets = (t: string) => t.split(/\n\n+/).filter(s => s.trim()).map(s => s.replace(/^\d+\/\s*/, ''));
  const [tweets, setTweets] = useState(() => parseTweets(text));
  const [tweetIds] = useState(() => parseTweets(text).map(() => Math.random().toString(36).slice(2, 9)));
  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const dragIdx = useRef<number | null>(null);

  const update = (i: number, val: string) => { const n = [...tweets]; n[i] = val; setTweets(n); };
  const remove = (i: number) => { if (tweets.length > 1) { setTweets(tweets.filter((_, j) => j !== i)); tweetIds.splice(i, 1); } };
  const add = () => { setTweets([...tweets, '']); tweetIds.push(Math.random().toString(36).slice(2, 9)); };
  const onDragStart = (i: number) => { dragIdx.current = i; };
  const onDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === i) return;
    const n = [...tweets];
    const [moved] = n.splice(dragIdx.current, 1);
    n.splice(i, 0, moved);
    setTweets(n);
    dragIdx.current = i;
  };
  const onDragEnd = () => { dragIdx.current = null; };

  const { copied, copy } = useCopy(() => tweets.map((t, i) => `${i + 1}/ ${t}`).join('\n\n'));

  useEffect(() => { refs.current.forEach(el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }); }, [tweets]);

  const GripDots = () => (
    <svg width="7" height="11" viewBox="0 0 10 16" fill="var(--color-text-disabled)">
      <circle cx="2.5" cy="2" r="1"/><circle cx="7.5" cy="2" r="1"/>
      <circle cx="2.5" cy="8" r="1"/><circle cx="7.5" cy="8" r="1"/>
      <circle cx="2.5" cy="14" r="1"/><circle cx="7.5" cy="14" r="1"/>
    </svg>
  );

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent sheet maxWidth={560}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto" style={{ padding: 'var(--space-2) var(--space-6) var(--space-4)', scrollbarWidth: 'thin' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {tweets.map((tweet, i) => {
              const len = tweet.length;
              const over = len > 280;
              return (
                <div key={tweetIds[i]} draggable onDragStart={() => onDragStart(i)} onDragOver={e => onDragOver(e, i)} onDragEnd={onDragEnd}
                  style={{
                    background: 'var(--color-bg-card)',
                    border: `1px solid ${over ? 'var(--color-danger-border)' : 'var(--color-border-default)'}`,
                    borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                    transition: 'border-color 150ms, box-shadow 150ms',
                  }}>
                  {/* Header row: grip + remove */}
                  <div className="flex items-center" style={{ padding: 'var(--space-2) var(--space-3)', gap: 'var(--space-2)' }}>
                    <div style={{ cursor: 'grab', display: 'flex', alignItems: 'center', padding: '2px 0', flexShrink: 0 }}
                      onMouseEnter={e => { e.currentTarget.querySelector('svg')!.setAttribute('fill', 'var(--color-text-secondary)'); }}
                      onMouseLeave={e => { e.currentTarget.querySelector('svg')!.setAttribute('fill', 'var(--color-text-disabled)'); }}><GripDots /></div>
                    <span style={{ flex: 1 }} />
                    {tweets.length > 1 && (
                      <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-disabled)', padding: 2, display: 'flex', borderRadius: 'var(--radius-sm)', transition: 'color 100ms' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-danger-text)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-disabled)'; }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                      </button>
                    )}
                  </div>
                  {/* Textarea + char count below */}
                  <div style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                    <textarea ref={el => { refs.current[i] = el; }} value={tweet} onChange={e => update(i, e.target.value)} aria-label={`Tweet ${i + 1} content`}
                      style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-snug)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', overflow: 'hidden', padding: 'var(--space-3) var(--space-4) 0' }} />
                    <div style={{ textAlign: 'right', padding: '0 var(--space-4) var(--space-2)' }}>
                      <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: over ? 'var(--color-danger)' : 'var(--color-text-disabled)' }}>{len}/280</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={add} style={{ width: '100%', padding: 'var(--space-2)', margin: 'var(--space-2) 0', background: 'none', border: '1px dashed var(--color-border-default)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', transition: 'background 100ms' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
            + Add tweet
          </button>
        </div>
        <ContentFooter onClose={onClose} onRegenerate={onRegenerate} onCopy={copy} copied={copied} />
      </DialogContent>
    </Dialog>
  );
}

/* ════════════════════════════════════════════
   LINKEDIN POST
   ════════════════════════════════════════════ */
function LinkedInModal({ title, text, onClose, onSave, onRegenerate }: ContentModalProps) {
  const [content, setContent] = useState(text);
  const { copied, copy } = useCopy(() => content);
  const [aiPopover, setAiPopover] = useState<{ x: number; y: number; text: string } | null>(null);

  const onMouseUp = useCallback(() => {
    const ta = document.activeElement as HTMLTextAreaElement;
    if (!ta || ta.tagName !== 'TEXTAREA') return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    if (start === end || end - start < 3) { setAiPopover(null); return; }
    const taRect = ta.getBoundingClientRect();
    const y = getSelectionY(ta, start);
    setAiPopover({ x: taRect.left + taRect.width / 2, y, text: ta.value.slice(start, end) });
  }, []);

  const handleAiApply = useCallback((newText: string) => {
    const ta = document.activeElement as HTMLTextAreaElement;
    if (!ta || ta.tagName !== 'TEXTAREA' || !aiPopover) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const updated = ta.value.slice(0, start) + newText + ta.value.slice(end);
    // Reconstruct full content based on which textarea is active
    setContent(prev => prev.replace(ta.value, updated));
    setAiPopover(null);
  }, [aiPopover]);

  // Find the split point: last space before char 210
  const FOLD = 210;
  const splitAt = content.length > FOLD ? (content.lastIndexOf(' ', FOLD) > 0 ? content.lastIndexOf(' ', FOLD) : FOLD) : -1;
  const aboveFold = splitAt > 0 ? content.slice(0, splitAt) : content;
  const belowFold = splitAt > 0 ? content.slice(splitAt) : '';

  const aboveRef = useRef<HTMLTextAreaElement>(null);
  const belowRef = useRef<HTMLTextAreaElement>(null);
  const resizeAbove = useAutoResize(aboveRef);
  const resizeBelow = useAutoResize(belowRef);

  const updateAbove = (val: string) => { setContent(val + belowFold); setTimeout(resizeAbove, 0); };
  const updateBelow = (val: string) => { setContent(aboveFold + val); setTimeout(resizeBelow, 0); };

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent sheet maxWidth={620}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto relative" style={{ padding: 'var(--space-2) var(--space-6) var(--space-4)', scrollbarWidth: 'thin' }}>
          {aiPopover && <AiPopover x={aiPopover.x} y={aiPopover.y} selectedText={aiPopover.text} onApply={handleAiApply} onClose={() => setAiPopover(null)} />}

          {/* Above fold */}
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: splitAt > 0 ? 'var(--radius-lg) var(--radius-lg) 0 0' : 'var(--radius-lg)', transition: 'border-color 150ms' }}>
            <textarea ref={aboveRef} value={aboveFold} onChange={e => updateAbove(e.target.value)} onMouseUp={onMouseUp}
              style={{ width: '100%', minHeight: 80, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-normal)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', overflow: 'hidden', padding: 'var(--space-2) var(--space-3)' }} />
          </div>

          {/* Fold indicator */}
          {splitAt > 0 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)', borderTop: 'none', borderBottom: 'none', padding: 'var(--space-2) var(--space-3)' }}>
                <div style={{ flex: 1, height: 1, borderTop: '1px dashed var(--color-border-default)' }} />
                <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)', whiteSpace: 'nowrap', padding: '0 var(--space-2)' }}>
                  … see more
                </span>
                <div style={{ flex: 1, height: 1, borderTop: '1px dashed var(--color-border-default)' }} />
              </div>

              {/* Below fold */}
              <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderTop: 'none', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)', padding: 'var(--space-3)', opacity: 0.75 }}>
                <textarea ref={belowRef} value={belowFold} onChange={e => updateBelow(e.target.value)} onMouseUp={onMouseUp}
                  style={{ width: '100%', minHeight: 40, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-normal)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', overflow: 'hidden', padding: 'var(--space-2) var(--space-3)' }} />
              </div>
            </>
          ) : (
            <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-accent)', marginTop: 'var(--space-2)', textAlign: 'center' }}>
              ✓ Entire post visible without "see more"
            </div>
          )}
        </div>
        <ContentFooter onClose={onClose} onRegenerate={onRegenerate} onCopy={copy} copied={copied} />
      </DialogContent>
    </Dialog>
  );
}

/* ════════════════════════════════════════════
   QUOTE CARD
   ════════════════════════════════════════════ */
function QuoteCardModal({ title, text, onClose, onSave, onRegenerate }: ContentModalProps) {
  const [quote, setQuote] = useState(text.replace(/\*\*/g, '').replace(/^QUOTE:\s*/i, '').replace(/\nATTRIBUTION:.*$/ms, '').trim());
  const ref = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const resize = useAutoResize(ref);
  const { copied, copy } = useCopy(() => quote);

  const downloadImage = async () => {
    if (!cardRef.current) return;
    const { toPng } = await import('html-to-image');
    const url = await toPng(cardRef.current, { pixelRatio: 3 });
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quote-card.png';
    a.click();
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent sheet maxWidth={520}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto" style={{ padding: 'var(--space-2) var(--space-6) var(--space-4)', scrollbarWidth: 'thin' }}>
          <div className="flex items-center justify-center" style={{ padding: 'var(--space-4) 0' }}>
            <div ref={cardRef} style={{ width: '100%', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)', textAlign: 'center', cursor: 'text' }}>
              <svg width="32" height="24" viewBox="0 0 32 24" fill="none" style={{ margin: '0 auto var(--space-4)', display: 'block', opacity: 0.2 }}>
                <path d="M0 24V14.4C0 6.4 4.8 1.6 14.4 0l1.6 4.8C10.4 6.4 8 9.6 8 14.4h6.4V24H0zm17.6 0V14.4C17.6 6.4 22.4 1.6 32 0l-1.6 4.8C24 6.4 25.6 9.6 25.6 14.4H32V24H17.6z" fill="var(--color-text-disabled)"/>
              </svg>
              <textarea ref={ref} value={quote} onChange={e => { setQuote(e.target.value); resize(); }} aria-label="Quote text"
                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none', textAlign: 'center', cursor: 'text', fontSize: 'var(--text-lg)', lineHeight: 'var(--leading-snug)', fontFamily: 'var(--font-sans)', fontStyle: 'italic', color: 'var(--color-text-primary)', overflow: 'hidden', padding: 'var(--space-2) var(--space-3)' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 'var(--space-3)' }}>
            <button className="btn-sm btn-ghost" onClick={downloadImage} style={{ fontSize: 'var(--text-xs)' }}>
              ↓ Download as image
            </button>
          </div>
        </div>
        <ContentFooter onClose={onClose} onRegenerate={onRegenerate} onCopy={copy} copied={copied} />
      </DialogContent>
    </Dialog>
  );
}

/* ════════════════════════════════════════════
   NEWSLETTER
   ════════════════════════════════════════════ */
function NewsletterModal({ title, text, onClose, onSave, onRegenerate }: ContentModalProps) {
  const parseSections = (t: string) => {
    const parts = t.split(/\n---\n|\n##\s+/);
    if (parts.length <= 1) return [{ label: 'Content', text: t }];
    return parts.filter(Boolean).map((p, i) => {
      const lines = p.trim().split('\n');
      const label = i === 0 ? 'Intro' : lines[0]?.length < 40 ? lines.shift()! : `Section ${i}`;
      return { label, text: lines.join('\n').trim() };
    });
  };

  const [subject, setSubject] = useState('');
  const [sections, setSections] = useState(() => parseSections(text));
  const sectionRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const updateSection = (i: number, val: string) => { const n = [...sections]; n[i] = { ...n[i], text: val }; setSections(n); };
  const { copied, copy } = useCopy(() => (subject ? `Subject: ${subject}\n\n` : '') + sections.map(s => `## ${s.label}\n${s.text}`).join('\n\n---\n\n'));

  // Auto-resize all section textareas
  useEffect(() => {
    sectionRefs.current.forEach(el => {
      if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
    });
  }, [sections]);

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent sheet maxWidth={640}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto" style={{ padding: 'var(--space-2) var(--space-6) var(--space-4)', scrollbarWidth: 'thin' }}>
          {/* Subject line */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <div className="text-field-label" style={{ marginBottom: 'var(--space-2)' }}>Subject line</div>
            <div style={{ position: 'relative' }}>
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Keep under 50 chars for mobile"
                className="form-input" style={{ paddingRight: 48 }} />
              <span style={{ position: 'absolute', right: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: subject.length > 60 ? 'var(--color-danger)' : 'var(--color-text-disabled)' }}>{subject.length}/60</span>
            </div>
          </div>

          {sections.map((sec, i) => (
            <div key={i} style={{ marginBottom: 'var(--space-4)' }}>
              <div className="text-field-label" style={{ marginBottom: 'var(--space-2)' }}>{sec.label}</div>
              <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', transition: 'border-color 150ms' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border-subtle)'; }}>
                <textarea ref={el => { sectionRefs.current[i] = el; }} value={sec.text} onChange={e => updateSection(i, e.target.value)} aria-label={sec.label}
                  style={{ width: '100%', minHeight: 60, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-normal)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', overflow: 'hidden', padding: 'var(--space-2) var(--space-3)' }} />
              </div>
            </div>
          ))}
        </div>
        <ContentFooter onClose={onClose} onRegenerate={onRegenerate} onCopy={copy} copied={copied} />
      </DialogContent>
    </Dialog>
  );
}

/* ════════════════════════════════════════════
   VOICE — editable title, extraActions footer
   ════════════════════════════════════════════ */
function VoiceModal({ title, text, onClose, onSave, onTitleChange, extraActions }: ContentModalProps) {
  const [editTitle, setEditTitle] = useState(title);
  const [content, setContent] = useState(text);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  }, [content]);

  const commitTitle = () => {
    const t = editTitle.trim();
    if (!t || t === title) return;
    onTitleChange?.(t);
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) { commitTitle(); onClose(); } }}>
      <DialogContent sheet maxWidth={720}>
        <DialogHeader className="border-b border-[var(--color-border-subtle)]">
          <input
            aria-label="Note title"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-md)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', background: 'none', border: 'none', outline: 'none', flex: 1, minWidth: 0, padding: 0, letterSpacing: '-0.01em' }}
          />
        </DialogHeader>

        <div className="flex-1 overflow-y-auto" style={{ padding: 'var(--space-2) var(--space-6) var(--space-4)', scrollbarWidth: 'thin' }}>
          <textarea
            ref={ref}
            value={content}
            onChange={e => setContent(e.target.value)}
            className="form-textarea"
            style={{ minHeight: 360, resize: 'none', overflow: 'hidden', lineHeight: 'var(--leading-normal)' }}
          />
        </div>

        {extraActions && extraActions.length > 0 && (
          <DialogFooter>
            {extraActions.map((a, i) => (
              <Button key={a.label} variant={i === 0 ? 'secondary' : 'green'}
                onClick={() => { onSave?.(content); a.onClick(content); commitTitle(); onClose(); }}>
                {a.label}
              </Button>
            ))}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ════════════════════════════════════════════
   TWITTER SINGLE — no duplicate counter
   ════════════════════════════════════════════ */
function TwitterSingleModal({ title, text, onClose, onSave, onRegenerate }: ContentModalProps) {
  const [tweet, setTweet] = useState(text.replace(/^\d+\/\s*/, '').trim());
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = useAutoResize(ref);
  const len = tweet.length;
  const over = len > 280;
  const { copied, copy } = useCopy(() => tweet);

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent sheet maxWidth={520}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{len}/280 characters</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto" style={{ padding: 'var(--space-2) var(--space-6) var(--space-4)', scrollbarWidth: 'thin' }}>
          <div style={{
            width: '100%', background: 'var(--color-bg-card)',
            border: `1px solid ${over ? 'var(--color-danger-border)' : 'var(--color-border-default)'}`,
            borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)', transition: 'border-color 150ms',
          }}>
            <textarea ref={ref} value={tweet} onChange={e => { setTweet(e.target.value); resize(); }}
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 'var(--text-md)', lineHeight: 'var(--leading-normal)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', overflow: 'hidden', padding: 'var(--space-2) var(--space-3)' }} />
          </div>
        </div>
        <ContentFooter onClose={onClose} onRegenerate={onRegenerate} onCopy={copy} copied={copied} />
      </DialogContent>
    </Dialog>
  );
}

/* ════════════════════════════════════════════
   GENERIC TEXT — with AI popover
   ════════════════════════════════════════════ */
function GenericTextModal({ title, text, onClose, onSave, onRegenerate }: ContentModalProps) {
  const [content, setContent] = useState(text);
  const [aiPopover, setAiPopover] = useState<{ x: number; y: number; text: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resize = useAutoResize(textareaRef);
  const { copied, copy } = useCopy(() => content);

  const onMouseUp = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    if (start === end || end - start < 3) { setAiPopover(null); return; }
    const taRect = ta.getBoundingClientRect();
    const y = getSelectionY(ta, start);
    setAiPopover({ x: taRect.left + taRect.width / 2, y, text: content.slice(start, end) });
  }, [content]);

  const handleAiApply = useCallback((newText: string) => {
    const ta = textareaRef.current;
    if (!ta || !aiPopover) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const updated = content.slice(0, start) + newText + content.slice(end);
    setContent(updated);
    setAiPopover(null);
  }, [content, aiPopover]);

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent sheet maxWidth={720}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto relative" style={{ padding: 'var(--space-2) var(--space-6) var(--space-4)', scrollbarWidth: 'thin' }}>
          {aiPopover && <AiPopover x={aiPopover.x} y={aiPopover.y} selectedText={aiPopover.text} onApply={handleAiApply} onClose={() => setAiPopover(null)} />}
          <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', transition: 'border-color 150ms' }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border-subtle)'; }}>
            <textarea ref={textareaRef} value={content} onChange={e => { setContent(e.target.value); resize(); }} onMouseUp={onMouseUp}
              style={{ width: '100%', minHeight: 200, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-normal)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', overflow: 'hidden', padding: 'var(--space-2) var(--space-3)' }} />
          </div>
        </div>
        <ContentFooter onClose={onClose} onRegenerate={onRegenerate} onCopy={copy} copied={copied} />
      </DialogContent>
    </Dialog>
  );
}

/* ════════════════════════════════════════════
   ROUTER
   ════════════════════════════════════════════ */
const MODAL_MAP: Record<string, React.FC<ContentModalProps>> = {
  'twitter-thread': TwitterThreadModal,
  'twitter-single': TwitterSingleModal,
  'linkedin-post': LinkedInModal,
  'quote-card': QuoteCardModal,
  'newsletter': NewsletterModal,
  'voice-source': VoiceModal,
  'brand-voice': VoiceModal,
};

export default function ContentModal(props: ContentModalProps) {
  const Modal = MODAL_MAP[props.subtype] || GenericTextModal;
  return <Modal {...props} />;
}
