import { useState, useRef, useEffect, useCallback } from 'react';
import { ModalShell, AiPopover } from './Modals';
import { NODE_ICONS } from '../../utils/nodeIcons';

interface ContentModalProps {
  subtype: string;
  title: string;
  text: string;
  onClose: () => void;
  onRegenerate?: () => void;
}

/* ── Icons ── */
const CopyIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
const CheckIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>;
const RegenIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>;

/* ── Standardized padding constants ── */
const HP = 'var(--space-5) var(--space-6) var(--space-4)';   // header: 20 24 16
const CP = 'var(--space-2) var(--space-6) 0';                // content: 8 24 0
const FP = 'var(--space-4) var(--space-6) var(--space-5)';   // footer: 16 24 20

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

/* ── Header: icon + title + subtitle ── */
function Header({ title, subtitle, subtype, onClose }: { title: string; subtitle?: string; subtype?: string; onClose: () => void }) {
  const icon = subtype ? NODE_ICONS[subtype] : null;
  return (
    <div className="flex items-center justify-between shrink-0" style={{ padding: HP }}>
      <div className="flex items-center gap-3">
        {icon && <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-md)', background: 'var(--color-bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)' }}>{icon()}</div>}
        <div>
          <div style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-md)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>{subtitle}</div>}
        </div>
      </div>
      <button aria-label="Close" onClick={onClose} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-md)', color: 'var(--color-text-tertiary)', transition: 'background 100ms' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>
  );
}

/* ── Footer: regenerate (loading), copy (icon), done ── */
function Footer({ onClose, onRegenerate, onCopy, copied }: { onClose: () => void; onRegenerate?: () => void; onCopy: () => void; copied: boolean }) {
  const [loading, setLoading] = useState(false);
  const regen = () => {
    if (!onRegenerate || loading) return;
    setLoading(true);
    onRegenerate();
    setTimeout(() => { setLoading(false); onClose(); }, 1600);
  };
  return (
    <div className="flex items-center justify-between shrink-0" style={{ padding: FP, borderTop: '1px solid var(--color-border-subtle)' }}>
      <div>
        {onRegenerate && (
          <button className="btn btn-outline" onClick={regen} disabled={loading}>
            <RegenIcon /> {loading ? 'Regenerating…' : 'Regenerate'}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button className="btn btn-sm btn-ghost" onClick={onCopy}>{copied ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}</button>
        <button className="btn btn-lg btn-primary" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

function useCopy(getText: () => string) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(getText()); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return { copied, copy };
}

/* ════════════════════════════════════════════
   TWITTER THREAD
   ════════════════════════════════════════════ */
function TwitterThreadModal({ title, text, onClose, onRegenerate, subtype }: ContentModalProps) {
  const parseTweets = (t: string) => t.split(/\n\n+/).filter(s => s.trim()).map(s => s.replace(/^\d+\/\s*/, ''));
  const [tweets, setTweets] = useState(() => parseTweets(text));
  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);

  const update = (i: number, val: string) => { const n = [...tweets]; n[i] = val; setTweets(n); };
  const remove = (i: number) => { if (tweets.length > 1) setTweets(tweets.filter((_, j) => j !== i)); };
  const add = () => setTweets([...tweets, '']);

  const totalChars = tweets.reduce((s, t) => s + t.length, 0);
  const { copied, copy } = useCopy(() => tweets.map((t, i) => `${i + 1}/ ${t}`).join('\n\n'));

  useEffect(() => { refs.current.forEach(el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }); }, [tweets]);

  return (
    <ModalShell onClose={onClose} maxWidth={560}>
      <Header title={title} subtitle={`${tweets.length} tweets · ${totalChars} chars`} subtype={subtype} onClose={onClose} />
      <div className="flex-1 overflow-y-auto" style={{ padding: CP, scrollbarWidth: 'thin' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {tweets.map((tweet, i) => {
            const len = tweet.length;
            const over = len > 280;
            return (
              <div key={i} style={{
                background: 'var(--color-bg-surface)',
                border: `1px solid ${over ? 'var(--color-danger-border)' : 'var(--color-border-subtle)'}`,
                borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)',
                transition: 'border-color 150ms',
              }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-2)' }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>{i + 1}/</span>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: over ? 'var(--color-danger)' : 'var(--color-text-disabled)' }}>{len}/280</span>
                    {tweets.length > 1 && (
                      <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-disabled)', padding: 4, display: 'flex', borderRadius: 'var(--radius-sm)', transition: 'color 100ms, background 100ms' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-danger)'; e.currentTarget.style.background = 'var(--color-danger-bg)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-disabled)'; e.currentTarget.style.background = 'none'; }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                      </button>
                    )}
                  </div>
                </div>
                <textarea ref={el => { refs.current[i] = el; }} value={tweet} onChange={e => update(i, e.target.value)}
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-loose)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', overflow: 'hidden' }} />
              </div>
            );
          })}
        </div>
        <button onClick={add} style={{ width: '100%', padding: 'var(--space-3)', margin: 'var(--space-3) 0', background: 'none', border: '1px dashed var(--color-border-default)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', transition: 'background 100ms' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
          + Add tweet
        </button>
      </div>
      <Footer onClose={onClose} onRegenerate={onRegenerate} onCopy={copy} copied={copied} />
    </ModalShell>
  );
}

/* ════════════════════════════════════════════
   LINKEDIN POST
   ════════════════════════════════════════════ */
function LinkedInModal({ title, text, onClose, onRegenerate, subtype }: ContentModalProps) {
  const [content, setContent] = useState(text);
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = useAutoResize(ref);
  const { copied, copy } = useCopy(() => content);
  const [aiPopover, setAiPopover] = useState<{ x: number; y: number; text: string } | null>(null);

  const onMouseUp = useCallback(() => {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    if (start === end || end - start < 3) { setAiPopover(null); return; }
    const taRect = ta.getBoundingClientRect();
    setAiPopover({ x: taRect.left + taRect.width / 2, y: taRect.top + (start / content.length) * taRect.height, text: content.slice(start, end) });
  }, [content]);

  const handleAiApply = useCallback((newText: string) => {
    const ta = ref.current;
    if (!ta || !aiPopover) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const updated = content.slice(0, start) + newText + content.slice(end);
    setContent(updated);
    setAiPopover(null);
    setTimeout(() => resize(), 0);
  }, [content, aiPopover, resize]);

  return (
    <ModalShell onClose={onClose} maxWidth={620}>
      <Header title={title} subtype={subtype} onClose={onClose} />
      <div className="flex-1 overflow-y-auto relative" style={{ padding: CP, paddingBottom: 'var(--space-4)', scrollbarWidth: 'thin' }}>
        {aiPopover && <AiPopover x={aiPopover.x} y={aiPopover.y} selectedText={aiPopover.text} onApply={handleAiApply} onClose={() => setAiPopover(null)} />}
        <textarea ref={ref} value={content} onChange={e => { setContent(e.target.value); resize(); }} onMouseUp={onMouseUp}
          style={{ width: '100%', minHeight: 200, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-loose)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', overflow: 'hidden' }} />
        {subtype === 'linkedin-post' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', margin: 'var(--space-4) 0' }}>
          <div style={{ flex: 1, borderTop: '1px dashed var(--color-border-subtle)' }} />
          <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)', whiteSpace: 'nowrap' }}>
            LinkedIn "see more" fold · ~210 chars
          </span>
          <div style={{ flex: 1, borderTop: '1px dashed var(--color-border-subtle)' }} />
        </div>
        )}
      </div>
      <Footer onClose={onClose} onRegenerate={onRegenerate} onCopy={copy} copied={copied} />
    </ModalShell>
  );
}

