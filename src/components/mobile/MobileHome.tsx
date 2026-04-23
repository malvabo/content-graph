import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useVoiceStore, type VoiceNote } from '../../store/voiceStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { aiExecute } from '../../utils/aiExecutor';
import RecordButton from '../canvas/RecordButton';

type AssetKind = 'linkedin-post' | 'twitter-thread' | 'twitter-single';

interface Generation {
  kind: AssetKind;
  text: string;
  loading: boolean;
  error?: string;
}

const KIND_LABEL: Record<AssetKind, string> = {
  'linkedin-post': 'LinkedIn post',
  'twitter-thread': 'Twitter thread',
  'twitter-single': 'Twitter single',
};

/** Groq Whisper fallback when live Web Speech produced no transcript. */
async function transcribeWithGroq(blob: Blob, apiKey: string): Promise<string> {
  const form = new FormData();
  form.append('file', blob, 'recording.webm');
  form.append('model', 'whisper-large-v3');
  form.append('response_format', 'json');
  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form,
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  return (data.text || '').trim();
}

function pickMimeType(): string | undefined {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  const MR: any = (window as any).MediaRecorder;
  if (!MR?.isTypeSupported) return undefined;
  return types.find(t => MR.isTypeSupported(t));
}

const fmtDuration = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
};

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

