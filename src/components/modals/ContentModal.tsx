import { useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ModalShell, ModalHeader, AiPopover } from './Modals';

/* ── Shared types ── */
interface ContentModalProps {
  subtype: string;
  title: string;
  text: string;
  onClose: () => void;
  onRegenerate?: () => void;
}

/* ── Shared footer ── */
function Footer({ onClose, onRegenerate, onCopy, copied }: { onClose: () => void; onRegenerate?: () => void; onCopy: () => void; copied: boolean }) {
  return (
    <div className="flex items-center justify-between shrink-0" style={{ padding: 'var(--space-4) var(--space-6) var(--space-5)', borderTop: '1px solid var(--color-border-subtle)' }}>
      <div>
        {onRegenerate && (
          <button className="btn btn-outline" onClick={() => { onRegenerate(); onClose(); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            Regenerate
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button className="btn btn-ghost" onClick={onCopy}>{copied ? '✓ Copied' : 'Copy'}</button>
        <button className="btn btn-lg btn-primary" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

/* ── Shared header ── */
function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between shrink-0" style={{ padding: 'var(--space-5) var(--space-6) var(--space-3)' }}>
      <div style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-md)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>{title}</div>
      <button aria-label="Close" onClick={onClose} className="btn-icon-sm btn-ghost" style={{ color: 'var(--color-text-tertiary)', borderRadius: 'var(--radius-md)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>
  );
}

function useCopy(getText: () => string) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(getText()); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return { copied, copy };
}

/* ════════════════════════════════════════════
   TWITTER THREAD — per-tweet cards
   ════════════════════════════════════════════ */
function TwitterThreadModal({ title, text, onClose, onRegenerate }: ContentModalProps) {
  const parseTweets = (t: string) => t.split(/\n\n+/).filter(s => s.trim()).map(s => s.replace(/^\d+\/\s*/, ''));
  const [tweets, setTweets] = useState(() => parseTweets(text));

  const update = (i: number, val: string) => { const n = [...tweets]; n[i] = val; setTweets(n); };
  const remove = (i: number) => { if (tweets.length > 1) setTweets(tweets.filter((_, j) => j !== i)); };
  const add = () => setTweets([...tweets, '']);

  const { copied, copy } = useCopy(() => tweets.map((t, i) => `${i + 1}/ ${t}`).join('\n\n'));

  return (
    <ModalShell onClose={onClose} maxWidth={560}>
      <Header title={title} onClose={onClose} />
      <div className="flex-1 overflow-y-auto" style={{ padding: '0 var(--space-6)', scrollbarWidth: 'thin' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {tweets.map((tweet, i) => {
            const len = tweet.length;
            const over = len > 280;
            return (
              <div key={i} style={{
                background: 'var(--color-bg-surface)',
                border: `1px solid ${over ? 'var(--color-danger-border)' : 'var(--color-border-subtle)'}`,
                borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)',
              }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-2)' }}>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>{i + 1}/</span>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: over ? 'var(--color-danger)' : 'var(--color-text-disabled)' }}>{len}/280</span>
                    {tweets.length > 1 && (
                      <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-disabled)', padding: 2, display: 'flex' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                      </button>
                    )}
                  </div>
                </div>
                <textarea value={tweet} onChange={e => update(i, e.target.value)}
                  rows={Math.max(2, Math.ceil(tweet.length / 50))}
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-loose)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }} />
              </div>
            );
          })}
        </div>
        <button onClick={add} style={{ width: '100%', padding: 'var(--space-3)', marginTop: 'var(--space-3)', marginBottom: 'var(--space-4)', background: 'none', border: '1px dashed var(--color-border-subtle)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>
          + Add tweet
        </button>
      </div>
      <Footer onClose={onClose} onRegenerate={onRegenerate} onCopy={copy} copied={copied} />
    </ModalShell>
  );
}

/* ════════════════════════════════════════════
   LINKEDIN POST — fold line at ~210 chars
   ════════════════════════════════════════════ */
function LinkedInModal({ title, text, onClose, onRegenerate }: ContentModalProps) {
  const [content, setContent] = useState(text);
  const { copied, copy } = useCopy(() => content);
  const FOLD = 210;
  const hookLen = Math.min(content.length, FOLD);
  const words = content.trim().split(/\s+/).length;

  return (
    <ModalShell onClose={onClose} maxWidth={620}>
      <Header title={title} onClose={onClose} />
      <div className="flex-1 overflow-y-auto" style={{ padding: '0 var(--space-6)', scrollbarWidth: 'thin' }}>
        <div style={{ position: 'relative' }}>
          <textarea value={content} onChange={e => setContent(e.target.value)}
            style={{ width: '100%', minHeight: 360, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-loose)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }} />
        </div>
        {/* Fold indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', margin: 'var(--space-2) 0 var(--space-4)' }}>
          <div style={{ flex: 1, borderTop: '1px dashed var(--color-border-subtle)' }} />
          <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)', whiteSpace: 'nowrap' }}>
            "see more" fold · {hookLen} chars
          </span>
          <div style={{ flex: 1, borderTop: '1px dashed var(--color-border-subtle)' }} />
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)' }}>{words} words</span>
        </div>
      </div>
      <Footer onClose={onClose} onRegenerate={onRegenerate} onCopy={copy} copied={copied} />
    </ModalShell>
  );
}

/* ════════════════════════════════════════════
   QUOTE CARD — centered visual quote
   ════════════════════════════════════════════ */
function QuoteCardModal({ title, text, onClose, onRegenerate }: ContentModalProps) {
  const [quote, setQuote] = useState(text);
  const { copied, copy } = useCopy(() => quote);

  return (
    <ModalShell onClose={onClose} maxWidth={520}>
      <Header title={title} onClose={onClose} />
      <div className="flex-1 flex items-center justify-center" style={{ padding: 'var(--space-6)' }}>
        <div style={{
          width: '100%', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-8)', textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, lineHeight: 1, color: 'var(--color-text-disabled)', marginBottom: 'var(--space-2)' }}>"</div>
          <textarea value={quote} onChange={e => setQuote(e.target.value)}
            style={{
              width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none', textAlign: 'center',
              fontSize: 'var(--text-lg)', lineHeight: 'var(--leading-snug)', fontFamily: 'var(--font-sans)',
              fontStyle: 'italic', color: 'var(--color-text-primary)',
            }} />
        </div>
      </div>
      <Footer onClose={onClose} onRegenerate={onRegenerate} onCopy={copy} copied={copied} />
    </ModalShell>
  );
}

/* ════════════════════════════════════════════
   NEWSLETTER — section blocks + subject line
   ════════════════════════════════════════════ */
function NewsletterModal({ title, text, onClose, onRegenerate }: ContentModalProps) {
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
      <Header title={title} onClose={onClose} />
      <div className="flex-1 overflow-y-auto" style={{ padding: '0 var(--space-6)', scrollbarWidth: 'thin' }}>
        {/* Subject line */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div className="text-label" style={{ marginBottom: 'var(--space-2)' }}>Subject line</div>
          <div style={{ position: 'relative' }}>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Enter subject line…"
              style={{ width: '100%', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', outline: 'none' }} />
            <span style={{ position: 'absolute', right: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: subject.length > 60 ? 'var(--color-danger)' : 'var(--color-text-disabled)' }}>{subject.length}/60</span>
          </div>
        </div>

        {/* Section blocks */}
        {sections.map((sec, i) => (
          <div key={i} style={{ marginBottom: 'var(--space-4)' }}>
            <div className="text-label" style={{ marginBottom: 'var(--space-2)' }}>{sec.label}</div>
            <div style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
              <textarea value={sec.text} onChange={e => updateSection(i, e.target.value)}
                rows={Math.max(3, Math.ceil(sec.text.length / 60))}
                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-loose)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }} />
            </div>
          </div>
        ))}
      </div>
      <Footer onClose={onClose} onRegenerate={onRegenerate} onCopy={copy} copied={copied} />
    </ModalShell>
  );
}

/* ════════════════════════════════════════════
   TWITTER SINGLE — large card + char counter
   ════════════════════════════════════════════ */
function TwitterSingleModal({ title, text, onClose, onRegenerate }: ContentModalProps) {
  const [tweet, setTweet] = useState(text.replace(/^\d+\/\s*/, '').trim());
  const len = tweet.length;
  const over = len > 280;
  const { copied, copy } = useCopy(() => tweet);

  return (
    <ModalShell onClose={onClose} maxWidth={520}>
      <Header title={title} onClose={onClose} />
      <div className="flex-1 flex items-center justify-center" style={{ padding: 'var(--space-6)' }}>
        <div style={{
          width: '100%', background: 'var(--color-bg-surface)',
          border: `1px solid ${over ? 'var(--color-danger-border)' : 'var(--color-border-subtle)'}`,
          borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)', minHeight: 160,
          display: 'flex', flexDirection: 'column',
        }}>
          <textarea value={tweet} onChange={e => setTweet(e.target.value)}
            style={{ flex: 1, width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 'var(--text-md)', lineHeight: 'var(--leading-loose)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }} />
          <div style={{ textAlign: 'right', marginTop: 'var(--space-2)' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: over ? 'var(--color-danger)' : 'var(--color-text-disabled)' }}>{len}/280</span>
          </div>
        </div>
      </div>
      <Footer onClose={onClose} onRegenerate={onRegenerate} onCopy={copy} copied={copied} />
    </ModalShell>
  );
}

/* ════════════════════════════════════════════
   GENERIC TEXT — fallback (infographic, refine, etc.)
   ════════════════════════════════════════════ */
function GenericTextModal({ title, text, onClose, onRegenerate }: ContentModalProps) {
  const [content, setContent] = useState(text);
  const { copied, copy } = useCopy(() => content);

  return (
    <ModalShell onClose={onClose} maxWidth={720}>
      <Header title={title} onClose={onClose} />
      <div className="flex-1 overflow-y-auto" style={{ padding: '0 var(--space-6)', scrollbarWidth: 'thin' }}>
        <textarea value={content} onChange={e => setContent(e.target.value)}
          style={{ width: '100%', minHeight: 320, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-loose)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }} />
      </div>
      <Footer onClose={onClose} onRegenerate={onRegenerate} onCopy={copy} copied={copied} />
    </ModalShell>
  );
}

/* ════════════════════════════════════════════
   CONTENT MODAL ROUTER
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