/* ════════════════════════════════════════════
   QUOTE CARD
   ════════════════════════════════════════════ */
function QuoteCardModal({ title, text, onClose, onRegenerate, subtype }: ContentModalProps) {
  const [quote, setQuote] = useState(text);
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = useAutoResize(ref);
  const { copied, copy } = useCopy(() => quote);

  return (
    <ModalShell onClose={onClose} maxWidth={520}>
      <Header title={title} subtype={subtype} onClose={onClose} />
      <div className="flex-1 flex items-center justify-center" style={{ padding: 'var(--space-4) var(--space-6)' }}>
        <div style={{ width: '100%', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)', textAlign: 'center', cursor: 'text' }}>
          <svg width="32" height="24" viewBox="0 0 32 24" fill="none" style={{ margin: '0 auto var(--space-4)', display: 'block', opacity: 0.2 }}>
            <path d="M0 24V14.4C0 6.4 4.8 1.6 14.4 0l1.6 4.8C10.4 6.4 8 9.6 8 14.4h6.4V24H0zm17.6 0V14.4C17.6 6.4 22.4 1.6 32 0l-1.6 4.8C24 6.4 25.6 9.6 25.6 14.4H32V24H17.6z" fill="var(--color-text-disabled)"/>
          </svg>
          <textarea ref={ref} value={quote} onChange={e => { setQuote(e.target.value); resize(); }}
            style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none', textAlign: 'center', cursor: 'text', fontSize: 'var(--text-lg)', lineHeight: 'var(--leading-snug)', fontFamily: 'var(--font-sans)', fontStyle: 'italic', color: 'var(--color-text-primary)', overflow: 'hidden' }} />
        </div>
      </div>
      <Footer onClose={onClose} onRegenerate={onRegenerate} onCopy={copy} copied={copied} />
    </ModalShell>
  );
}

/* ════════════════════════════════════════════
   NEWSLETTER
   ════════════════════════════════════════════ */
function NewsletterModal({ title, text, onClose, onRegenerate, subtype }: ContentModalProps) {
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
  const updateSection = (i: number, val: string) => { const n = [...sections]; n[i] = { ...n[i], text: val }; setSections(n); };
  const { copied, copy } = useCopy(() => (subject ? `Subject: ${subject}\n\n` : '') + sections.map(s => `## ${s.label}\n${s.text}`).join('\n\n---\n\n'));

  return (
    <ModalShell onClose={onClose} maxWidth={640}>
      <Header title={title} subtype={subtype} onClose={onClose} />
      <div className="flex-1 overflow-y-auto" style={{ padding: CP, scrollbarWidth: 'thin' }}>
        {/* Subject line — extra bottom gap to separate from sections */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <div className="text-field-label" style={{ marginBottom: 'var(--space-2)' }}>Subject line</div>
          <div style={{ position: 'relative' }}>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Keep under 50 chars for mobile"
              style={{ width: '100%', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', paddingRight: 48, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', outline: 'none', transition: 'border-color 150ms' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border-subtle)'; }} />
            <span style={{ position: 'absolute', right: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: subject.length > 60 ? 'var(--color-danger)' : 'var(--color-text-disabled)' }}>{subject.length}/60</span>
          </div>
        </div>

        {sections.map((sec, i) => (
          <div key={i} style={{ marginBottom: 'var(--space-4)' }}>
            <div className="text-field-label" style={{ marginBottom: 'var(--space-2)' }}>{sec.label}</div>
            <div style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', transition: 'border-color 150ms' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border-subtle)'; }}>
              <textarea value={sec.text} onChange={e => updateSection(i, e.target.value)}
                rows={Math.max(3, Math.ceil(sec.text.length / 60))}
                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-loose)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', overflow: 'hidden' }} />
            </div>
          </div>
        ))}
      </div>
      <Footer onClose={onClose} onRegenerate={onRegenerate} onCopy={copy} copied={copied} />
    </ModalShell>
  );
}