function RecordingOverlay({ onStop, onCancel, startTime, liveText }: { onStop: () => void; onCancel: () => void; startTime: number; liveText: string }) {
  const [elapsed, setElapsed] = useState(0);
  // Track liveText at last render so newly-mounted word spans animate in
  const prevLiveTextRef = useRef('');
  const prevWords = prevLiveTextRef.current.trim().split(/\s+/).filter(Boolean);
  const prevCount = prevWords.length;

  useEffect(() => {
    const iv = setInterval(() => setElapsed(Date.now() - startTime), 200);
    return () => clearInterval(iv);
  }, [startTime]);

  // Update after each render so prevCount reflects the last committed liveText
  useEffect(() => { prevLiveTextRef.current = liveText; }, [liveText]);

  const mm = String(Math.floor(elapsed / 60000)).padStart(2, '0');
  const ss = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0');
  const words = liveText.trim().split(/\s+/).filter(Boolean);
  const hasText = words.length > 0;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', background: '#0f0a1e' }}>
      <style>{`
        @keyframes word-in {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ro-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          .ro-ring { animation: none !important; }
        }
      `}</style>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8) var(--space-6)', gap: 'var(--space-6)' }}>
        {/* Timer */}
        <div style={{ fontSize: 64, fontWeight: 200, fontFamily: 'var(--font-sans)', color: 'rgba(255,255,255,0.92)', letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
          {mm}:{ss}
        </div>

        {/* Word-by-word transcript */}
        <div aria-live="polite" style={{ width: '100%', maxWidth: 380, minHeight: 96, display: 'flex', flexWrap: 'wrap', gap: '0.35em', alignContent: 'flex-start', justifyContent: 'center' }}>
          {hasText ? words.map((word, i) => (
            <span key={i} style={{
              fontFamily: 'var(--font-sans)', fontSize: 18, fontWeight: 400, lineHeight: 1.6,
              color: i < prevCount ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.92)',
              animation: i >= prevCount ? 'word-in 240ms ease forwards' : 'none',
            }}>
              {word}
            </span>
          )) : (
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 400, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>
              Listening…
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div style={{ padding: 'var(--space-6)', paddingBottom: 'calc(var(--space-6) + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        {/* Stop — mirrors RecordButton ring style */}
        <button onClick={onStop} aria-label="Stop and save"
          style={{ width: 72, height: 72, borderRadius: '50%', border: 'none', background: 'transparent', padding: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="ro-ring" style={{ position: 'absolute', inset: 0, borderRadius: '50%', padding: 3, background: 'conic-gradient(from 0deg, #f472b6, #7a5af8, #60a5fa, #f472b6)', WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)', WebkitMaskComposite: 'xor', mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)', maskComposite: 'exclude', animation: 'ro-spin 2.4s linear infinite' }} />
          <span style={{ position: 'absolute', inset: 5, borderRadius: '50%', background: 'linear-gradient(145deg, #2a1f4a 0%, #1a1130 100%)' }} />
          <svg width="22" height="22" viewBox="0 0 24 24" fill="rgba(255,255,255,0.9)" style={{ position: 'relative', zIndex: 1 }}>
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        </button>
        <button onClick={onCancel}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', padding: 'var(--space-2) var(--space-4)' }}>
          Discard
        </button>
      </div>
    </div>,
    document.body,
  );
}

function NoteCard({ note, onOpen }: { note: VoiceNote; onOpen: () => void }) {
  const isTranscribing = note.status === 'transcribing';
  const isAudioOnly = note.status === 'ready' && !note.transcript;
  const isError = note.status === 'error';

  type PillRole = 'complete' | 'running' | 'idle' | 'error';
  const pillRoleMap: Record<PillRole, { bg: string; border: string; fg: string }> = {
    complete: { bg: 'var(--color-success-bg, #e6f9e6)', border: '#E0DCD6', fg: 'var(--color-success-text, #1a7f1a)' },
    running:  { bg: 'var(--color-warning-bg, #FEF8E8)', border: 'var(--color-warning-border, #F0D8A0)', fg: 'var(--color-warning-text, #6A4A10)' },
    idle:     { bg: 'var(--color-bg-surface)', border: 'transparent', fg: 'var(--color-text-tertiary)' },
    error:    { bg: 'var(--color-danger-bg, #FEF4F4)', border: '#ECC0C0', fg: 'var(--color-danger-text, #A83030)' },
  };
  // Left-border colour encodes state — single indicator replaces dot + pill-dot pair
  const borderAccentMap: Record<PillRole, string> = {
    complete: 'var(--color-accent, #0DBF5A)',
    running:  '#F0D8A0',
    idle:     'var(--color-border-default)',
    error:    'var(--color-danger, #C93030)',
  };

  const pill = isTranscribing ? { role: 'running' as PillRole, label: 'Transcribing' }
    : isError ? { role: 'error' as PillRole, label: 'Failed' }
    : isAudioOnly ? { role: 'idle' as PillRole, label: 'Audio only' }
    : note.lastGeneration ? { role: 'complete' as PillRole, label: KIND_LABEL[note.lastGeneration.kind].split(' ')[0] }
    : null;

  const statusBorder = borderAccentMap[pill?.role ?? 'idle'];
  const displayTitle = isAudioOnly && note.title === 'Untitled note' ? 'Audio recording' : note.title;
  const meta = `${fmtDuration(note.durationMs)} · ${fmtDate(note.createdAt)}`;
  const ariaLabel = `${displayTitle}. ${meta}${pill ? '. Status: ' + pill.label : ''}. Open.`;

  return (
    <button
      onClick={onOpen}
      disabled={isTranscribing}
      aria-label={ariaLabel}
      className="voice-note-card"
      style={{
        width: '100%', textAlign: 'left', background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)',
        // Inset left shadow acts as a 3px status stripe without affecting layout
        boxShadow: `inset 3px 0 0 ${statusBorder}`,
        padding: 'var(--space-3) var(--space-4)', display: 'grid',
        gridTemplateColumns: '1fr auto', alignItems: 'center',
        columnGap: 'var(--space-3)', rowGap: 2, minHeight: 64,
        cursor: isTranscribing ? 'default' : 'pointer',
        opacity: isTranscribing ? 0.7 : 1, minWidth: 0, boxSizing: 'border-box',
        transition: 'border-color 100ms, background 100ms, box-shadow 150ms',
      }}
    >
      {/* Title — 15/600 for clear hierarchy */}
      <span style={{
        fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 600,
        lineHeight: '20px', color: 'var(--color-text-primary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
      }}>
        {displayTitle}
      </span>

      {/* Status pill — text-only label, no inner dot (border carries the colour) */}
      {pill ? (
        <span style={{
          height: 20, display: 'inline-flex', alignItems: 'center',
          padding: '0 8px', borderRadius: 'var(--radius-full)',
          background: pillRoleMap[pill.role].bg,
          border: `1px solid ${pillRoleMap[pill.role].border}`,
          fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500,
          color: pillRoleMap[pill.role].fg, flexShrink: 0,
        }}>
          {pill.label}
        </span>
      ) : <span aria-hidden />}

      {/* Metadata — 13/400 creates visible weight contrast with 15/600 title */}
      <span style={{
        gridColumn: '1 / span 2',
        fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 400, lineHeight: '18px',
        color: 'var(--color-text-tertiary)', marginTop: 1,
      }}>
        {meta}
      </span>
    </button>
  );
}

/** Aggregated collapsed view for orphan/failed notes.
 *  Uses design-system danger tokens, radius-xl, minHeight 44 (tap target). */
function ErrorSummary({ failed, onReview }: { failed: VoiceNote[]; onReview: () => void }) {
  const n = failed.length;
  return (
    <button
      onClick={onReview}
      aria-label={`${n} recording${n === 1 ? '' : 's'} couldn't be transcribed. Review.`}
      style={{
        width: '100%', textAlign: 'left', background: 'var(--color-danger-bg)',
        border: '1px solid #ECC0C0', borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-3) var(--space-4)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 'var(--space-3)', minHeight: 44, minWidth: 0, boxSizing: 'border-box',
      }}
    >
      <span style={{
        fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, lineHeight: '20px',
        color: 'var(--color-danger-text, #A83030)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {n} recording{n === 1 ? '' : 's'} couldn't be transcribed
      </span>
      <span aria-hidden style={{
        fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, lineHeight: '16px',
        color: 'var(--color-danger-text, #A83030)', flexShrink: 0,
      }}>
        Review →
      </span>
    </button>
  );
}

/**
 * Full-screen detail sheet.
 * A11y: role="dialog" + aria-modal, aria-labelledby wired to the title,
 * Escape key closes, body scroll lock while open, focus moves into the sheet
 * on open and returns to the opener on close, aria-live="polite" on the
 * generated-output region so the screen reader announces completion.
 *
 * Design system: uses .btn classes (no hand-rolled buttons), design tokens
 * for typography (heading 16/500, ui 14/500, body 15/1.8, tag 11/500 mono
 * uppercase 0.3em), space-4 rhythm, radius-xl containers.
 */
function NoteSheet({ note, onClose, onDelete, onRerecord }: {
  note: VoiceNote;
  onClose: () => void;
  onDelete: () => void;
  onRerecord: () => void;
}) {
  const updateNote = useVoiceStore(s => s.updateNote);
  const [editTitle, setEditTitle] = useState(note.title);
  const [gen, setGen] = useState<Generation | null>(() => note.lastGeneration
    ? { kind: note.lastGeneration.kind, text: note.lastGeneration.text, loading: false }
    : null);
  const [copied, setCopied] = useState(false);
  const isError = note.status === 'error';
  const titleId = `voice-sheet-title-${note.id}`;
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const saveTitle = () => {
    const t = editTitle.trim();
    if (!t || t === note.title) return;
    updateNote(note.id, { title: t });
  };

  const close = useCallback(() => { saveTitle(); onClose(); }, [onClose]);

  // a11y: capture the previously-focused element to restore on close, move
  // focus into the sheet, lock body scroll, and listen for Escape.
  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Defer so the portal has mounted and the button is focusable.
    const t = setTimeout(() => closeBtnRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      openerRef.current?.focus?.();
    };
  }, [close]);

  const generate = useCallback(async (kind: AssetKind) => {
    if (!note.transcript) return;
    setGen({ kind, text: '', loading: true });
    try {
      const out = await aiExecute(note.transcript, {}, kind);
      setGen({ kind, text: out, loading: false });
      updateNote(note.id, { lastGeneration: { kind, text: out, createdAt: new Date().toISOString() } });
    } catch (e: any) {
      setGen({ kind, text: '', loading: false, error: e?.message || 'Generation failed' });
    }
  }, [note.id, note.transcript, updateNote]);

  const copy = async () => {
    if (!gen?.text) return;
    try { await navigator.clipboard.writeText(gen.text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* blocked */ }
  };

  // tag style: 500 11px mono uppercase 0.3em letter-spacing #6d6d6d
  const tagStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, lineHeight: 1,
    textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--color-text-tertiary)',
  };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      {/* Tap-backdrop to dismiss */}
      <div onClick={close} style={{ position: 'absolute', inset: 0, background: 'var(--color-overlay-backdrop)' }} />

      {/* Sheet — 80dvh, slides up from bottom */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          position: 'relative', zIndex: 1,
          height: '80dvh', display: 'flex', flexDirection: 'column', minWidth: 0,
          background: 'var(--color-bg)',
          borderRadius: '16px 16px 0 0',
          overflow: 'hidden',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-border-default)' }} />
        </div>

      {/* Sheet header */}
      <div style={{
        flexShrink: 0, padding: 'var(--space-2) var(--space-4) var(--space-3)',
        borderBottom: '1px solid var(--color-border-subtle)',
        background: 'var(--color-bg-card)',
        display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0,
      }}>
        <button
          ref={closeBtnRef}
          onClick={close}
          aria-label="Close note"
          className="btn-icon"
          style={{ background: 'transparent', border: 'none', color: 'var(--color-text-tertiary)', flexShrink: 0 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label htmlFor={titleId} className="sr-only">Note title</label>
          <input
            id={titleId}
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
            aria-label="Note title"
            style={{
              width: '100%', fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 500, lineHeight: '22px',
              color: 'var(--color-text-primary)', background: 'none',
              border: 'none', borderBottom: '1px solid transparent', outline: 'none', padding: '2px 0',
            }}
            onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--color-border-strong)'; }}
          />
          <div style={{
            fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, lineHeight: '16px',
            color: 'var(--color-text-tertiary)', marginTop: 2,
          }}>
            {fmtDuration(note.durationMs)} · {fmtDate(note.createdAt)}
          </div>
        </div>
      </div>

      {/* Sheet body */}
      <div style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        padding: 'var(--space-5) var(--space-4)',
        display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', minWidth: 0,
      }}>
        {isError ? (
          <div role="alert" style={{
            background: 'var(--color-danger-bg, #FEF4F4)',
            border: '1px solid #ECC0C0', borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 400, lineHeight: 1.5,
            color: 'var(--color-danger-text, #A83030)', wordBreak: 'break-word',
          }}>
            {note.errorReason || 'Transcription failed.'}
          </div>
        ) : note.transcript ? (
          <section aria-labelledby={`${titleId}-transcript`}>
            <div id={`${titleId}-transcript`} style={{ ...tagStyle, marginBottom: 'var(--space-2)' }}>Transcript</div>
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 400, lineHeight: 1.8,
              color: 'var(--color-text-primary)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere',
            }}>
              {note.transcript}
            </div>
          </section>
        ) : (
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 400, lineHeight: 1.5, color: 'var(--color-text-tertiary)' }}>
            This recording has audio but no transcript yet. Add a Groq API key in desktop Settings to transcribe existing audio.
          </div>
        )}

        {/* Generator — primary action */}
        {note.transcript && !isError && (
          <section aria-labelledby={`${titleId}-create`}>
            <div id={`${titleId}-create`} style={{ ...tagStyle, marginBottom: 'var(--space-2)' }}>Create asset</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-2)' }}>
              {(['linkedin-post', 'twitter-thread', 'twitter-single'] as const).map(k => {
                const isActive = gen?.kind === k;
                const isLoadingThis = !!(isActive && gen?.loading);
                const isSaved = note.lastGeneration?.kind === k;
                return (
                  <button
                    key={k}
                    onClick={() => generate(k)}
                    disabled={isLoadingThis}
                    aria-label={`Generate ${KIND_LABEL[k]}${isSaved ? ' (previously saved)' : ''}`}
                    style={{
                      width: '100%', minHeight: 44, padding: 'var(--space-3) var(--space-4)',
                      borderRadius: 'var(--radius-lg)',
                      border: `1px solid ${isActive ? 'var(--color-accent, #0DBF5A)' : 'var(--color-border-default)'}`,
                      background: isActive ? 'var(--color-bg-surface)' : 'var(--color-bg-card)',
                      fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, lineHeight: '20px',
                      color: 'var(--color-text-primary)', textAlign: 'left',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)',
                    }}
                  >
                    <span>{KIND_LABEL[k]}</span>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, color: 'var(--color-text-tertiary)' }}>
                      {isLoadingThis ? 'Generating…' : isSaved ? 'Saved' : '→'}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Generated output — aria-live so screen readers announce completion */}
        {gen && (gen.loading || gen.text || gen.error) && (
          <section aria-live="polite" aria-busy={!!gen.loading}
            style={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)',
              minWidth: 0, overflow: 'hidden',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
              <span style={tagStyle}>{KIND_LABEL[gen.kind]}</span>
              {gen.text && !gen.loading && (
                <button
                  onClick={copy}
                  aria-label={copied ? 'Copied to clipboard' : 'Copy generated text'}
                  className="btn-xs btn-ghost"
                  style={{ color: 'var(--color-accent, #0DBF5A)' }}
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
            {gen.loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} aria-label="Generating">
                {[100, 92, 96, 80].map((w, i) => <div key={i} className="skeleton-bar" style={{ height: 12, width: `${w}%`, borderRadius: 'var(--radius-sm)', animationDelay: `${i * 0.1}s` }} />)}
              </div>
            ) : gen.error ? (
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 400, lineHeight: 1.5, color: 'var(--color-danger-text, #A83030)', wordBreak: 'break-word' }}>
                {gen.error}
              </div>
            ) : (
              <div style={{
                fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 400, lineHeight: 1.75,
                color: 'var(--color-text-primary)',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere',
              }}>
                {gen.text}
              </div>
            )}
          </section>
        )}

        {/* Footer actions */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'auto', paddingTop: 'var(--space-4)', paddingBottom: 'calc(var(--space-4) + env(safe-area-inset-bottom, 0px))' }}>
          {isError && (
            <button onClick={() => { onRerecord(); onClose(); }} className="btn btn-primary" style={{ flex: 1 }}>
              Re-record
            </button>
          )}
          <button
            onClick={() => { onDelete(); onClose(); }}
            className="btn btn-ghost-dest"
            style={{ flex: isError ? 'none' : 1, minWidth: isError ? 88 : 'auto' }}
          >
            Delete
          </button>
        </div>
      </div>
      </div>
    </div>,
    document.body,
  );
}

