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
  /** What the model originally returned, before any user edits. Used to derive the 'Edited' badge. */
  originalText?: string;
}

const KIND_LABEL: Record<AssetKind, string> = {
  'linkedin-post': 'LinkedIn post',
  'twitter-thread': 'Twitter thread',
  'twitter-single': 'Twitter single',
};

const ALL_KINDS: AssetKind[] = ['linkedin-post', 'twitter-thread', 'twitter-single'];

const PLATFORM_GLOW: Record<AssetKind, { rgb: string; accent: string; dur: number; delay: number }> = {
  'linkedin-post':   { rgb: '10,102,194', accent: '#4ea2e8', dur: 7.4, delay: -1.1 },
  'twitter-thread':  { rgb: '29,155,240', accent: '#5cbcf7', dur: 6.6, delay: -3.2 },
  'twitter-single':  { rgb: '29,155,240', accent: '#5cbcf7', dur: 5.9, delay: -0.5 },
};

/**
 * One row in the 'Also generate for…' section. Single-line collapsed: platform
 * label on the left, 'Generate' affordance on the right. Tapping streams the
 * post token-by-token into an inline expansion that mirrors the primary post's
 * pattern (editable text, length indicator, Copy chip, Regenerate). No card,
 * no border — just rows.
 */
function SecondaryGenRow({ kind, transcript, onTextChange }: { kind: AssetKind; transcript: string; onTextChange?: (kind: AssetKind, text: string) => void }) {
  const meta = PLATFORM_GLOW[kind];
  const [text, setText] = useState('');
  const [originalText, setOriginalText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const cancelRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const sizeEditor = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);
  useEffect(() => { if (expanded) sizeEditor(); }, [text, expanded, sizeEditor]);
  useEffect(() => { onTextChange?.(kind, text); }, [text, kind, onTextChange]);

  const runGenerate = useCallback(async (instruction?: string, baseText?: string) => {
    cancelRef.current = false;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setIsStreaming(true);
    setExpanded(true);
    setError(null);
    setText('');
    const kindLabel = KIND_LABEL[kind].toLowerCase();
    const prompt = instruction
      ? [
          `You are rewriting an existing ${kindLabel} based on this instruction: ${instruction}.`,
          `Preserve the author's voice. Output only the rewritten post — no preamble, no explanation.`,
          ``,
          `ORIGINAL POST:`,
          baseText ?? '',
        ].join('\n')
      : transcript;
    try {
      const out = await aiExecute(prompt, {}, kind, undefined, abortRef.current.signal);
      const parts = out.split(/(\s+)/);
      let buf = '';
      for (const p of parts) {
        if (cancelRef.current) break;
        buf += p;
        setText(buf);
        await new Promise(r => setTimeout(r, 18));
      }
      const finalText = cancelRef.current ? buf : out;
      setText(finalText);
      setOriginalText(finalText);
      setIsStreaming(false);
    } catch (e: any) {
      const aborted = e?.name === 'AbortError' || cancelRef.current;
      setIsStreaming(false);
      if (!aborted) setError(e?.message || 'Generation failed');
    }
  }, [kind, transcript]);

  const stop = useCallback(() => {
    cancelRef.current = true;
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const onCopy = async () => {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* blocked */ }
  };

  // Collapsed row: just label on the left, Generate on the right.
  if (!expanded) {
    return (
      <button
        onClick={() => runGenerate()}
        aria-label={`Generate ${KIND_LABEL[kind]}`}
        style={{
          width: '100%',
          padding: '14px 0',
          background: 'transparent', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          color: 'rgba(255,255,255,0.85)',
          fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body)', fontWeight: 500,
          textAlign: 'left',
        }}
      >
        <span>{KIND_LABEL[kind]}</span>
        <span style={{
          color: meta.accent, fontWeight: 500,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          Generate
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </span>
      </button>
    );
  }

  // Expanded row: post text + length indicator + actions, smaller than primary.
  const len = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const isTwitterSingle = kind === 'twitter-single';
  const over = isTwitterSingle && len > 280;
  const near = isTwitterSingle && len > 250;
  const indicatorColor = over ? 'rgba(255,127,127,0.95)' : near ? 'rgba(240,216,160,0.95)' : 'rgba(255,255,255,0.45)';
  const indicatorText = isTwitterSingle ? `${len}/280` : (kind === 'linkedin-post' ? `${words} ${words === 1 ? 'word' : 'words'}` : `${words} ${words === 1 ? 'word' : 'words'} · ${len} chars`);
  const edited = originalText !== '' && text !== originalText;

  return (
    <div style={{ padding: '14px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header row — kind + collapse */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          color: meta.accent, fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body-sm)', fontWeight: 600,
        }}>
          {KIND_LABEL[kind]}
        </span>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {isStreaming && (
            <button
              onClick={stop}
              aria-label="Stop"
              style={{
                background: 'rgba(255,107,107,0.18)', border: '1px solid rgba(255,107,107,0.45)',
                color: 'rgba(255,127,127,0.95)', cursor: 'pointer',
                padding: '4px 10px', borderRadius: 999,
                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-caption)', fontWeight: 600,
              }}
            >
              Stop
            </button>
          )}
          <button
            onClick={() => { stop(); setExpanded(false); }}
            aria-label="Hide"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.45)',
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-caption)', fontWeight: 500,
              padding: '4px 6px',
            }}
          >
            Hide
          </button>
        </div>
      </div>

      {/* Editable post text */}
      <textarea
        ref={editorRef}
        value={text}
        onChange={e => { setText(e.target.value); sizeEditor(); }}
        aria-label={`${KIND_LABEL[kind]} text`}
        spellCheck
        className="note-post-editor"
        style={{
          display: 'block', width: '100%',
          margin: 0, padding: 0,
          background: 'transparent', border: 'none', outline: 'none', resize: 'none', overflow: 'hidden',
          fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body)', fontWeight: 400, lineHeight: 1.55,
          color: 'rgba(255,255,255,0.92)',
          wordBreak: 'break-word', overflowWrap: 'anywhere',
        }}
      />

      {/* Length indicator + Edited badge */}
      {text && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          fontFamily: 'var(--font-mono)', fontSize: 'var(--text-caption)', fontWeight: 500,
          letterSpacing: '0.04em',
        }}>
          <span style={{ color: indicatorColor }}>{indicatorText}</span>
          {edited && (
            <span style={{
              color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-caption)', fontWeight: 500, letterSpacing: 0,
            }}>
              Edited
            </span>
          )}
        </div>
      )}

      {/* Actions: Copy + Regenerate (rerolls with the same instruction approach) */}
      {text && !isStreaming && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={onCopy}
            aria-label={copied ? 'Copied' : 'Copy'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 999,
              background: copied ? `rgba(${meta.rgb},0.30)` : `rgba(${meta.rgb},0.18)`,
              border: `1px solid rgba(${meta.rgb},0.45)`,
              color: meta.accent,
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body-sm)', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {copied ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12"/></svg>
                Copied
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copy
              </>
            )}
          </button>
          <button
            onClick={() => runGenerate('Rewrite from a different angle on the same idea.', text)}
            aria-label="Regenerate"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 999,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
              color: 'rgba(255,255,255,0.75)',
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body-sm)', fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/>
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>
            </svg>
            Regenerate
          </button>
        </div>
      )}

      {error && (
        <div role="alert" style={{
          fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body-sm)',
          color: 'rgba(255,168,168,0.95)',
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

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
          <div style={{ fontSize: 'var(--text-tag)', fontFamily: 'var(--font-sans)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.02em' }}>
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
// Platform color tint used by NoteCard so each generated-content note carries a
// faint diagonal hint of its destination platform — same vocabulary as the
// generated-output card on the note sheet.
const NOTE_TINT: Record<string, string> = {
  'linkedin-post':  '10,102,194',
  'twitter-thread': '29,155,240',
  'twitter-single': '29,155,240',
};

function NoteCard({ note, onOpen }: { note: VoiceNote; onOpen: () => void }) {
  const isTranscribing = note.status === 'transcribing';
  const isAudioOnly = note.status === 'ready' && !note.transcript;
  const isError = note.status === 'error';
  const tintRgb = note.lastGeneration?.kind ? NOTE_TINT[note.lastGeneration.kind] : null;

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
      className="voice-note-card reduced-motion-safe"
      style={{
        width: '100%', textAlign: 'left',
        position: 'relative', overflow: 'hidden',
        background: tintRgb
          ? `linear-gradient(155deg, rgba(${tintRgb},0.08) 0%, #1a1c26 55%, #0d0e16 100%)`
          : 'linear-gradient(155deg, #1a1c26 0%, #0d0e16 100%)',
        border: `1px solid ${tintRgb ? `rgba(${tintRgb},0.20)` : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 22,
        padding: 'var(--space-4) var(--space-5)',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto', alignItems: 'center',
        columnGap: 'var(--space-4)', rowGap: 4, minHeight: 80,
        cursor: isTranscribing ? 'default' : 'pointer',
        opacity: isTranscribing ? 0.7 : 1, minWidth: 0, boxSizing: 'border-box',
        boxShadow: tintRgb
          ? `0 14px 40px rgba(${tintRgb},0.14), 0 2px 6px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)`
          : '0 14px 40px rgba(0,0,0,0.30), 0 2px 6px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.05)',
        transition: 'border-color 220ms, box-shadow 220ms, filter 220ms',
      }}
    >
      {/* Status dot — 8×8, pinned left spanning both rows */}
      <span aria-hidden style={{
        gridRow: '1 / span 2', width: 8, height: 8, borderRadius: 'var(--radius-full)',
        background: pillRoleMap[pill?.role ?? 'idle'].dot, flexShrink: 0, marginTop: 8,
        position: 'relative', zIndex: 1,
      }} />

      {/* Title */}
      <span style={{
        position: 'relative', zIndex: 1,
        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-heading)', fontWeight: 500,
        lineHeight: '22px', color: 'rgba(255,255,255,0.92)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
      }}>
        {displayTitle}
      </span>

      {/* Status pill */}
      {pill ? (
        <span style={{
          position: 'relative', zIndex: 1,
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

      {/* Metadata */}
      <span style={{
        position: 'relative', zIndex: 1,
        gridColumn: '2 / span 2',
        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body-sm)', fontWeight: 400, lineHeight: '20px',
        color: 'rgba(255,255,255,0.55)',
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
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const [gen, setGen] = useState<Generation | null>(() => note.lastGeneration
    ? { kind: note.lastGeneration.kind, text: note.lastGeneration.text, originalText: note.lastGeneration.text, loading: false }
    : null);
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [editHintDismissed, setEditHintDismissed] = useState(() => sessionStorage.getItem('note-edit-hint-seen') === '1');
  // Steerable regenerate
  const [chooserOpen, setChooserOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  type Version = { kind: AssetKind; text: string; createdAt: string };
  const [versions, setVersions] = useState<Version[]>([]);
  const [versionsOpen, setVersionsOpen] = useState(false);
  // Transcript editing + stale-edit banner
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [transcriptDraft, setTranscriptDraft] = useState(note.transcript ?? '');
  const [showStaleBanner, setShowStaleBanner] = useState(false);
  // Delete confirmation
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Track secondary gen text per kind so 'Export all' can combine everything.
  const [secondaryGens, setSecondaryGens] = useState<Partial<Record<AssetKind, string>>>({});
  const [exportToast, setExportToast] = useState<string | null>(null);
  const transcriptEditorRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const versionsRef = useRef<HTMLDivElement>(null);
  const postEditorRef = useRef<HTMLTextAreaElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);
  const streamCancelRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
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

  // Keep the title textarea sized to its content so long titles wrap and stay
  // fully visible (no horizontal clipping like a single-line <input> would do).
  const sizeTitle = useCallback(() => {
    const el = titleInputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  useEffect(() => {
    if (isEditingTitle) {
      const id = setTimeout(() => {
        const el = titleInputRef.current;
        if (el) { el.focus(); el.select(); sizeTitle(); }
      }, 0);
      return () => clearTimeout(id);
    }
  }, [isEditingTitle, sizeTitle]);

  // Close the overflow menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

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
      setGen({ kind, text: out, originalText: out, loading: false });
      updateNote(note.id, { lastGeneration: { kind, text: out, createdAt: new Date().toISOString() } });
    } catch (e: any) {
      setGen({ kind, text: '', loading: false, error: e?.message || 'Generation failed' });
    }
  }, [note.id, note.transcript, updateNote]);

  // Resize the editable post textarea to its content so the post reads as flowing
  // page text rather than a constrained input.
  const sizePostEditor = useCallback(() => {
    const el = postEditorRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  // Auto-save the generated post text whenever it changes (debounced 400ms).
  useEffect(() => {
    if (!gen || gen.loading || gen.error || !gen.text) return;
    if (gen.text === note.lastGeneration?.text && gen.kind === note.lastGeneration?.kind) return;
    const t = setTimeout(() => {
      updateNote(note.id, {
        lastGeneration: {
          kind: gen.kind,
          text: gen.text,
          createdAt: note.lastGeneration?.createdAt ?? new Date().toISOString(),
        },
      });
    }, 400);
    return () => clearTimeout(t);
  }, [gen, note.id, note.lastGeneration, updateNote]);

  // Re-size the post editor whenever its text changes (including after regenerate).
  useEffect(() => { sizePostEditor(); }, [gen?.text, sizePostEditor]);

  const dismissEditHint = useCallback(() => {
    if (editHintDismissed) return;
    sessionStorage.setItem('note-edit-hint-seen', '1');
    setEditHintDismissed(true);
  }, [editHintDismissed]);

  // Close the versions dropdown on outside click / Escape.
  useEffect(() => {
    if (!versionsOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (versionsRef.current && !versionsRef.current.contains(e.target as Node)) setVersionsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setVersionsOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [versionsOpen]);

  // Stop any in-flight stream cleanly.
  const stopStream = useCallback(() => {
    streamCancelRef.current = true;
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  // Steerable regenerate: builds a rewrite prompt with the user's instruction,
  // saves the current text as a version, then streams the new text in token by
  // token (whitespace-preserving). Stop button aborts cleanly and keeps whatever
  // has streamed so far.
  const regenerateWith = useCallback(async (instruction: string) => {
    if (!gen || !gen.text) return;
    const currentKind = gen.kind;
    const currentText = gen.text;

    // Push current state to versions
    setVersions(v => [...v, { kind: currentKind, text: currentText, createdAt: new Date().toISOString() }]);
    setChooserOpen(false);
    setCustomMode(false);
    setCustomText('');

    streamCancelRef.current = false;
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsStreaming(true);
    setGen(g => g ? { ...g, text: '', loading: true, error: undefined } : g);

    const kindLabel = KIND_LABEL[currentKind].toLowerCase();
    const prompt = [
      `You are rewriting an existing ${kindLabel} based on this instruction: ${instruction}.`,
      `Preserve the author's voice. Output only the rewritten post — no preamble, no explanation.`,
      ``,
      `ORIGINAL POST:`,
      currentText,
    ].join('\n');

    try {
      const out = await aiExecute(prompt, {}, currentKind, undefined, abortRef.current.signal);
      // Token-by-token reveal (whitespace-preserving split)
      const parts = out.split(/(\s+)/);
      let buf = '';
      for (const p of parts) {
        if (streamCancelRef.current) break;
        buf += p;
        setGen(g => g ? { ...g, text: buf, loading: false, error: undefined } : g);
        await new Promise(r => setTimeout(r, 18));
      }
      const finalText = streamCancelRef.current ? buf : out;
      setGen(g => g ? { ...g, text: finalText, originalText: finalText, loading: false } : g);
      setIsStreaming(false);
      updateNote(note.id, {
        lastGeneration: { kind: currentKind, text: finalText, createdAt: new Date().toISOString() },
      });
    } catch (e: any) {
      const aborted = e?.name === 'AbortError' || streamCancelRef.current;
      setIsStreaming(false);
      if (aborted) {
        // Keep partial output on abort; turn off loading
        setGen(g => g ? { ...g, loading: false } : g);
      } else {
        setGen(g => g ? { ...g, loading: false, error: e?.message || 'Regeneration failed' } : g);
      }
    }
  }, [gen, note.id, updateNote]);

  const restoreVersion = useCallback((idx: number) => {
    const target = versions[idx];
    if (!target || !gen) return;
    // Save current as another version so the restore is reversible
    setVersions(v => [...v, { kind: gen.kind, text: gen.text, createdAt: new Date().toISOString() }]);
    setGen(g => g ? { ...g, kind: target.kind, text: target.text, originalText: target.text, loading: false, error: undefined } : g);
    setVersionsOpen(false);
    updateNote(note.id, {
      lastGeneration: { kind: target.kind, text: target.text, createdAt: new Date().toISOString() },
    });
  }, [versions, gen, note.id, updateNote]);

  // When custom mode opens, focus the input.
  useEffect(() => {
    if (customMode) {
      const id = setTimeout(() => customInputRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [customMode]);

  // Auto-grow + focus the transcript editor when it opens.
  const sizeTranscriptEditor = useCallback(() => {
    const el = transcriptEditorRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);
  useEffect(() => {
    if (!isEditingTranscript) return;
    setTranscriptDraft(note.transcript ?? '');
    setShowTranscript(true);
    const id = setTimeout(() => {
      const el = transcriptEditorRef.current;
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); sizeTranscriptEditor(); }
    }, 0);
    return () => clearTimeout(id);
  }, [isEditingTranscript, note.transcript, sizeTranscriptEditor]);

  const saveTranscript = useCallback(() => {
    const t = transcriptDraft.trim();
    if (!t) { setIsEditingTranscript(false); return; }
    if (t === note.transcript) { setIsEditingTranscript(false); return; }
    updateNote(note.id, { transcript: t });
    setIsEditingTranscript(false);
    setShowStaleBanner(true);
  }, [transcriptDraft, note.id, note.transcript, updateNote]);

  const cancelTranscriptEdit = useCallback(() => {
    setTranscriptDraft(note.transcript ?? '');
    setIsEditingTranscript(false);
  }, [note.transcript]);

  const regenerateAllPosts = useCallback(async () => {
    setShowStaleBanner(false);
    if (gen?.kind) {
      await generate(gen.kind);
    }
  }, [gen?.kind, generate]);

  const exportAllGenerated = useCallback(async () => {
    const blocks: string[] = [];
    if (gen?.text) blocks.push(`${KIND_LABEL[gen.kind]}\n\n${gen.text}`);
    for (const kind of ALL_KINDS) {
      if (gen && kind === gen.kind) continue;
      const t = secondaryGens[kind];
      if (t) blocks.push(`${KIND_LABEL[kind]}\n\n${t}`);
    }
    if (blocks.length === 0) {
      setExportToast('Nothing to export yet');
      setTimeout(() => setExportToast(null), 1800);
      return;
    }
    const combined = blocks.join('\n\n---\n\n');
    try {
      await navigator.clipboard.writeText(combined);
      setExportToast('Copied all generated text');
    } catch {
      setExportToast('Copy blocked by browser');
    }
    setTimeout(() => setExportToast(null), 1800);
  }, [gen, secondaryGens]);

  const formatVersionTime = (iso: string) => {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return 'Just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const copy = async () => {
    if (!gen?.text) return;
    try { await navigator.clipboard.writeText(gen.text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* blocked */ }
  };

  const tagStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)', fontSize: 'var(--text-caption)', fontWeight: 500, lineHeight: 1,
    letterSpacing: '0.02em', color: 'rgba(255,255,255,0.7)',
  };

  const glassCard: React.CSSProperties = {
    position: 'relative',
    borderRadius: 22,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'linear-gradient(155deg, #1a1c26 0%, #0d0e16 100%)',
    boxShadow: '0 18px 48px rgba(0,0,0,0.40), 0 2px 6px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)',
    overflow: 'hidden',
    color: 'rgba(255,255,255,0.92)',
  };

  const hasGen = !!(gen?.text && !gen.loading && !gen.error);
  const platformLabel = gen ? KIND_LABEL[gen.kind].split(' ')[0] : null;
  const platformMeta = gen ? PLATFORM_GLOW[gen.kind] : null;
  const platformRgb = platformMeta?.rgb ?? '144,97,249';
  const platformAccent = platformMeta?.accent ?? '#a78bfa';

  const iconBtnStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.85)', cursor: 'pointer',
    width: 40, height: 40, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(12px)',
  };
  const menuItemStyle: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'left',
    padding: '10px 12px', borderRadius: 10,
    background: 'transparent', border: 'none', cursor: 'pointer',
    fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body)', fontWeight: 500,
    color: 'rgba(255,255,255,0.92)',
  };

  return createPortal(
    <div
      ref={sheetRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'linear-gradient(180deg, #0a0b14 0%, #060710 60%, #04050c 100%)',
        display: 'flex', flexDirection: 'column', minWidth: 0,
        overflow: 'hidden',
        color: 'rgba(255,255,255,0.92)',
      }}
    >
      {/* Ambient page-level breathing orbs */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        {[
          { color: '144,97,249', top: '8%',  left: '-12%', size: 320, dur: 12.5, delay: -2.1 },
          { color: '29,155,240', top: '36%', left: '70%',  size: 280, dur: 10.2, delay: -5.6 },
          { color: '13,191,90',  top: '70%', left: '-8%',  size: 300, dur: 14.8, delay: -8.3 },
          { color: '255,150,18', top: '60%', left: '60%',  size: 240, dur: 11.4, delay: -1.4 },
        ].map((o, i) => (
          <div key={i} className="widget-glow" style={{
            position: 'absolute', top: o.top, left: o.left, width: o.size, height: o.size, borderRadius: '50%',
            background: `radial-gradient(circle, rgba(${o.color},0.32) 0%, rgba(${o.color},0.10) 38%, rgba(${o.color},0) 70%)`,
            filter: 'blur(20px)',
            animationName: 'widget-breathe',
            animationDuration: `${o.dur}s`,
            animationDelay: `${o.delay}s`,
            animationTimingFunction: 'cubic-bezier(0.45, 0.05, 0.55, 0.95)',
            animationIterationCount: 'infinite',
            willChange: 'transform, opacity',
          }} />
        ))}
      </div>

      {/* Top nav row — back chevron + overflow menu */}
      <div style={{
        position: 'relative', zIndex: 2,
        flexShrink: 0,
        padding: 'calc(var(--space-3) + env(safe-area-inset-top, 0px)) var(--space-3) 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        minHeight: 44,
      }}>
        <button ref={closeBtnRef} onClick={close} aria-label="Close note" style={iconBtnStyle}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            style={iconBtnStyle}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <circle cx="5" cy="12" r="1.8"/>
              <circle cx="12" cy="12" r="1.8"/>
              <circle cx="19" cy="12" r="1.8"/>
            </svg>
          </button>
          {menuOpen && (
            <div role="menu" style={{
              position: 'absolute', top: 48, right: 0, minWidth: 220,
              background: 'linear-gradient(155deg, #1a1c26 0%, #0d0e16 100%)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 14,
              padding: 6,
              boxShadow: '0 18px 48px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.06)',
              zIndex: 5,
            }}>
              <button
                role="menuitem"
                onClick={() => { setMenuOpen(false); setIsEditingTitle(true); }}
                style={menuItemStyle}
              >
                Edit title
              </button>
              {note.transcript && (
                <button
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); setIsEditingTranscript(true); }}
                  style={menuItemStyle}
                >
                  Edit transcript
                </button>
              )}
              <button
                role="menuitem"
                onClick={() => { setMenuOpen(false); exportAllGenerated(); }}
                style={menuItemStyle}
              >
                Export all generated text
              </button>
              {isError && (
                <button
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); onRerecord(); onClose(); }}
                  style={menuItemStyle}
                >
                  Re-record
                </button>
              )}
              <div aria-hidden style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
              <button
                role="menuitem"
                onClick={() => { setMenuOpen(false); setConfirmingDelete(true); }}
                style={{ ...menuItemStyle, color: 'rgba(255,127,127,0.95)' }}
              >
                Delete this post
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Heading + platform tag */}
      <div style={{
        position: 'relative', zIndex: 1,
        flexShrink: 0,
        padding: 'var(--space-2) var(--space-4) var(--space-4)',
      }}>
        <label htmlFor={titleId} className="sr-only">Note title</label>
        {isEditingTitle ? (
          <textarea
            ref={titleInputRef}
            id={titleId}
            className="note-sheet-title"
            rows={1}
            value={editTitle}
            onChange={e => { setEditTitle(e.target.value); sizeTitle(); }}
            onBlur={finishTitleEdit}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); }
              else if (e.key === 'Escape') { setEditTitle(note.title); setIsEditingTitle(false); }
            }}
            aria-label="Note title"
            style={{
              display: 'block', width: '100%', margin: 0, padding: 0,
              background: 'transparent', border: 'none',
              resize: 'none', overflow: 'hidden',
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-title)', fontWeight: 700, lineHeight: 1.2,
              letterSpacing: '-0.02em', color: '#fff',
              caretColor: 'var(--color-accent, #0DBF5A)',
              wordBreak: 'break-word', overflowWrap: 'anywhere',
            }}
          />
        ) : (
          <h1
            id={titleId}
            className="note-sheet-title"
            style={{
              margin: 0, padding: 0,
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-title)', fontWeight: 700, lineHeight: 1.2,
              letterSpacing: '-0.02em', color: '#fff',
              wordBreak: 'break-word',
            }}
          >
            {editTitle}
          </h1>
        )}
        {platformLabel && (
          <span style={{
            display: 'inline-block', marginTop: 10,
            padding: '4px 12px', borderRadius: 999,
            background: `rgba(${platformRgb},0.15)`,
            border: `1px solid rgba(${platformRgb},0.40)`,
            color: platformAccent,
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-caption)', fontWeight: 600,
            letterSpacing: '0.01em',
          }}>
            {platformLabel}
          </span>
        )}
      </div>

      {/* Stale-edit banner — shown after the user saves a transcript edit. */}
      {showStaleBanner && (
        <div role="status" style={{
          position: 'relative', zIndex: 1,
          margin: '0 var(--space-4) var(--space-4)',
          padding: '12px 14px', borderRadius: 14,
          background: 'linear-gradient(155deg, rgba(240,216,160,0.12) 0%, #1a1c26 65%, #0d0e16 100%)',
          border: '1px solid rgba(240,216,160,0.30)',
          display: 'flex', alignItems: 'center', gap: 10,
          fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body-sm)',
          color: 'rgba(255,255,255,0.85)',
        }}>
          <div style={{ flex: 1 }}>Transcript edited. Regenerate posts?</div>
          <button
            onClick={regenerateAllPosts}
            style={{
              background: 'rgba(240,216,160,0.22)', border: '1px solid rgba(240,216,160,0.50)',
              color: 'rgba(255,235,180,0.95)', cursor: 'pointer',
              padding: '6px 12px', borderRadius: 999,
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body-sm)', fontWeight: 600,
            }}
          >
            Regenerate all
          </button>
          <button
            onClick={() => setShowStaleBanner(false)}
            aria-label="Dismiss banner"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.55)',
              width: 28, height: 28, borderRadius: '50%',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* Body */}
      <div style={{
        position: 'relative', zIndex: 1,
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        {isError ? (
          <div role="alert" style={{
            margin: '0 var(--space-4)',
            background: 'linear-gradient(155deg, rgba(201,48,48,0.18) 0%, #1a1c26 55%, #0d0e16 100%)',
            border: '1px solid rgba(255,107,107,0.25)',
            borderRadius: 22,
            padding: 'var(--space-4)',
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body)', fontWeight: 400, lineHeight: 1.55,
            color: 'rgba(255,168,168,0.95)', wordBreak: 'break-word',
            display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
          }}>
            <div>{note.errorReason || 'Transcription failed.'}</div>
          </div>
        ) : gen?.loading ? (
          /* Generating skeleton — no card, sits on the page like the final post will */
          <div style={{ padding: '0 var(--space-4)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[100, 92, 96, 80, 88].map((w, i) => <div key={i} className="skeleton-bar-dark" style={{ height: 16, width: `${w}%`, borderRadius: 8, animationDelay: `${i * 0.1}s` }} />)}
          </div>
        ) : hasGen && gen ? (
          <>
            {/* Generated post — editable in place, no card, no border. Tap drops a cursor. */}
            <textarea
              ref={postEditorRef}
              value={gen.text}
              onChange={e => { setGen(g => g ? { ...g, text: e.target.value } : g); sizePostEditor(); }}
              onFocus={dismissEditHint}
              aria-label="Generated post — tap to edit"
              spellCheck
              className="note-post-editor"
              style={{
                display: 'block', width: '100%',
                margin: 0, padding: '0 var(--space-4)',
                background: 'transparent', border: 'none', outline: 'none', resize: 'none', overflow: 'hidden',
                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-title-sm)', fontWeight: 400, lineHeight: 1.6,
                color: 'rgba(255,255,255,0.92)',
                wordBreak: 'break-word', overflowWrap: 'anywhere',
                boxSizing: 'border-box',
              }}
            />

            {/* Length indicator + Edited badge */}
            {(() => {
              const len = gen.text.length;
              const words = gen.text.trim() ? gen.text.trim().split(/\s+/).length : 0;
              const isTwitterSingle = gen.kind === 'twitter-single';
              const over = isTwitterSingle && len > 280;
              const near = isTwitterSingle && len > 250;
              const indicatorColor = over ? 'rgba(255,127,127,0.95)' : near ? 'rgba(240,216,160,0.95)' : 'rgba(255,255,255,0.45)';
              const indicatorText = isTwitterSingle ? `${len}/280` : (gen.kind === 'linkedin-post' ? `${words} ${words === 1 ? 'word' : 'words'}` : `${words} ${words === 1 ? 'word' : 'words'} · ${len} chars`);
              const edited = gen.originalText !== undefined && gen.text !== gen.originalText;
              return (
                <div style={{
                  padding: 'var(--space-3) var(--space-4) 0',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  fontFamily: 'var(--font-mono)', fontSize: 'var(--text-caption)', fontWeight: 500,
                  letterSpacing: '0.04em',
                }}>
                  <span style={{ color: indicatorColor }}>{indicatorText}</span>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                    {edited && (
                      <span aria-live="polite" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        color: 'rgba(255,255,255,0.55)',
                        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-caption)', fontWeight: 500, letterSpacing: 0,
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/>
                        </svg>
                        Edited
                      </span>
                    )}
                    {versions.length > 0 && (
                      <div ref={versionsRef} style={{ position: 'relative' }}>
                        <button
                          onClick={() => setVersionsOpen(o => !o)}
                          aria-haspopup="menu"
                          aria-expanded={versionsOpen}
                          aria-label={`Version ${versions.length + 1} of ${versions.length + 1}. View previous versions.`}
                          style={{
                            background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px',
                            fontFamily: 'var(--font-mono)', fontSize: 'var(--text-caption)', fontWeight: 600,
                            color: 'rgba(255,255,255,0.65)', letterSpacing: '0.04em',
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          v{versions.length + 1}
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transform: versionsOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms' }}>
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                        </button>
                        {versionsOpen && (
                          <div role="menu" style={{
                            position: 'absolute', top: 28, right: 0, minWidth: 240, maxWidth: 320,
                            background: 'linear-gradient(155deg, #1a1c26 0%, #0d0e16 100%)',
                            border: '1px solid rgba(255,255,255,0.10)',
                            borderRadius: 14,
                            padding: 6,
                            boxShadow: '0 18px 48px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
                            zIndex: 5,
                          }}>
                            {versions.map((v, i) => (
                              <button
                                key={i}
                                role="menuitem"
                                onClick={() => restoreVersion(i)}
                                style={{
                                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
                                  width: '100%', textAlign: 'left',
                                  padding: '10px 12px', borderRadius: 10,
                                  background: 'transparent', border: 'none', cursor: 'pointer',
                                }}
                              >
                                <span style={{
                                  fontFamily: 'var(--font-mono)', fontSize: 'var(--text-caption)', fontWeight: 600,
                                  color: 'rgba(255,255,255,0.85)', letterSpacing: '0.04em',
                                }}>
                                  v{i + 1} <span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 500, marginLeft: 6 }}>{formatVersionTime(v.createdAt)}</span>
                                </span>
                                <span style={{
                                  fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body-sm)', fontWeight: 400, lineHeight: 1.35,
                                  color: 'rgba(255,255,255,0.65)',
                                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden', textOverflow: 'ellipsis',
                                }}>
                                  {v.text}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* One-time 'Tap to edit' hint, dismisses on first focus */}
            {!editHintDismissed && (
              <div aria-hidden style={{
                padding: 'var(--space-2) var(--space-4) 0',
                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-caption)', fontWeight: 500,
                color: 'rgba(255,255,255,0.40)',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/>
                </svg>
                Tap the post to edit
              </div>
            )}

            {/* Dominant Copy button — full-width */}
            <div style={{ padding: 'var(--space-5) var(--space-4) 0' }}>
              <button
                onClick={copy}
                aria-label={copied ? 'Copied to clipboard' : 'Copy generated text'}
                className="reduced-motion-safe"
                style={{
                  width: '100%', minHeight: 56,
                  padding: '14px 24px', borderRadius: 999,
                  background: copied
                    ? `linear-gradient(135deg, rgba(${platformRgb},0.55) 0%, rgba(${platformRgb},0.85) 100%)`
                    : `linear-gradient(135deg, rgba(${platformRgb},0.95) 0%, rgba(${platformRgb},0.80) 100%)`,
                  border: '1px solid rgba(255,255,255,0.18)',
                  color: '#fff',
                  fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body-lg)', fontWeight: 600, letterSpacing: '-0.01em',
                  cursor: 'pointer',
                  boxShadow: `0 14px 36px rgba(${platformRgb},0.45), inset 0 1px 0 rgba(255,255,255,0.14)`,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'background 220ms',
                }}
              >
                {copied ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12"/></svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <rect x="9" y="9" width="13" height="13" rx="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    Copy
                  </>
                )}
              </button>
            </div>

            {/* Steerable regenerate: chooser + custom + Stop */}
            <div style={{ padding: 'var(--space-3) var(--space-4) 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}>
              {isStreaming ? (
                <button
                  onClick={stopStream}
                  aria-label="Stop regenerating"
                  style={{
                    background: 'rgba(255,107,107,0.18)', border: '1px solid rgba(255,107,107,0.45)',
                    color: 'rgba(255,127,127,0.95)', cursor: 'pointer',
                    padding: '8px 16px', borderRadius: 999,
                    fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body-sm)', fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <rect x="6" y="6" width="12" height="12" rx="1"/>
                  </svg>
                  Stop
                </button>
              ) : (
                <button
                  onClick={() => { setChooserOpen(o => !o); setCustomMode(false); }}
                  aria-haspopup="menu"
                  aria-expanded={chooserOpen}
                  aria-label="Regenerate options"
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body-sm)', fontWeight: 500,
                    color: 'rgba(255,255,255,0.55)',
                    padding: '8px 12px',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/>
                    <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>
                  </svg>
                  Regenerate
                </button>
              )}

              {chooserOpen && !isStreaming && (
                <div role="menu" style={{
                  display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8,
                  width: '100%',
                }}>
                  {[
                    { id: 'shorter',     label: 'Shorter',         instr: 'Make it shorter and tighter while preserving the core message.' },
                    { id: 'longer',      label: 'Longer',          instr: 'Expand it with more substance and supporting detail. Do not pad with filler.' },
                    { id: 'casual',      label: 'More casual',     instr: 'Rewrite in a more casual, conversational tone — looser, less formal.' },
                    { id: 'direct',      label: 'More direct',     instr: 'Rewrite to be more direct and assertive. Cut hedging and softeners.' },
                    { id: 'angle',       label: 'Different angle', instr: 'Rewrite from a different angle or perspective on the same idea. Keep the platform conventions.' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      role="menuitem"
                      onClick={() => regenerateWith(opt.instr)}
                      className="reduced-motion-safe"
                      style={{
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
                        color: 'rgba(255,255,255,0.85)', cursor: 'pointer',
                        padding: '7px 14px', borderRadius: 999,
                        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body-sm)', fontWeight: 500,
                        transition: 'background 180ms, border-color 180ms',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                  <button
                    role="menuitem"
                    onClick={() => setCustomMode(c => !c)}
                    className="reduced-motion-safe"
                    style={{
                      background: customMode ? 'rgba(144,97,249,0.20)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${customMode ? 'rgba(144,97,249,0.50)' : 'rgba(255,255,255,0.10)'}`,
                      color: customMode ? '#c4b5fd' : 'rgba(255,255,255,0.85)',
                      cursor: 'pointer',
                      padding: '7px 14px', borderRadius: 999,
                      fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body-sm)', fontWeight: 500,
                    }}
                  >
                    Custom…
                  </button>
                </div>
              )}

              {chooserOpen && customMode && !isStreaming && (
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    const txt = customText.trim();
                    if (!txt) return;
                    regenerateWith(txt);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 6px 6px 14px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
                    borderRadius: 999,
                  }}
                >
                  <input
                    ref={customInputRef}
                    value={customText}
                    onChange={e => setCustomText(e.target.value)}
                    placeholder="What should change?"
                    aria-label="Custom regeneration instruction"
                    style={{
                      flex: 1, minWidth: 0,
                      background: 'transparent', border: 'none', outline: 'none',
                      color: '#fff',
                      fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body-sm)',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!customText.trim()}
                    aria-label="Send custom instruction"
                    style={{
                      background: customText.trim() ? `linear-gradient(135deg, rgba(${platformRgb},0.95) 0%, rgba(${platformRgb},0.80) 100%)` : 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#fff', cursor: customText.trim() ? 'pointer' : 'not-allowed',
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      opacity: customText.trim() ? 1 : 0.4,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </button>
                </form>
              )}
            </div>
          </>
        ) : note.transcript ? (
          /* No generation yet — show platform picker so the user can choose */
          <section aria-labelledby={`${titleId}-create`} style={{ padding: '0 var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div id={`${titleId}-create`} style={{ ...tagStyle, paddingLeft: 4 }}>Create asset</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-3)' }}>
              {(['linkedin-post', 'twitter-thread', 'twitter-single'] as const).map(k => {
                const isActive = gen?.kind === k;
                const isLoadingThis = !!(isActive && gen?.loading);
                const isSaved = note.lastGeneration?.kind === k;
                const meta = PLATFORM_GLOW[k];
                return (
                  <button
                    key={k}
                    onClick={() => generate(k)}
                    disabled={isLoadingThis}
                    aria-label={`Generate ${KIND_LABEL[k]}${isSaved ? ' (previously saved)' : ''}`}
                    className="reduced-motion-safe"
                    style={{
                      ...glassCard,
                      width: '100%', minHeight: 60, padding: 'var(--space-4)',
                      borderRadius: 18,
                      border: `1px solid ${isActive ? `rgba(${meta.rgb},0.55)` : 'rgba(255,255,255,0.08)'}`,
                      background: isActive
                        ? `linear-gradient(135deg, rgba(${meta.rgb},0.28) 0%, #1a1c26 75%)`
                        : `linear-gradient(155deg, rgba(${meta.rgb},0.07) 0%, #1a1c26 50%, #0d0e16 100%)`,
                      boxShadow: isActive
                        ? `0 18px 40px rgba(${meta.rgb},0.30), 0 2px 6px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.10)`
                        : '0 10px 28px rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.05)',
                      cursor: isLoadingThis ? 'progress' : 'pointer',
                      fontFamily: 'var(--font-sans)', fontSize: 'var(--text-heading)', fontWeight: 600, lineHeight: 1.2,
                      color: '#fff', textAlign: 'left',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)',
                      transition: 'box-shadow 220ms, border-color 220ms, background 220ms',
                    }}
                  >
                    <span style={{ position: 'relative', zIndex: 1 }}>{KIND_LABEL[k]}</span>
                    <span style={{ position: 'relative', zIndex: 1, fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body-sm)', fontWeight: 500, color: isActive ? meta.accent : 'rgba(255,255,255,0.55)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {isLoadingThis ? (
                        'Generating…'
                      ) : isSaved ? (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12"/></svg>
                          Generated
                        </>
                      ) : (
                        'Generate'
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* 'Also generate for…' — secondary platforms below the fold. Only when a
            primary post exists and we have a transcript to feed new generations. */}
        {hasGen && gen && note.transcript && (
          <>
            <div aria-hidden style={{ height: 72, flexShrink: 0 }} />
            <div style={{ padding: '0 var(--space-4)' }}>
              <div style={{
                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-caption)', fontWeight: 500,
                color: 'rgba(255,255,255,0.5)',
                marginBottom: 'var(--space-2)',
                letterSpacing: '0.01em',
              }}>
                Also generate for…
              </div>
              {ALL_KINDS.filter(k => k !== gen.kind).map(k => (
                <SecondaryGenRow key={k} kind={k} transcript={note.transcript} onTextChange={(kk, t) => setSecondaryGens(s => ({ ...s, [kk]: t }))} />
              ))}
            </div>
          </>
        )}

        {/* Spacer pushes the View transcript affordance to the bottom of the visible area */}
        <div style={{ flex: 1, minHeight: 24 }} />

        {/* View transcript — small affordance at the very bottom */}
        {note.transcript && (
          <div style={{
            padding: 'var(--space-4) var(--space-4) calc(var(--space-4) + env(safe-area-inset-bottom, 0px))',
            display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
          }}>
            {showTranscript && (
              <div style={{
                background: 'linear-gradient(155deg, #1a1c26 0%, #0d0e16 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 18,
                padding: 'var(--space-4)',
                boxShadow: '0 10px 28px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.05)',
                display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
              }}>
                {isEditingTranscript ? (
                  <textarea
                    ref={transcriptEditorRef}
                    value={transcriptDraft}
                    onChange={e => { setTranscriptDraft(e.target.value); sizeTranscriptEditor(); }}
                    onKeyDown={e => {
                      if (e.key === 'Escape') { e.preventDefault(); cancelTranscriptEdit(); }
                      else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveTranscript(); }
                    }}
                    aria-label="Edit transcript"
                    spellCheck
                    className="note-post-editor"
                    style={{
                      display: 'block', width: '100%', margin: 0, padding: 0,
                      background: 'transparent', border: 'none', outline: 'none', resize: 'none', overflow: 'hidden',
                      fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body)', lineHeight: 1.55,
                      color: 'rgba(255,255,255,0.92)',
                      wordBreak: 'break-word', overflowWrap: 'anywhere',
                    }}
                  />
                ) : (
                  <div style={{
                    fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body)', lineHeight: 1.55,
                    color: 'rgba(255,255,255,0.85)',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere',
                  }}>
                    {note.transcript}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                  {isEditingTranscript ? (
                    <>
                      <button
                        onClick={cancelTranscriptEdit}
                        style={{
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          color: 'rgba(255,255,255,0.55)',
                          fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body-sm)', fontWeight: 500,
                          padding: '6px 10px',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveTranscript}
                        style={{
                          background: 'rgba(13,191,90,0.22)', border: '1px solid rgba(13,191,90,0.50)',
                          color: 'rgba(80,220,140,0.95)', cursor: 'pointer',
                          padding: '6px 14px', borderRadius: 999,
                          fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body-sm)', fontWeight: 600,
                        }}
                      >
                        Save
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditingTranscript(true)}
                      aria-label="Edit transcript"
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: 'rgba(255,255,255,0.65)',
                        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body-sm)', fontWeight: 500,
                        padding: '6px 10px',
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/>
                      </svg>
                      Edit transcript
                    </button>
                  )}
                </div>
              </div>
            )}
            <button
              onClick={() => setShowTranscript(s => !s)}
              aria-expanded={showTranscript}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body-sm)', fontWeight: 500,
                color: 'rgba(255,255,255,0.55)',
                padding: '8px 0',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                alignSelf: 'flex-start',
              }}
            >
              {showTranscript ? 'Hide transcript' : 'View transcript'}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transform: showTranscript ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 220ms' }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Export toast */}
      {exportToast && (
        <div role="status" style={{
          position: 'absolute', left: '50%', bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
          transform: 'translateX(-50%)',
          padding: '10px 18px', borderRadius: 999,
          background: 'linear-gradient(155deg, #1a1c26 0%, #0d0e16 100%)',
          border: '1px solid rgba(255,255,255,0.10)',
          color: 'rgba(255,255,255,0.92)',
          fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body-sm)', fontWeight: 500,
          boxShadow: '0 14px 36px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
          zIndex: 10,
        }}>
          {exportToast}
        </div>
      )}

      {/* Delete confirmation */}
      {confirmingDelete && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-delete-title"
          style={{
            position: 'absolute', inset: 0, zIndex: 12,
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 'var(--space-4)',
          }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmingDelete(false); }}
        >
          <div style={{
            width: '100%', maxWidth: 360,
            background: 'linear-gradient(155deg, #1a1c26 0%, #0d0e16 100%)',
            border: '1px solid rgba(255,107,107,0.30)',
            borderRadius: 22,
            padding: 'var(--space-5)',
            boxShadow: '0 22px 56px rgba(0,0,0,0.55), 0 4px 10px rgba(255,107,107,0.18), inset 0 1px 0 rgba(255,255,255,0.06)',
            display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
          }}>
            <div id="confirm-delete-title" style={{
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-title-sm)', fontWeight: 700, lineHeight: 1.25,
              color: '#fff', letterSpacing: '-0.01em',
            }}>
              Delete this post?
            </div>
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body)', lineHeight: 1.5,
              color: 'rgba(255,255,255,0.65)',
            }}>
              This deletes the recording, transcript, and all generated content. This can't be undone.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 'var(--space-2)' }}>
              <button
                onClick={() => setConfirmingDelete(false)}
                style={{
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.85)', cursor: 'pointer',
                  padding: '10px 18px', borderRadius: 999,
                  fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body)', fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => { setConfirmingDelete(false); onDelete(); onClose(); }}
                style={{
                  background: 'linear-gradient(135deg, rgba(201,48,48,0.95) 0%, rgba(168,40,40,0.95) 100%)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff', cursor: 'pointer',
                  padding: '10px 18px', borderRadius: 999,
                  fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body)', fontWeight: 600,
                  boxShadow: '0 12px 28px rgba(201,48,48,0.40)',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
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

function widgetGlowBgB(meta: typeof WIDGET_META[WidgetKind], count: number): string {
  const sat = count === 0 ? 0.18 : Math.min(0.85, 0.32 + count * 0.10);
  const op1 = (sat * 0.65).toFixed(2);
  const op2 = (sat * 0.20).toFixed(2);
  return `radial-gradient(ellipse 75% 95% at 28% 72%, ${meta.glow}${op1}) 0%, ${meta.glow}${op2}) 50%, ${meta.glow}0) 82%)`;
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
      {/* Primary morphing glow */}
      <div
        aria-hidden
        className="widget-glow"
        style={{
          position: 'absolute', inset: '-45%',
          background: widgetGlowBg(meta, count),
          filter: 'blur(8px)',
          animationName: 'widget-breathe',
          animationDuration: `${meta.breathDur * 1.6}s`,
          animationDelay: `${meta.breathDelay}s`,
          animationTimingFunction: 'cubic-bezier(0.45, 0.05, 0.55, 0.95)',
          animationIterationCount: 'infinite',
          willChange: 'transform, opacity',
          pointerEvents: 'none',
        }}
      />
      {/* Secondary asymmetric glow — different keyframe phase, different shape, blends with primary into an amorphous morph */}
      <div
        aria-hidden
        className="widget-glow"
        style={{
          position: 'absolute', inset: '-30%',
          background: widgetGlowBgB(meta, count),
          filter: 'blur(14px)',
          mixBlendMode: 'lighten',
          animationName: 'widget-morph-b',
          animationDuration: `${meta.breathDur * 2.1}s`,
          animationDelay: `${meta.breathDelay - 1.7}s`,
          animationTimingFunction: 'cubic-bezier(0.5, 0, 0.5, 1)',
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
  // Pull the kind's accent rgb from the WIDGET_META.glow string ("rgba(R,G,B,").
  const m = meta.glow.match(/rgba\((\d+),\s*(\d+),\s*(\d+),/);
  const kindRgb = m ? `${m[1]},${m[2]},${m[3]}` : '255,255,255';
  const count = filtered.length;
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(180deg, #0a0b14 0%, #060710 60%, #04050c 100%)',
      color: 'rgba(255,255,255,0.92)',
    }}>
      {/* Ambient page-level breathing orbs — same vocabulary as the note sheet,
          with the leading orb tinted to the library's kind for identity. */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        {[
          { color: kindRgb,        top: '8%',  left: '-12%', size: 320, dur: 12.5, delay: -2.1 },
          { color: '144,97,249',   top: '36%', left: '70%',  size: 280, dur: 10.2, delay: -5.6 },
          { color: '13,191,90',    top: '70%', left: '-8%',  size: 300, dur: 14.8, delay: -8.3 },
          { color: '255,150,18',   top: '60%', left: '60%',  size: 240, dur: 11.4, delay: -1.4 },
        ].map((o, i) => (
          <div key={i} className="widget-glow" style={{
            position: 'absolute', top: o.top, left: o.left, width: o.size, height: o.size, borderRadius: '50%',
            background: `radial-gradient(circle, rgba(${o.color},0.32) 0%, rgba(${o.color},0.10) 38%, rgba(${o.color},0) 70%)`,
            filter: 'blur(20px)',
            animationName: 'widget-breathe',
            animationDuration: `${o.dur}s`,
            animationDelay: `${o.delay}s`,
            animationTimingFunction: 'cubic-bezier(0.45, 0.05, 0.55, 0.95)',
            animationIterationCount: 'infinite',
            willChange: 'transform, opacity',
          }} />
        ))}
      </div>

      {/* Header */}
      <div style={{
        position: 'relative', zIndex: 1,
        padding: '16px 16px 12px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          aria-label="Back"
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.85)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            backdropFilter: 'blur(12px)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-title)', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-sans)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {meta.label}
          </div>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--font-sans)', marginTop: 2 }}>
            {count === 0 ? meta.sublabel : `${count} ${count === 1 ? 'item' : 'items'}`}
          </div>
        </div>
      </div>

      {/* List */}
      <div style={{
        position: 'relative', zIndex: 1,
        flex: 1, overflowY: 'auto',
        padding: '0 16px 160px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {filtered.length === 0 ? (
          <div style={{
            position: 'relative',
            background: 'linear-gradient(155deg, #1a1c26 0%, #0d0e16 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 22,
            boxShadow: '0 14px 40px rgba(0,0,0,0.30), 0 2px 6px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.06)',
            padding: '40px 24px',
            textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            marginTop: 24,
          }}>
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-heading)', fontWeight: 600,
              color: 'rgba(255,255,255,0.85)',
            }}>
              Nothing here yet
            </div>
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body)', fontWeight: 400, lineHeight: 1.55,
              color: 'rgba(255,255,255,0.55)', maxWidth: 280,
            }}>
              Record a voice note and generate content to see it here.
            </div>
          </div>
        ) : filtered.map(n => (
          <div key={n.id} style={{
            position: 'relative', borderRadius: 22,
            boxShadow: justRecordedId === n.id
              ? '0 0 0 2px rgba(13,191,90,0.55), 0 0 36px rgba(13,191,90,0.30)'
              : 'none',
            transition: 'box-shadow 600ms ease',
          }}>
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
        <div style={{
          position: 'absolute',
          bottom: 'calc(var(--space-5) + env(safe-area-inset-bottom, 0px))',
          left: 16, right: 16,
          display: 'flex', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <button
            onClick={onAddPost}
            aria-label="Capture your thought"
            style={{
              pointerEvents: 'auto',
              position: 'relative', overflow: 'hidden', isolation: 'isolate',
              width: '100%', maxWidth: 480, minHeight: 58,
              padding: '0 28px',
              borderRadius: 999,
              background: 'linear-gradient(135deg, #1a1c26 0%, #0d0e16 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.78)',
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body-lg)', fontWeight: 500, letterSpacing: '-0.01em',
              cursor: 'pointer', textAlign: 'center',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 18px 48px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            {/* Floating colored blobs — drifting and morphing organically */}
            {[
              { left: '0%',  top: '10%', size: 110, color: '144,97,249',  dur: 11.5, delay: -1.4,  morph: 'a', morphDur: 7.3,  morphDelay: -2.1 },
              { left: '25%', top: '55%', size: 92,  color: '29,155,240',  dur: 9.2,  delay: -4.1,  morph: 'b', morphDur: 9.1,  morphDelay: -5.3 },
              { left: '50%', top: '5%',  size: 84,  color: '13,191,90',   dur: 13.0, delay: -2.6,  morph: 'c', morphDur: 6.2,  morphDelay: -1.8 },
              { left: '70%', top: '60%', size: 100, color: '255,150,18',  dur: 10.4, delay: -6.0,  morph: 'a', morphDur: 8.8,  morphDelay: -4.7 },
              { left: '90%', top: '20%', size: 76,  color: '225,48,108',  dur: 12.2, delay: -8.5,  morph: 'b', morphDur: 5.7,  morphDelay: -3.2 },
            ].map((o, i) => (
              <span key={i} aria-hidden className="widget-glow" style={{
                position: 'absolute', left: o.left, top: o.top, width: o.size, height: o.size,
                marginLeft: -o.size / 2, marginTop: -o.size / 2,
                background: `radial-gradient(circle, rgba(${o.color},0.55) 0%, rgba(${o.color},0.18) 38%, rgba(${o.color},0) 70%)`,
                filter: 'blur(4px)',
                animationName: `add-post-orb-drift, add-post-blob-morph-${o.morph}`,
                animationDuration: `${o.dur}s, ${o.morphDur}s`,
                animationDelay: `${o.delay}s, ${o.morphDelay}s`,
                animationTimingFunction: 'ease-in-out, ease-in-out',
                animationIterationCount: 'infinite, infinite',
                willChange: 'transform, border-radius, opacity',
                pointerEvents: 'none',
              }} />
            ))}

            <span style={{ position: 'relative', zIndex: 1 }}>Capture your thought</span>
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
