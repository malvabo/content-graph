import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useVoiceStore, type VoiceNote } from '../../store/voiceStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { aiExecute } from '../../utils/aiExecutor';

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveTextRef = useRef(liveText);
  useEffect(() => { liveTextRef.current = liveText; }, [liveText]);

  useEffect(() => {
    const iv = setInterval(() => setElapsed(Date.now() - startTime), 200);
    return () => clearInterval(iv);
  }, [startTime]);

  // Canvas cloud animation — 4 soft green radial blobs orbiting the center.
  // When speech arrives the orbital spread lerps to ~0 so they merge into one glow.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let t = 0, spread = 88, raf: number;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const w = window.innerWidth, h = window.innerHeight;
      const cx = w / 2, cy = h * 0.54;

      const hasSpeech = liveTextRef.current.length > 3;
      const targetSpread = hasSpeech ? 14 : 88;
      spread += (targetSpread - spread) * 0.035;

      ctx.fillStyle = '#080910';
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 4; i++) {
        const angle = t * 0.65 + i * (Math.PI * 0.5);
        const r = spread + Math.sin(t * 0.45 + i * 1.1) * 20;
        const px = cx + Math.cos(angle) * r * 0.88;
        const py = cy + Math.sin(angle) * r * 0.72;
        const sz = 155 + Math.sin(t * 0.9 + i * 0.8) * 38;
        const grad = ctx.createRadialGradient(px, py, 0, px, py, sz);
        const hue = 145 + i * 5;
        grad.addColorStop(0, `hsla(${hue},58%,52%,0.22)`);
        grad.addColorStop(0.5, `hsla(${hue},50%,48%,0.06)`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      t += 0.010;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  const mm = String(Math.floor(elapsed / 60000)).padStart(2, '0');
  const ss = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0');
  const tail = liveText ? liveText.slice(-120) : '';

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      <style>{`@keyframes rec-cursor { 0%,49%{opacity:1} 50%,100%{opacity:0} }`}</style>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>

        {/* ── Top: transcript + timer ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: '60px 32px 24px', width: '100%', boxSizing: 'border-box' }}>
          <div aria-live="polite" style={{ fontSize: 'var(--text-body)', fontFamily: 'var(--font-sans)', color: 'rgba(13,191,90,0.82)', textAlign: 'center', lineHeight: 1.55, minHeight: 22, maxWidth: 300 }}>
            {tail
              ? <>{tail}<span aria-hidden style={{ animation: 'rec-cursor 1.2s step-end infinite', marginLeft: 1 }}>|</span></>
              : <span style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.30)' }}>Listening…</span>
            }
          </div>
          <div style={{ marginTop: 18, fontSize: 76, fontWeight: 200, fontFamily: 'var(--font-sans)', color: '#ffffff', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {mm}:{ss}
          </div>
        </div>

        {/* ── Centre: stop button ── */}
        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '28px 0' }}>
          <button
            onClick={onStop}
            aria-label="Stop and save recording"
            style={{
              width: 64, height: 64, borderRadius: '50%', border: 'none',
              background: 'rgba(13,191,90,0.88)', color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 36px rgba(13,191,90,0.30), 0 4px 16px rgba(0,0,0,0.35)',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
          <div style={{ fontSize: 'var(--text-tag)', fontFamily: 'var(--font-sans)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
            Tap to stop
          </div>
        </div>

        {/* ── Bottom: discard ── */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', paddingBottom: 'calc(44px + env(safe-area-inset-bottom, 0px))' }}>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body)', cursor: 'pointer', padding: '10px 32px', minHeight: 44 }}>
            Discard
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Compact single-row retrieval card.
 * Tokens: radius-xl, space-4, ui (14/500) title, small (12/500) metadata.
 * Pill follows the design system's status-pill recipe: 20px tall, 100px
 * radius, 6px dot + 14px text, role-specific BG + border per Status Colors.
 *
 * A11y: tap target ≥ 44px, aria-label is a full natural-language summary so
 * screen-reader users don't have to compose the row themselves, focus-visible
 * ring uses the accent token per design system.
 */
function NoteCard({ note, onOpen }: { note: VoiceNote; onOpen: () => void }) {
  const isTranscribing = note.status === 'transcribing';
  const isAudioOnly = note.status === 'ready' && !note.transcript;
  const isError = note.status === 'error';

  type PillRole = 'complete' | 'running' | 'idle' | 'error';
  const pillRoleMap: Record<PillRole, { dot: string; bg: string; border: string; fg: string }> = {
    complete: { dot: '#0DBF5A', bg: 'rgba(13,191,90,0.14)', border: 'rgba(13,191,90,0.28)', fg: 'rgba(13,191,90,0.95)' },
    running:  { dot: '#F0D8A0', bg: 'rgba(240,216,160,0.14)', border: 'rgba(240,216,160,0.28)', fg: 'rgba(240,216,160,0.95)' },
    idle:     { dot: 'rgba(255,255,255,0.30)', bg: 'rgba(255,255,255,0.07)', border: 'transparent', fg: 'rgba(255,255,255,0.45)' },
    error:    { dot: '#ff6b6b', bg: 'rgba(201,48,48,0.14)', border: 'rgba(201,48,48,0.28)', fg: 'rgba(255,107,107,0.95)' },
  };

  const pill = isTranscribing ? { role: 'running' as PillRole, label: 'Transcribing' }
    : isError ? { role: 'error' as PillRole, label: 'Failed' }
    : isAudioOnly ? { role: 'idle' as PillRole, label: 'Audio only' }
    : note.lastGeneration ? { role: 'complete' as PillRole, label: KIND_LABEL[note.lastGeneration.kind].split(' ')[0] }
    : null;

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
        width: '100%', textAlign: 'left',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.10)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-4) var(--space-5)', display: 'grid',
        gridTemplateColumns: 'auto 1fr auto', alignItems: 'center',
        columnGap: 'var(--space-4)', rowGap: 4, minHeight: 80,
        cursor: isTranscribing ? 'default' : 'pointer',
        opacity: isTranscribing ? 0.6 : 1, minWidth: 0, boxSizing: 'border-box',
        transition: 'border-color 120ms, background 120ms',
      }}
    >
      {/* Status dot — 8×8, pinned left spanning both rows */}
      <span aria-hidden style={{
        gridRow: '1 / span 2', width: 8, height: 8, borderRadius: 'var(--radius-full)',
        background: pillRoleMap[pill?.role ?? 'idle'].dot, flexShrink: 0, marginTop: 8,
      }} />

      {/* Title — 16/500/22px */}
      <span style={{
        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-heading)', fontWeight: 500,
        lineHeight: '22px', color: 'rgba(255,255,255,0.92)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
      }}>
        {displayTitle}
      </span>

      {/* Status pill */}
      {pill ? (
        <span style={{
          height: 24, display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '0 10px', borderRadius: 'var(--radius-full)',
          background: pillRoleMap[pill.role].bg,
          border: `1px solid ${pillRoleMap[pill.role].border}`,
          fontFamily: 'var(--font-sans)', fontSize: 'var(--text-caption)', fontWeight: 500,
          color: pillRoleMap[pill.role].fg, flexShrink: 0,
        }}>
          <span aria-hidden style={{ width: 6, height: 6, borderRadius: 'var(--radius-full)', background: pillRoleMap[pill.role].dot }} />
          {pill.label}
        </span>
      ) : <span aria-hidden />}

      {/* Metadata — 13/500/18px */}
      <span style={{
        gridColumn: '2 / span 2',
        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body-sm)', fontWeight: 400, lineHeight: '20px',
        color: 'rgba(255,255,255,0.40)',
      }}>
        {meta}
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
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [gen, setGen] = useState<Generation | null>(() => note.lastGeneration
    ? { kind: note.lastGeneration.kind, text: note.lastGeneration.text, loading: false }
    : null);
  const [copied, setCopied] = useState(false);
  const isError = note.status === 'error';
  const titleId = `voice-sheet-title-${note.id}`;
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const saveTitle = useCallback(() => {
    const t = editTitle.trim();
    if (!t) { setEditTitle(note.title); return; }
    if (t === note.title) return;
    updateNote(note.id, { title: t });
  }, [editTitle, note.id, note.title, updateNote]);

  const finishTitleEdit = () => { saveTitle(); setIsEditingTitle(false); };

  const close = useCallback(() => { saveTitle(); onClose(); }, [onClose, saveTitle]);

  useEffect(() => {
    if (isEditingTitle) {
      const id = setTimeout(() => {
        const el = titleInputRef.current;
        if (el) { el.focus(); el.select(); }
      }, 0);
      return () => clearTimeout(id);
    }
  }, [isEditingTitle]);

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

  const tagStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)', fontSize: 'var(--text-caption)', fontWeight: 500, lineHeight: 1,
    textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)',
  };

  const glassCard: React.CSSProperties = {
    position: 'relative',
    borderRadius: 22,
    border: '1px solid var(--color-border-subtle)',
    background: 'var(--color-bg-card)',
    boxShadow: '0 14px 40px rgba(0,0,0,0.07), 0 2px 6px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.6)',
    overflow: 'hidden',
  };

  const platformGlow: Record<AssetKind, { rgb: string; accent: string; dur: number; delay: number }> = {
    'linkedin-post':   { rgb: '10,102,194', accent: '#0a66c2', dur: 7.4, delay: -1.1 },
    'twitter-thread':  { rgb: '29,155,240', accent: '#1d9bf0', dur: 6.6, delay: -3.2 },
    'twitter-single':  { rgb: '29,155,240', accent: '#1d9bf0', dur: 5.9, delay: -0.5 },
  };

  return createPortal(
    <div
      ref={sheetRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', minWidth: 0,
      }}
    >
      {/* Top nav row — back chevron alone, leaves room for future right-side actions */}
      <div style={{
        flexShrink: 0,
        padding: 'calc(var(--space-3) + env(safe-area-inset-top, 0px)) var(--space-3) 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        minHeight: 44,
      }}>
        <button
          ref={closeBtnRef}
          onClick={close}
          aria-label="Close note"
          className="btn-icon"
          style={{ background: 'transparent', border: 'none', color: 'var(--color-text-tertiary)' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
      </div>

      {/* Title block — heading by default, swaps to input on tap */}
      <div style={{
        flexShrink: 0,
        padding: 'var(--space-2) var(--space-4) var(--space-4)',
      }}>
        <label htmlFor={titleId} className="sr-only">Note title</label>
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            id={titleId}
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onBlur={finishTitleEdit}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { e.currentTarget.blur(); } }}
            aria-label="Note title"
            style={{
              display: 'block', width: '100%', margin: 0, padding: 0,
              background: 'transparent', border: 'none', outline: 'none',
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-title)', fontWeight: 700, lineHeight: 1.2,
              letterSpacing: '-0.02em', color: 'var(--color-text-primary)',
              caretColor: 'var(--color-accent, #0DBF5A)',
            }}
          />
        ) : (
          <h1
            id={titleId}
            onClick={() => setIsEditingTitle(true)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsEditingTitle(true); } }}
            tabIndex={0}
            role="button"
            aria-label={`${editTitle}. Tap to edit title.`}
            style={{
              margin: 0, padding: 0, cursor: 'text', outline: 'none',
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-title)', fontWeight: 700, lineHeight: 1.2,
              letterSpacing: '-0.02em', color: 'var(--color-text-primary)',
              wordBreak: 'break-word',
            }}
          >
            {editTitle}
          </h1>
        )}
        <div aria-hidden style={{
          fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body)', fontWeight: 500, lineHeight: 1.4,
          color: 'var(--color-text-tertiary)', marginTop: 8,
        }}>
          {fmtDuration(note.durationMs)} · {fmtDate(note.createdAt)}
        </div>
      </div>

      {/* Sheet body */}
      <div style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        padding: 'var(--space-3) var(--space-4) var(--space-5)',
        display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 0,
      }}>
        {isError ? (
          <div role="alert" style={{
            ...glassCard,
            background: 'var(--color-danger-bg, #FEF4F4)',
            border: '1px solid #ECC0C0',
            padding: 'var(--space-4)',
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body)', fontWeight: 400, lineHeight: 1.55,
            color: 'var(--color-danger-text, #A83030)', wordBreak: 'break-word',
          }}>
            {note.errorReason || 'Transcription failed.'}
          </div>
        ) : note.transcript ? (
          <section aria-labelledby={`${titleId}-transcript`} style={{ ...glassCard, padding: 'var(--space-5)' }}>
            <div id={`${titleId}-transcript`} style={{ ...tagStyle, marginBottom: 'var(--space-3)' }}>Transcript</div>
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-title-sm)', fontWeight: 400, lineHeight: 1.65,
              color: 'var(--color-text-primary)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere',
            }}>
              {note.transcript}
            </div>
          </section>
        ) : (
          <div style={{ ...glassCard, padding: 'var(--space-4)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body)', fontWeight: 400, lineHeight: 1.55, color: 'var(--color-text-tertiary)' }}>
            This recording has audio but no transcript yet. Add a Groq API key in desktop Settings to transcribe existing audio.
          </div>
        )}

        {/* Generator — primary action */}
        {note.transcript && !isError && (
          <section aria-labelledby={`${titleId}-create`} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div id={`${titleId}-create`} style={{ ...tagStyle, paddingLeft: 4 }}>Create asset</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-3)' }}>
              {(['linkedin-post', 'twitter-thread', 'twitter-single'] as const).map(k => {
                const isActive = gen?.kind === k;
                const isLoadingThis = !!(isActive && gen?.loading);
                const isSaved = note.lastGeneration?.kind === k;
                const meta = platformGlow[k];
                return (
                  <button
                    key={k}
                    onClick={() => generate(k)}
                    disabled={isLoadingThis}
                    aria-label={`Generate ${KIND_LABEL[k]}${isSaved ? ' (previously saved)' : ''}`}
                    style={{
                      ...glassCard,
                      width: '100%', minHeight: 56, padding: 'var(--space-4) var(--space-4)',
                      borderRadius: 18,
                      border: `1px solid ${isActive ? meta.accent : 'var(--color-border-subtle)'}`,
                      background: isActive
                        ? `linear-gradient(135deg, rgba(${meta.rgb},0.10) 0%, var(--color-bg-card) 70%)`
                        : 'var(--color-bg-card)',
                      boxShadow: isActive
                        ? `0 14px 40px rgba(${meta.rgb},0.16), 0 2px 6px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.6)`
                        : '0 8px 24px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.55)',
                      cursor: isLoadingThis ? 'progress' : 'pointer',
                      fontFamily: 'var(--font-sans)', fontSize: 'var(--text-heading)', fontWeight: 600, lineHeight: 1.2,
                      color: 'var(--color-text-primary)', textAlign: 'left',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)',
                      transition: 'box-shadow 220ms, border-color 220ms, background 220ms',
                    }}
                  >
                    <span>{KIND_LABEL[k]}</span>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body-sm)', fontWeight: 500, color: isActive ? meta.accent : 'var(--color-text-tertiary)' }}>
                      {isLoadingThis ? 'Generating…' : isSaved ? 'Saved' : '→'}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Generated output — glass card with breathing platform-tinted glow */}
        {gen && (gen.loading || gen.text || gen.error) && (() => {
          const meta = platformGlow[gen.kind];
          return (
            <section aria-live="polite" aria-busy={!!gen.loading}
              style={{
                ...glassCard,
                padding: 'var(--space-5)',
                background: `linear-gradient(155deg, var(--color-bg-card) 0%, var(--color-bg-card) 55%, rgba(${meta.rgb},0.06) 100%)`,
                boxShadow: `0 18px 48px rgba(${meta.rgb},0.14), 0 4px 10px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.6)`,
              }}>
              <div aria-hidden className="widget-glow" style={{
                position: 'absolute', inset: '-30%',
                background: `radial-gradient(ellipse at 30% 30%, rgba(${meta.rgb},0.16) 0%, rgba(${meta.rgb},0.05) 42%, rgba(${meta.rgb},0) 75%)`,
                animationName: 'widget-breathe',
                animationDuration: `${meta.dur}s`,
                animationDelay: `${meta.delay}s`,
                animationTimingFunction: 'ease-in-out',
                animationIterationCount: 'infinite',
                willChange: 'transform, opacity',
                pointerEvents: 'none',
                zIndex: 0,
              }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                  <span style={tagStyle}>{KIND_LABEL[gen.kind]}</span>
                  {gen.text && !gen.loading && (
                    <button
                      onClick={copy}
                      aria-label={copied ? 'Copied to clipboard' : 'Copy generated text'}
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body)', fontWeight: 600,
                        color: meta.accent, padding: '4px 8px', borderRadius: 8,
                      }}
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  )}
                </div>
                {gen.loading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-label="Generating">
                    {[100, 92, 96, 80].map((w, i) => <div key={i} className="skeleton-bar" style={{ height: 14, width: `${w}%`, borderRadius: 8, animationDelay: `${i * 0.1}s` }} />)}
                  </div>
                ) : gen.error ? (
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body)', fontWeight: 400, lineHeight: 1.55, color: 'var(--color-danger-text, #A83030)', wordBreak: 'break-word' }}>
                    {gen.error}
                  </div>
                ) : (
                  <div style={{
                    fontFamily: 'var(--font-sans)', fontSize: 'var(--text-title-sm)', fontWeight: 400, lineHeight: 1.6,
                    color: 'var(--color-text-primary)',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere',
                  }}>
                    {gen.text}
                  </div>
                )}
              </div>
            </section>
          );
        })()}

        {/* Footer actions */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'auto', paddingTop: 'var(--space-5)', paddingBottom: 'env(safe-area-inset-bottom, 0px)', justifyContent: 'center' }}>
          {isError && (
            <button onClick={() => { onRerecord(); onClose(); }} className="btn btn-primary" style={{ flex: 1 }}>
              Re-record
            </button>
          )}
          <button
            onClick={() => { onDelete(); onClose(); }}
            className="btn btn-ghost-dest"
            style={{ flex: isError ? 'none' : 1, minWidth: isError ? 88 : 'auto', fontSize: 'var(--text-body)' }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ─── Widget dashboard ─────────────────────────────────────────────────── */

type WidgetKind = 'twitter' | 'linkedin' | 'voice' | 'scripts';
const ALL_WIDGET_KINDS: WidgetKind[] = ['twitter', 'linkedin', 'voice', 'scripts'];

const WIDGET_META: Record<WidgetKind, {
  label: string; sublabel: string; glow: string; dark: string; mid: string; accent: string;
  breathDur: number; breathDelay: number;
  filterFn: (notes: VoiceNote[]) => VoiceNote[];
  countLabel: (n: number) => string;
}> = {
  twitter: {
    label: 'Twitter / X', sublabel: 'Threads & posts',
    glow: 'rgba(29,155,240,', dark: '#040a14', mid: '#09192e', accent: '#1d9bf0',
    breathDur: 5.4, breathDelay: -1.5,
    filterFn: ns => ns.filter(n => n.lastGeneration?.kind === 'twitter-thread' || n.lastGeneration?.kind === 'twitter-single'),
    countLabel: n => n === 1 ? '1 post' : `${n} posts`,
  },
  linkedin: {
    label: 'LinkedIn', sublabel: 'Posts generated',
    glow: 'rgba(10,102,194,', dark: '#030810', mid: '#071426', accent: '#0a66c2',
    breathDur: 6.3, breathDelay: -3.8,
    filterFn: ns => ns.filter(n => n.lastGeneration?.kind === 'linkedin-post'),
    countLabel: n => n === 1 ? '1 post' : `${n} posts`,
  },
  voice: {
    label: 'Voice Notes', sublabel: 'All recordings',
    glow: 'rgba(13,191,90,', dark: '#030d05', mid: '#071408', accent: '#0DBF5A',
    breathDur: 5.0, breathDelay: -0.7,
    filterFn: ns => ns.filter(n => n.status !== 'recording'),
    countLabel: n => n === 1 ? '1 note' : `${n} notes`,
  },
  scripts: {
    label: 'Scripts', sublabel: 'Ready to use',
    glow: 'rgba(144,97,249,', dark: '#06040e', mid: '#120b22', accent: '#9061f9',
    breathDur: 6.8, breathDelay: -2.2,
    filterFn: ns => ns.filter(n => n.status === 'ready' && !!n.transcript),
    countLabel: n => n === 1 ? '1 script' : `${n} scripts`,
  },
};

function widgetBaseBg(meta: typeof WIDGET_META[WidgetKind]): string {
  return `radial-gradient(ellipse at 50% 50%, ${meta.mid} 0%, ${meta.dark} 100%)`;
}

function widgetGlowBg(meta: typeof WIDGET_META[WidgetKind], count: number): string {
  const sat = count === 0 ? 0.22 : Math.min(1, 0.45 + count * 0.12);
  const op1 = (sat * 0.85).toFixed(2);
  const op2 = (sat * 0.30).toFixed(2);
  return `radial-gradient(ellipse at 50% 50%, ${meta.glow}${op1}) 0%, ${meta.glow}${op2}) 42%, ${meta.glow}0) 75%)`;
}

function WidgetCard({ kind, notes, editMode, onRemove, onClick }: {
  kind: WidgetKind; notes: VoiceNote[]; editMode: boolean;
  onRemove: () => void; onClick: () => void;
}) {
  const meta = WIDGET_META[kind];
  const count = meta.filterFn(notes).length;
  return (
    <button
      onClick={editMode ? undefined : onClick}
      aria-label={`${meta.label}: ${meta.countLabel(count)}`}
      style={{
        aspectRatio: '1 / 1', borderRadius: 20, background: widgetBaseBg(meta),
        border: 'none', cursor: editMode ? 'default' : 'pointer',
        position: 'relative', overflow: 'hidden', textAlign: 'left', padding: 0,
        boxShadow: '0 4px 24px rgba(0,0,0,0.40)',
        transition: 'filter 180ms',
      }}
    >
      <div
        aria-hidden
        className="widget-glow"
        style={{
          position: 'absolute', inset: '-30%',
          background: widgetGlowBg(meta, count),
          animationName: 'widget-breathe',
          animationDuration: `${meta.breathDur}s`,
          animationDelay: `${meta.breathDelay}s`,
          animationTimingFunction: 'ease-in-out',
          animationIterationCount: 'infinite',
          willChange: 'transform, opacity',
          pointerEvents: 'none',
        }}
      />
      {editMode && (
        <div
          role="button"
          tabIndex={0}
          onClick={e => { e.stopPropagation(); onRemove(); }}
          style={{
            position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: '50%',
            background: 'rgba(255,255,255,0.20)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 2, fontSize: 17, color: '#fff', lineHeight: 1,
          }}
        >×</div>
      )}
      <div style={{ position: 'absolute', top: 14, left: 14, right: editMode ? 40 : 14 }}>
        <div style={{ fontSize: 'var(--text-heading)', fontWeight: 600, color: '#fff', fontFamily: 'var(--font-sans)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {meta.label}
        </div>
        <div style={{ fontSize: 'var(--text-caption)', color: 'rgba(255,255,255,0.65)', fontFamily: 'var(--font-sans)', marginTop: 3, letterSpacing: '0.02em' }}>
          {meta.sublabel}
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 56, fontWeight: 200, color: '#fff', fontFamily: 'var(--font-sans)', letterSpacing: '-0.03em', opacity: count > 0 ? 0.95 : 0.18 }}>
          {count}
        </span>
      </div>
      <div style={{ position: 'absolute', bottom: 13, left: 14 }}>
        <span style={{ fontSize: 'var(--text-body-sm)', fontWeight: 500, fontFamily: 'var(--font-sans)', color: count > 0 ? meta.accent : 'rgba(255,255,255,0.45)' }}>
          {meta.countLabel(count)}
        </span>
      </div>
    </button>
  );
}

function AddWidgetSheet({ activeWidgets, onAdd, onClose }: {
  activeWidgets: WidgetKind[]; onAdd: (k: WidgetKind) => void; onClose: () => void;
}) {
  const available = ALL_WIDGET_KINDS.filter(k => !activeWidgets.includes(k));
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.58)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: '#0d0f18', borderRadius: '20px 20px 0 0', padding: '20px 16px', paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))', boxShadow: '0 -8px 40px rgba(0,0,0,0.5)' }}>
        <div style={{ fontSize: 'var(--text-title-sm)', fontWeight: 600, color: '#fff', fontFamily: 'var(--font-sans)', marginBottom: 4 }}>Add widget</div>
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--font-sans)', marginBottom: 16 }}>Choose a platform to add to your dashboard</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {available.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body)', padding: '24px 0' }}>All widgets are already active</div>
          ) : available.map(kind => {
            const meta = WIDGET_META[kind];
            return (
              <button key={kind} onClick={() => { onAdd(kind); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, padding: '13px 16px', cursor: 'pointer' }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: `radial-gradient(circle at 40% 40%, ${meta.glow}0.30) 0%, ${meta.dark} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: meta.accent, fontSize: 18 }}>+</span>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-body)', fontWeight: 500, color: '#fff', fontFamily: 'var(--font-sans)' }}>{meta.label}</div>
                  <div style={{ fontSize: 'var(--text-caption)', color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--font-sans)', marginTop: 2 }}>{meta.sublabel}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function DetailView({ kind, notes, onBack, onOpenNote, justRecordedId }: {
  kind: WidgetKind; notes: VoiceNote[];
  onBack: () => void; onOpenNote: (id: string) => void;
  justRecordedId: string | null;
}) {
  const meta = WIDGET_META[kind];
  const filtered = [...meta.filterFn(notes)].reverse();
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={onBack} aria-label="Back" style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.08)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div>
          <div style={{ fontSize: 'var(--text-title)', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-sans)', letterSpacing: '-0.02em' }}>{meta.label}</div>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--font-sans)' }}>{meta.sublabel}</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 160px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '60px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body)', lineHeight: 1.6 }}>
            Nothing here yet.<br />Record a voice note and generate content to see it here.
          </div>
        ) : filtered.map(n => (
          <div key={n.id} style={{ position: 'relative', boxShadow: justRecordedId === n.id ? '0 0 0 2px rgba(13,191,90,0.65), 0 0 24px rgba(13,191,90,0.20)' : 'none', borderRadius: 'var(--radius-xl)', transition: 'box-shadow 400ms ease' }}>
            <NoteCard note={n} onOpen={() => onOpenNote(n.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}

interface MobileHomeProps {
  onAddPost?: () => void;
}

export default function MobileHome({ onAddPost }: MobileHomeProps = {}) {
  const { notes, addNote, updateNote, removeNote } = useVoiceStore();
  const groqKey = useSettingsStore(s => s.groqKey);
  const { user, guest } = useAuthStore();

  const [recording, setRecording] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [justRecordedId, setJustRecordedId] = useState<string | null>(null);

  // Widget dashboard state
  const [activeWidgets, setActiveWidgets] = useState<WidgetKind[]>(() => {
    try {
      const saved = localStorage.getItem('mobile-widgets');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.every((k: unknown) => ALL_WIDGET_KINDS.includes(k as WidgetKind))) return parsed;
      }
    } catch { /* fallback */ }
    return ['twitter', 'linkedin', 'voice', 'scripts'] as WidgetKind[];
  });
  const [editMode, setEditMode] = useState(false);
  const [detailKind, setDetailKind] = useState<WidgetKind | null>(null);
  const [showAddSheet, setShowAddSheet] = useState(false);

  const removeWidget = (kind: WidgetKind) => {
    const next = activeWidgets.filter(k => k !== kind);
    setActiveWidgets(next);
    try { localStorage.setItem('mobile-widgets', JSON.stringify(next)); } catch { /* noop */ }
  };
  const addWidget = (kind: WidgetKind) => {
    if (activeWidgets.includes(kind)) return;
    const next = [...activeWidgets, kind];
    setActiveWidgets(next);
    try { localStorage.setItem('mobile-widgets', JSON.stringify(next)); } catch { /* noop */ }
  };

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

  const openNote = openNoteId ? notes.find(n => n.id === openNoteId) : null;

  return (
    <div className="mobile-safe-scroll" style={{
      flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'linear-gradient(160deg, #0d0f1e 0%, #080910 55%, #0c0d18 100%)',
      position: 'relative', minWidth: 0,
    }}>
      {guest && !user && (
        <div style={{ background: 'rgba(240,216,160,0.10)', borderBottom: '1px solid rgba(240,216,160,0.15)', padding: '8px 14px', fontSize: 'var(--text-caption)', fontFamily: 'var(--font-sans)', color: 'rgba(240,216,160,0.85)', textAlign: 'center' }}>
          Guest mode — your work won't be saved.
        </div>
      )}

      {detailKind ? (
        <DetailView
          kind={detailKind} notes={notes}
          onBack={() => setDetailKind(null)}
          onOpenNote={setOpenNoteId}
          justRecordedId={justRecordedId}
        />
      ) : (
        <>
          {/* Header */}
          <header style={{ padding: '28px 20px 8px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 'var(--text-title-lg)', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-sans)', letterSpacing: '-0.03em' }}>UP150</h1>
              <p style={{ margin: '4px 0 0', fontSize: 'var(--text-body)', color: 'rgba(255,255,255,0.65)', fontFamily: 'var(--font-sans)' }}>Content dashboard</p>
            </div>
            <button
              onClick={() => setEditMode(m => !m)}
              aria-label={editMode ? 'Done editing' : 'Edit widgets'}
              style={{ marginTop: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: '7px 16px', fontSize: 'var(--text-body)', color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
            >
              {editMode ? 'Done' : 'Edit'}
            </button>
          </header>

          {errorMsg && (
            <div role="alert" style={{ margin: '8px 16px 0', padding: '10px 14px', borderRadius: 14, background: 'rgba(201,48,48,0.14)', border: '1px solid rgba(201,48,48,0.25)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body-sm)', color: 'rgba(255,107,107,0.95)' }}>
              {errorMsg}
            </div>
          )}

          {/* Widget grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 160px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {activeWidgets.map(kind => (
                <WidgetCard
                  key={kind} kind={kind} notes={notes}
                  editMode={editMode}
                  onRemove={() => removeWidget(kind)}
                  onClick={() => { if (!editMode) setDetailKind(kind); }}
                />
              ))}
              {editMode && activeWidgets.length < ALL_WIDGET_KINDS.length && (
                <button
                  onClick={() => setShowAddSheet(true)}
                  style={{ aspectRatio: '1 / 1', borderRadius: 20, border: '1.5px dashed rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <span style={{ fontSize: 32, color: 'rgba(255,255,255,0.4)', lineHeight: 1 }}>+</span>
                  <span style={{ fontSize: 'var(--text-caption)', color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--font-sans)' }}>Add widget</span>
                </button>
              )}
            </div>
          </div>

          {/* Edit-mode bottom bar */}
          {editMode && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 24px', paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
              background: 'rgba(8,9,16,0.94)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              borderTop: '1px solid rgba(255,255,255,0.07)',
            }}>
              <button onClick={() => setEditMode(false)} style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.10)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>×</button>
              <span style={{ fontSize: 'var(--text-body)', color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-sans)' }}>Edit widgets</span>
              <button onClick={() => setEditMode(false)} style={{ width: 50, height: 50, borderRadius: '50%', background: '#0DBF5A', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              </button>
            </div>
          )}
        </>
      )}

      {/* Add a post — hidden during edit mode */}
      {!editMode && onAddPost && (
        <div style={{ position: 'absolute', bottom: 'calc(var(--space-6) + env(safe-area-inset-bottom, 0px))', left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
          <button
            onClick={onAddPost}
            style={{
              pointerEvents: 'auto',
              display: 'inline-flex', alignItems: 'center', gap: 10,
              minHeight: 48, padding: '12px 24px',
              borderRadius: 999,
              background: 'linear-gradient(135deg, rgba(144,97,249,0.95) 0%, rgba(110,80,220,0.95) 100%)',
              border: '1px solid rgba(255,255,255,0.18)',
              color: '#fff',
              fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em',
              cursor: 'pointer',
              boxShadow: '0 8px 28px rgba(144,97,249,0.45), 0 2px 6px rgba(0,0,0,0.35)',
            }}
          >
            <span aria-hidden style={{ fontSize: 20, lineHeight: 1, marginTop: -2 }}>+</span>
            Add a post
          </button>
        </div>
      )}

      {recording && <RecordingOverlay onStop={stopRecording} onCancel={cancelRecording} startTime={startTimeRef.current} liveText={liveText} />}

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

      {showAddSheet && <AddWidgetSheet activeWidgets={activeWidgets} onAdd={addWidget} onClose={() => setShowAddSheet(false)} />}
    </div>
  );
}
