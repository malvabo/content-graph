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
  const transcriptRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const iv = setInterval(() => setElapsed(Date.now() - startTime), 200);
    return () => clearInterval(iv);
  }, [startTime]);
  useEffect(() => { const el = transcriptRef.current; if (el) el.scrollTop = el.scrollHeight; }, [liveText]);
  const mm = String(Math.floor(elapsed / 60000)).padStart(2, '0');
  const ss = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0');
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)', gap: 'var(--space-4)' }}>
        <div style={{ fontSize: 56, fontWeight: 300, fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', letterSpacing: '0.05em', fontVariantNumeric: 'tabular-nums' }}>{mm}:{ss}</div>
        <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>Recording</div>
        <div ref={transcriptRef} aria-live="polite"
          style={{ width: '100%', maxWidth: 400, minHeight: 88, maxHeight: 240, overflowY: 'auto', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: liveText ? 'var(--color-text-primary)' : 'var(--color-text-disabled)', lineHeight: 1.5, textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere', boxSizing: 'border-box' }}>
          {liveText || 'Listening…'}
        </div>
      </div>
      <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', borderTop: '1px solid var(--color-border-subtle)' }}>
        <button onClick={onStop} aria-label="Stop and save"
          style={{ width: 72, height: 72, borderRadius: '50%', border: 'none', background: 'var(--color-accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-glow)' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
        </button>
        <button onClick={onCancel}
          style={{ background: 'none', border: 'none', color: 'var(--color-danger-text)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', padding: 'var(--space-2) var(--space-4)' }}>
          Discard
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** Compact single-line retrieval row. No expand. Tap → detail sheet. */
function NoteCard({ note, onOpen }: { note: VoiceNote; onOpen: () => void }) {
  const isTranscribing = note.status === 'transcribing';
  const isAudioOnly = note.status === 'ready' && !note.transcript;

  const dotColor =
    isTranscribing ? 'var(--color-warning-text, #856404)'
    : isAudioOnly ? 'var(--color-text-disabled)'
    : note.lastGeneration ? 'var(--color-accent, #0DBF5A)'
    : 'var(--color-text-tertiary)';

  const rightChip: { label: string; bg: string; fg: string } | null =
    isTranscribing ? { label: 'Transcribing', bg: 'var(--color-warning-bg)', fg: 'var(--color-warning-text)' }
    : isAudioOnly ? { label: 'Audio only', bg: 'var(--color-bg-surface)', fg: 'var(--color-text-tertiary)' }
    : note.lastGeneration ? { label: KIND_LABEL[note.lastGeneration.kind].split(' ')[0], bg: 'var(--color-bg-surface)', fg: 'var(--color-accent, #0DBF5A)' }
    : null;

  // Title fallback: avoid stacking a dozen "Untitled note" rows. If the title
  // is the literal "Untitled note" and there's no transcript, show a friendlier
  // retrieval string ("Audio recording · <time>").
  const displayTitle = isAudioOnly && note.title === 'Untitled note'
    ? `Audio recording`
    : note.title;

  return (
    <button onClick={onOpen} disabled={isTranscribing}
      style={{
        width: '100%', textAlign: 'left', background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)',
        padding: '14px 16px', display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center',
        columnGap: 12, rowGap: 2, cursor: isTranscribing ? 'default' : 'pointer',
        opacity: isTranscribing ? 0.7 : 1, minWidth: 0, boxSizing: 'border-box',
      }}>
      {/* Leading dot — the anchor every row pins to */}
      <span style={{ gridRow: '1 / span 2', width: 10, height: 10, borderRadius: '50%', background: dotColor, flexShrink: 0, marginTop: 2 }} />

      {/* Title row */}
      <span style={{
        fontFamily: 'var(--font-sans)', fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, lineHeight: 1.3,
      }}>
        {displayTitle}
      </span>

      {/* Right chip */}
      {rightChip ? (
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: rightChip.bg, color: rightChip.fg, lineHeight: '16px', flexShrink: 0 }}>
          {rightChip.label}
        </span>
      ) : <span aria-hidden style={{ width: 0 }} />}

      {/* Metadata row (spans under title + chip) */}
      <span style={{
        gridColumn: '2 / span 2',
        fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-tertiary)', lineHeight: 1.3,
      }}>
        {fmtDuration(note.durationMs)} · {fmtDate(note.createdAt)}
      </span>
    </button>
  );
}

/** Aggregated collapsed view for orphan/failed notes — keeps them out of the
 *  main list until the user chooses to review. */
function ErrorSummary({ failed, onReview }: { failed: VoiceNote[]; onReview: () => void }) {
  return (
    <button onClick={onReview}
      style={{
        width: '100%', textAlign: 'left', background: 'var(--color-danger-bg)',
        border: '1px solid var(--color-danger-border, var(--color-danger-text))',
        borderRadius: 'var(--radius-lg)', padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, cursor: 'pointer', minWidth: 0, boxSizing: 'border-box',
      }}>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, color: 'var(--color-danger-text)', minWidth: 0, overflow: 'hidden' }}>
        {failed.length} recording{failed.length === 1 ? '' : 's'} couldn't be transcribed
      </span>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-danger-text)', flexShrink: 0 }}>
        Review →
      </span>
    </button>
  );
}