export default function MobileHome() {
  const { notes, addNote, updateNote, removeNote } = useVoiceStore();
  const groqKey = useSettingsStore(s => s.groqKey);
  const anthropicKey = useSettingsStore(s => s.anthropicKey);
  const { user, guest } = useAuthStore();
  const hasKey = !!(groqKey || anthropicKey);

  const [recording, setRecording] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [showingErrors, setShowingErrors] = useState(false);
  const [justRecordedId, setJustRecordedId] = useState<string | null>(null);

  const mediaRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startTimeRef = useRef(0);
  const noteIdRef = useRef('');
  const finalRef = useRef('');
  const interimRef = useRef('');
  const shouldRestartRef = useRef(false);
  const groqKeyRef = useRef(groqKey);
  useEffect(() => { groqKeyRef.current = groqKey; }, [groqKey]);

  // Reconcile orphaned transient states on mount: if a previous session was
  // killed mid-recording or mid-transcribe, flip the note to 'error' so it
  // surfaces in the list with a clear reason instead of being invisible or
  // blocking the UI forever.
  useEffect(() => {
    const state = useVoiceStore.getState();
    for (const n of state.notes) {
      if (n.status === 'recording') {
        state.updateNote(n.id, { status: 'error', errorReason: 'Recording was interrupted. Please record again.' });
      } else if (n.status === 'transcribing') {
        state.updateNote(n.id, { status: 'error', errorReason: 'Transcription was interrupted. Please record again.' });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = useCallback(async () => {
    setErrorMsg(null);
    setLiveText('');
    finalRef.current = '';
    interimRef.current = '';
    chunksRef.current = [];

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recog = new SpeechRecognition();
        recog.continuous = true; recog.interimResults = true;
        recog.lang = navigator.language || 'en-US';
        recog.onresult = (e: any) => {
          let interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const t = e.results[i][0].transcript;
            if (e.results[i].isFinal) finalRef.current += t + ' ';
            else interim += t;
          }
          interimRef.current = interim;
          setLiveText((finalRef.current + ' ' + interim).trim());
        };
        recog.onend = () => { if (shouldRestartRef.current) { try { recog.start(); } catch { /* already started */ } } };
        shouldRestartRef.current = true;
        recog.start();
        recognitionRef.current = recog;
      } catch { /* fall back to Whisper on stop */ }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRef.current = stream;
      const mime = pickMimeType();
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start(1000);
      recorderRef.current = mr;
    } catch {
      shouldRestartRef.current = false;
      try { recognitionRef.current?.stop(); } catch { /* noop */ }
      recognitionRef.current = null;
      setErrorMsg('Microphone access denied.');
      return;
    }

    const id = `vn-${Date.now()}`;
    noteIdRef.current = id;
    startTimeRef.current = Date.now();
    setRecording(true);
    addNote({ id, title: 'Recording…', durationMs: 0, transcript: '', status: 'recording', createdAt: new Date().toISOString() });
  }, [addNote]);

  const stopRecording = useCallback(async () => {
    shouldRestartRef.current = false;
    try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
    recognitionRef.current = null;

    // 2s watchdog on the stop flush — iOS Safari webm path has been seen to
    // hang the 'stop' event, which would freeze the overlay indefinitely.
    const mr = recorderRef.current;
    if (mr && mr.state !== 'inactive') {
      await new Promise<void>(resolve => {
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        const timer = setTimeout(finish, 2000);
        mr.addEventListener('stop', () => { clearTimeout(timer); finish(); }, { once: true });
        try { mr.stop(); } catch { clearTimeout(timer); finish(); }
      });
    }
    recorderRef.current = null;
    mediaRef.current?.getTracks().forEach(t => t.stop());
    mediaRef.current = null;

    const noteId = noteIdRef.current;
    const duration = Date.now() - startTimeRef.current;
    let transcript = [finalRef.current.trim(), interimRef.current.trim()].filter(Boolean).join(' ').trim();

    const mimeType = (chunksRef.current[0] as Blob | undefined)?.type || 'audio/webm';
    const blob = chunksRef.current.length ? new Blob(chunksRef.current, { type: mimeType }) : null;
    chunksRef.current = [];
    setRecording(false);

    let errorReason: string | null = null;
    if (!transcript && blob && blob.size > 0 && groqKeyRef.current) {
      updateNote(noteId, { durationMs: duration, status: 'transcribing' });
      try { transcript = await transcribeWithGroq(blob, groqKeyRef.current); } catch (e: any) {
        errorReason = `Transcription failed: ${e?.message || 'unknown error'}`;
      }
    } else if (!transcript && blob && blob.size > 0 && !groqKeyRef.current) {
      errorReason = 'Add a Groq key in Settings for transcription on iOS.';
    } else if (!transcript && (!blob || blob.size === 0)) {
      errorReason = 'No audio captured.';
    }

    if (errorReason && !transcript) {
      updateNote(noteId, { title: 'Untitled note', durationMs: duration, transcript: '', status: 'error', errorReason });
      return;
    }

    const title = transcript ? transcript.split(/\s+/).slice(0, 5).join(' ') : 'Untitled note';
    updateNote(noteId, { title, durationMs: duration, transcript, status: 'ready', errorReason: undefined });
    // Continuity cue: briefly flag the just-finished note so the card can
    // signal "this is what you just made" (3s is enough to draw the eye
    // without becoming stateful noise).
    setJustRecordedId(noteId);
    setTimeout(() => setJustRecordedId(curr => curr === noteId ? null : curr), 3000);
  }, [updateNote]);

  const cancelRecording = useCallback(() => {
    shouldRestartRef.current = false;
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    recognitionRef.current = null;
    const mr = recorderRef.current;
    if (mr && mr.state !== 'inactive') { try { mr.stop(); } catch { /* noop */ } }
    recorderRef.current = null;
    mediaRef.current?.getTracks().forEach(t => t.stop());
    mediaRef.current = null;
    chunksRef.current = [];
    removeNote(noteIdRef.current);
    setRecording(false);
  }, [removeNote]);

  // Split the list: errors get corralled into a single collapsible summary,
  // everything else renders as compact cards in reverse-chronological order.
  const activeNotes = [...notes].filter(n => n.status !== 'recording' && n.status !== 'error').reverse();
  const failedNotes = [...notes].filter(n => n.status === 'error').reverse();
  const openNote = openNoteId ? notes.find(n => n.id === openNoteId) : null;
  const isEmpty = activeNotes.length === 0 && failedNotes.length === 0;

  return (
    <div className="mobile-safe-scroll" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--color-bg)', position: 'relative', minWidth: 0 }}>
      <style>{`
        @keyframes mh-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .mh-ring-mark { animation: none !important; } }
      `}</style>

      {guest && !user && (
        <div style={{ background: 'var(--color-warning-bg)', borderBottom: '1px solid var(--color-warning-border)', padding: '6px 14px', fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--color-warning-text)', textAlign: 'center' }}>
          Guest mode — your work won't be saved.
        </div>
      )}

      {/* Header */}
      <header style={{ padding: 'var(--space-4) var(--space-4) var(--space-3)', flexShrink: 0, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          {/* Brand mark — same conic ring identity as RecordButton */}
          <div className="mh-ring-mark" aria-hidden style={{
            width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
            padding: 3,
            background: 'conic-gradient(from 0deg, #c4a7ff, #7a5af8, #a78bfa, #c4a7ff)',
            WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor',
            mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            maskComposite: 'exclude',
            animation: 'mh-spin 8s linear infinite',
          }} />
          <h1 style={{
            margin: 0, fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 500, lineHeight: '28px',
            color: 'var(--color-text-primary)', letterSpacing: '-0.02em',
          }}>Voice Notes</h1>
        </div>
        <p style={{
          margin: 0, fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 400, lineHeight: '20px',
          color: 'var(--color-text-tertiary)', wordBreak: 'break-word',
        }}>
          Record an idea and turn it into a LinkedIn post or tweet.
        </p>
      </header>

      {/* Scrollable notes list */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 var(--space-4) 140px', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', minWidth: 0 }}>
        {!hasKey && (
          <div role="status" style={{
            padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-xl)',
            background: 'var(--color-warning-bg, #FEF8E8)',
            border: '1px solid var(--color-warning-border, #F0D8A0)',
            fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 400, lineHeight: 1.5,
            color: 'var(--color-warning-text, #6A4A10)',
          }}>
            Add an Anthropic or Groq API key on a desktop session to enable transcription and generation.
          </div>
        )}

        {errorMsg && (
          <div role="alert" style={{
            padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)',
            background: 'var(--color-danger-bg, #FEF4F4)',
            fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 400, lineHeight: 1.5,
            color: 'var(--color-danger-text, #A83030)',
          }}>{errorMsg}</div>
        )}

        {isEmpty ? (
          /* Empty state: ambient brand ring fills the space; CTA sits near the record button */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-4)', paddingBottom: 160 }}>
            <div className="mh-ring-mark" aria-hidden style={{
              width: 96, height: 96, borderRadius: '50%',
              padding: 10,
              background: 'conic-gradient(from 0deg, #c4a7ff, #7a5af8, #a78bfa, #c4a7ff)',
              WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
              WebkitMaskComposite: 'xor',
              mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
              maskComposite: 'exclude',
              animation: 'mh-spin 12s linear infinite',
              opacity: 0.55,
            }} />
            <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 400, lineHeight: 1.5, color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
              Tap to record your first idea
            </p>
          </div>
        ) : (
          <>
            {/* Aggregated failures at the top — collapsed by default */}
            {failedNotes.length > 0 && !showingErrors && (
              <ErrorSummary failed={failedNotes} onReview={() => setShowingErrors(true)} />
            )}
            {failedNotes.length > 0 && showingErrors && (
              <section aria-label="Failed recordings" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-2) var(--space-1) 0' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, lineHeight: 1,
                    textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--color-text-tertiary)',
                  }}>
                    Failed recordings
                  </span>
                  <button
                    onClick={() => setShowingErrors(false)}
                    aria-label="Hide failed recordings"
                    className="btn-xs btn-ghost"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    Hide
                  </button>
                </header>
                {failedNotes.map(n => (
                  <NoteCard key={n.id} note={n} onOpen={() => setOpenNoteId(n.id)} />
                ))}
              </section>
            )}

            {/* Active notes */}
            {activeNotes.map(n => (
              <div
                key={n.id}
                style={{
                  position: 'relative',
                  boxShadow: justRecordedId === n.id ? '0 0 0 2px var(--color-accent, #0DBF5A)' : 'none',
                  borderRadius: 'var(--radius-xl)',
                  transition: 'box-shadow 300ms ease',
                }}
              >
                <NoteCard note={n} onOpen={() => setOpenNoteId(n.id)} />
              </div>
            ))}
          </>
        )}
      </div>

      {/* Sticky record button */}
      <div style={{ position: 'absolute', bottom: 'calc(var(--space-5) + env(safe-area-inset-bottom, 0px))', left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto' }}>
          <RecordButton size={88} onClick={startRecording} state="idle" />
        </div>
      </div>

      {recording && (
        <RecordingOverlay onStop={stopRecording} onCancel={cancelRecording} startTime={startTimeRef.current} liveText={liveText} />
      )}

      {openNote && (
        <NoteSheet
          note={openNote}
          onClose={() => setOpenNoteId(null)}
          onDelete={() => removeNote(openNote.id)}
          onRerecord={async () => {
            const before = useVoiceStore.getState().notes.length;
            await startRecording();
            const after = useVoiceStore.getState().notes.length;
            if (after > before) removeNote(openNote.id);
          }}
        />
      )}
    </div>
  );
}
