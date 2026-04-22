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
          style={{ width: '100%', maxWidth: 400, minHeight: 88, maxHeight: 240, overflowY: 'auto', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: liveText ? 'var(--color-text-primary)' : 'var(--color-text-disabled)', lineHeight: 1.5, textAlign: 'left', whiteSpace: 'pre-wrap' }}>
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

function NoteCard({ note, onDelete, onRerecord }: { note: VoiceNote; onDelete: () => void; onRerecord: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [gen, setGen] = useState<Generation | null>(null);
  const isError = note.status === 'error';
  const isTranscribing = note.status === 'transcribing';

  const generate = useCallback(async (kind: AssetKind) => {
    setGen({ kind, text: '', loading: true });
    try {
      const out = await aiExecute(note.transcript, {}, kind);
      setGen({ kind, text: out, loading: false });
    } catch (e: any) {
      setGen({ kind, text: '', loading: false, error: e?.message || 'Generation failed' });
    }
  }, [note.transcript]);

  const copy = async () => {
    if (!gen?.text) return;
    try { await navigator.clipboard.writeText(gen.text); } catch { /* clipboard may be blocked */ }
  };

  // Error notes get their own compact layout — no expand, inline recovery.
  if (isError) {
    return (
      <div style={{ borderRadius: 'var(--radius-lg)', background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border, var(--color-danger-text))', padding: 'var(--space-3) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', width: '100%' }}>
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500,
            color: 'var(--color-text-primary)', flex: 1, minWidth: 0,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden', wordBreak: 'break-word', lineHeight: 1.35,
          }}>
            {note.title}
          </span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, padding: '1px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(197, 48, 48, 0.12)', color: 'var(--color-danger-text, #c53030)', lineHeight: '16px', flexShrink: 0, marginTop: 2 }}>
            Failed
          </span>
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-danger-text)', lineHeight: 1.5, wordBreak: 'break-word' }}>
          {note.errorReason || 'Transcription failed.'}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <button onClick={onRerecord} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 'var(--text-xs)' }}>Re-record</button>
          <button onClick={onDelete} className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 'var(--text-xs)' }}>Delete</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', overflow: 'hidden', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <button onClick={() => setExpanded(v => !v)} disabled={isTranscribing}
        style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 'var(--space-3) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 4, cursor: isTranscribing ? 'default' : 'pointer', opacity: isTranscribing ? 0.75 : 1, minWidth: 0 }}>
        {/* Row 1: title alone — gets full row width, wraps to 2 lines max */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', width: '100%' }}>
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500,
            color: 'var(--color-text-primary)', flex: 1, minWidth: 0,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden', wordBreak: 'break-word', lineHeight: 1.35,
          }}>
            {note.title}
          </span>
          {isTranscribing && (
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, padding: '1px 8px', borderRadius: 'var(--radius-full)', background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)', lineHeight: '16px', flexShrink: 0, marginTop: 2 }}>
              Transcribing…
            </span>
          )}
        </div>
        {/* Row 2: metadata on its own line — never competes for horizontal space */}
        {!isTranscribing && (
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', lineHeight: 1.3 }}>
            {fmtDuration(note.durationMs)} · {fmtDate(note.createdAt)}
          </div>
        )}
        {/* Row 3: transcript preview (collapsed) */}
        {note.transcript && !expanded && (
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-disabled)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word', lineHeight: 1.4, marginTop: 2 }}>
            {note.transcript}
          </div>
        )}
      </button>

      {expanded && (
        <div style={{ padding: '0 var(--space-4) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', minWidth: 0 }}>
          {note.transcript && (
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', lineHeight: 1.5, maxHeight: 180, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
              {note.transcript}
            </div>
          )}

          <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', fontWeight: 500 }}>Quick asset</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {(['linkedin-post', 'twitter-thread', 'twitter-single'] as const).map(k => (
              <button key={k}
                disabled={!note.transcript || (gen?.loading && gen.kind === k)}
                onClick={() => generate(k)}
                style={{ padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', border: `1px solid ${gen?.kind === k ? 'var(--color-accent)' : 'var(--color-border-default)'}`, background: gen?.kind === k ? 'var(--color-bg-surface)' : 'var(--color-bg-card)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-primary)', cursor: note.transcript ? 'pointer' : 'default', opacity: note.transcript ? 1 : 0.5, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>

          {gen && (
            <div style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', minWidth: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', fontWeight: 500, color: 'var(--color-text-tertiary)' }}>{KIND_LABEL[gen.kind]}</span>
                {gen.text && !gen.loading && (
                  <button onClick={copy} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-accent)', padding: 0 }}>
                    Copy
                  </button>
                )}
              </div>
              {gen.loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[100, 90, 95, 82].map((w, i) => <div key={i} className="skeleton-bar" style={{ height: 10, width: `${w}%`, borderRadius: 'var(--radius-sm)', animationDelay: `${i * 0.1}s` }} />)}
                </div>
              ) : gen.error ? (
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-danger-text)', wordBreak: 'break-word' }}>{gen.error}</div>
              ) : (
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                  {gen.text}
                </div>
              )}
            </div>
          )}

          <button onClick={onDelete}
            style={{ alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-danger-text)', padding: 0 }}>
            Delete note
          </button>
        </div>
      )}
    </div>
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

  const visibleNotes = [...notes].filter(n => n.status !== 'recording').reverse();

  return (
    <div className="mobile-safe-scroll" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--color-bg)', position: 'relative', minWidth: 0 }}>
      {guest && !user && (
        <div style={{ background: 'var(--color-warning-bg)', borderBottom: '1px solid var(--color-warning-border)', padding: '6px 14px', fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--color-warning-text)', textAlign: 'center' }}>
          Guest mode — your work won't be saved.
        </div>
      )}

      {/* Header */}
      <div style={{ padding: 'var(--space-5) var(--space-4) var(--space-3)', flexShrink: 0 }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 24, fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>Voice Notes</h1>
        <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', lineHeight: 1.4 }}>
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

        {visibleNotes.length === 0 ? (
          <div style={{ padding: 'var(--space-8) var(--space-4)', textAlign: 'center', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>
            No notes yet. Tap the record button to capture your first idea.
          </div>
        ) : (
          visibleNotes.map(n => (
            <NoteCard
              key={n.id}
              note={n}
              onDelete={() => removeNote(n.id)}
              onRerecord={async () => {
                // Atomic re-record: start first, remove old only if new session actually begins.
                const before = useVoiceStore.getState().notes.length;
                await startRecording();
                const after = useVoiceStore.getState().notes.length;
                if (after > before) removeNote(n.id);
              }}
            />
          ))
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
    </div>
  );
}