/** Full-screen detail sheet — replaces the old accordion.
 *  Owns generation state, persists the last successful generation to the store. */
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

  const saveTitle = () => {
    const t = editTitle.trim();
    if (!t || t === note.title) return;
    updateNote(note.id, { title: t });
  };

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

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {/* Sheet header */}
      <div style={{ flexShrink: 0, padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
        <button onClick={() => { saveTitle(); onClose(); }} aria-label="Close"
          style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', border: 'none', background: 'transparent', color: 'var(--color-text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <input value={editTitle} onChange={e => setEditTitle(e.target.value)} onBlur={saveTitle}
            onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
            style={{ width: '100%', fontFamily: 'var(--font-sans)', fontSize: 17, fontWeight: 600, color: 'var(--color-text-primary)', background: 'none', border: 'none', outline: 'none', padding: 0 }} />
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
            {fmtDuration(note.durationMs)} · {fmtDate(note.createdAt)}
          </div>
        </div>
      </div>

      {/* Sheet body */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 0 }}>
        {isError ? (
          <div style={{ background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border, var(--color-danger-text))', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--color-danger-text)', lineHeight: 1.5, wordBreak: 'break-word' }}>
            {note.errorReason || 'Transcription failed.'}
          </div>
        ) : note.transcript ? (
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Transcript</div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: 'var(--color-text-primary)', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
              {note.transcript}
            </div>
          </div>
        ) : (
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--color-text-tertiary)', lineHeight: 1.5 }}>
            This recording has audio but no transcript yet. Add a Groq API key in desktop Settings to transcribe existing audio.
          </div>
        )}

        {/* Generator — primary action */}
        {note.transcript && !isError && (
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
              Create asset
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
              {(['linkedin-post', 'twitter-thread', 'twitter-single'] as const).map(k => {
                const isActive = gen?.kind === k;
                const isLoadingThis = isActive && gen?.loading;
                return (
                  <button key={k} onClick={() => generate(k)} disabled={isLoadingThis}
                    style={{
                      padding: '12px 14px', borderRadius: 'var(--radius-md)',
                      border: `1px solid ${isActive ? 'var(--color-accent)' : 'var(--color-border-default)'}`,
                      background: isActive ? 'var(--color-bg-surface)' : 'var(--color-bg-card)',
                      fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500,
                      color: 'var(--color-text-primary)', textAlign: 'left', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    }}>
                    <span>{KIND_LABEL[k]}</span>
                    {isLoadingThis ? <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>Generating…</span>
                      : note.lastGeneration?.kind === k ? <span style={{ fontSize: 12, color: 'var(--color-accent)' }}>Saved</span>
                      : <span style={{ color: 'var(--color-text-tertiary)' }}>→</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Generated output (persisted) */}
        {gen && (gen.loading || gen.text || gen.error) && (
          <div style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', minWidth: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {KIND_LABEL[gen.kind]}
              </span>
              {gen.text && !gen.loading && (
                <button onClick={copy} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: copied ? 'var(--color-accent)' : 'var(--color-accent)', padding: 0 }}>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              )}
            </div>
            {gen.loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[100, 92, 96, 80].map((w, i) => <div key={i} className="skeleton-bar" style={{ height: 12, width: `${w}%`, borderRadius: 'var(--radius-sm)', animationDelay: `${i * 0.1}s` }} />)}
              </div>
            ) : gen.error ? (
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--color-danger-text)', wordBreak: 'break-word' }}>{gen.error}</div>
            ) : (
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.55, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                {gen.text}
              </div>
            )}
          </div>
        )}

        {/* Footer actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 'var(--space-4)' }}>
          {isError && (
            <button onClick={() => { onRerecord(); onClose(); }} className="btn btn-primary" style={{ flex: 1 }}>
              Re-record
            </button>
          )}
          <button onClick={() => { onDelete(); onClose(); }}
            style={{ flex: isError ? 0 : 1, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-default)', background: 'var(--color-bg-card)', fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--color-danger-text)', cursor: 'pointer' }}>
            Delete
          </button>
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
      {guest && !user && (
        <div style={{ background: 'var(--color-warning-bg)', borderBottom: '1px solid var(--color-warning-border)', padding: '6px 14px', fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--color-warning-text)', textAlign: 'center' }}>
          Guest mode — your work won't be saved.
        </div>
      )}

      {/* Header */}
      <div style={{ padding: 'var(--space-4) var(--space-4) var(--space-3)', flexShrink: 0, minWidth: 0 }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', letterSpacing: '-0.02em', wordBreak: 'break-word' }}>Voice Notes</h1>
        <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', lineHeight: 1.4, wordBreak: 'break-word' }}>
          Record an idea and turn it into a LinkedIn post or tweet.
        </p>
      </div>

      {/* Scrollable notes list */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 var(--space-4) 140px', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', minWidth: 0 }}>
        {!hasKey && (
          <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-warning-text)', lineHeight: 1.4 }}>
            Add an Anthropic or Groq API key on a desktop session to enable transcription and generation.
          </div>
        )}

        {errorMsg && (
          <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-danger-text)' }}>{errorMsg}</div>
        )}

        {isEmpty ? (
          <div style={{ padding: 'var(--space-8) var(--space-4)', textAlign: 'center', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>
            No notes yet. Tap the record button to capture your first idea.
          </div>
        ) : (
          <>
            {/* Aggregated failures at the top — collapsed by default */}
            {failedNotes.length > 0 && !showingErrors && (
              <ErrorSummary failed={failedNotes} onReview={() => setShowingErrors(true)} />
            )}
            {failedNotes.length > 0 && showingErrors && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 var(--space-1)' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Failed recordings
                  </span>
                  <button onClick={() => setShowingErrors(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-tertiary)', padding: 0 }}>
                    Hide
                  </button>
                </div>
                {failedNotes.map(n => (
                  <NoteCard key={n.id} note={n} onOpen={() => setOpenNoteId(n.id)} />
                ))}
              </div>
            )}

            {/* Active notes */}
            {activeNotes.map(n => (
              <div key={n.id} style={{
                position: 'relative',
                boxShadow: justRecordedId === n.id ? '0 0 0 2px var(--color-accent)' : 'none',
                borderRadius: 'var(--radius-lg)',
                transition: 'box-shadow 300ms',
              }}>
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