/* ════════════════════════════════════════════
   TWITTER SINGLE — no duplicate counter
   ════════════════════════════════════════════ */
function TwitterSingleModal({ title, text, onClose, onRegenerate, subtype }: ContentModalProps) {
  const [tweet, setTweet] = useState(text.replace(/^\d+\/\s*/, '').trim());
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = useAutoResize(ref);
  const len = tweet.length;
  const over = len > 280;
  const { copied, copy } = useCopy(() => tweet);

  return (
    <ModalShell onClose={onClose} maxWidth={520}>
      <Header title={title} subtitle={`${len}/280 characters`} subtype={subtype} onClose={onClose} />
      <div className="flex-1 overflow-y-auto" style={{ padding: CP, scrollbarWidth: 'thin' }}>
        <div style={{
          width: '100%', background: 'var(--color-bg-surface)',
          border: `1px solid ${over ? 'var(--color-danger-border)' : 'var(--color-border-subtle)'}`,
          borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)', transition: 'border-color 150ms',
        }}>
          <textarea ref={ref} value={tweet} onChange={e => { setTweet(e.target.value); resize(); }}
            style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 'var(--text-md)', lineHeight: 'var(--leading-loose)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', overflow: 'hidden' }} />
        </div>
      </div>
      <Footer onClose={onClose} onRegenerate={onRegenerate} onCopy={copy} copied={copied} />
    </ModalShell>
  );
}

/* ════════════════════════════════════════════
   GENERIC TEXT — with AI popover
   ════════════════════════════════════════════ */
function GenericTextModal({ title, text, onClose, onRegenerate, subtype }: ContentModalProps) {
  const [content, setContent] = useState(text);
  const [aiPopover, setAiPopover] = useState<{ x: number; y: number; text: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const resize = useAutoResize(textareaRef);
  const { copied, copy } = useCopy(() => content);

  const onMouseUp = useCallback(() => {
    const ta = textareaRef.current;
    const container = contentRef.current;
    if (!ta || !container) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    if (start === end || end - start < 3) { setAiPopover(null); return; }
    const taRect = ta.getBoundingClientRect();
    setAiPopover({ x: taRect.left + taRect.width / 2, y: taRect.top + (start / content.length) * taRect.height, text: content.slice(start, end) });
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
    <ModalShell onClose={onClose} maxWidth={720}>
      <Header title={title} subtype={subtype} onClose={onClose} />
      <div ref={contentRef} className="flex-1 overflow-y-auto relative" style={{ padding: CP, scrollbarWidth: 'thin' }}>
        {aiPopover && <AiPopover x={aiPopover.x} y={aiPopover.y} selectedText={aiPopover.text} onApply={handleAiApply} onClose={() => setAiPopover(null)} />}
        <textarea ref={textareaRef} value={content} onChange={e => { setContent(e.target.value); resize(); }} onMouseUp={onMouseUp}
          style={{ width: '100%', minHeight: 200, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-loose)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', overflow: 'hidden' }} />
      </div>
      <Footer onClose={onClose} onRegenerate={onRegenerate} onCopy={copy} copied={copied} />
    </ModalShell>
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
};

export default function ContentModal(props: ContentModalProps) {
  const Modal = MODAL_MAP[props.subtype] || GenericTextModal;
  return <Modal {...props} />;
}
