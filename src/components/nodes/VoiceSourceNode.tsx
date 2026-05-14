import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGraphStore } from '../../store/graphStore';
import { useOutputStore } from '../../store/outputStore';
import { useVoiceStore } from '../../store/voiceStore';
import { useSettingsStore } from '../../store/settingsStore';
import { transcribeWithGroq } from '../../lib/groqTranscribe';
import { generateSourceTitle } from '../../utils/sourceUtils';

export const SAMPLE_VOICE_CONTENT = "Movement in Gemini is not merely decorative; it's an essential guiding element. Each animation has a defined start and end point, creating a sense of directional flow that mirrors user actions. This sense of responsiveness helps users intuitively understand that the system is working with them. Inner activity within the motion conveys thinking, analysis, and intelligence, making Gemini's processing feel more transparent. Motion allows users to see information coming together, visualizing Gemini's conversations and listening abilities.";

function formatDuration(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function pickMimeType(): string | undefined {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  const MR: any = (window as any).MediaRecorder;
  if (!MR?.isTypeSupported) return undefined;
  return types.find(t => MR.isTypeSupported(t));
}

// ─── Recording overlay (portal) ─────────────────────────────────────────────────

function RecordingOverlay({ startTime, onStop, onCancel, errorMsg }: {
  startTime: number;
  onStop: () => void;
  onCancel: () => void;
  errorMsg?: string | null;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  useEffect(() => {
    const iv = setInterval(() => setElapsed(Date.now() - startTime), 200);
    return () => clearInterval(iv);
  }, [startTime]);

  const mm = String(Math.floor(elapsed / 60000)).padStart(2, '0');
  const ss = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0');

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: 'var(--color-overlay-backdrop)',
        backdropFilter: 'blur(2px)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 150ms',
      }}
    >
      <div
        style={{
          background: 'var(--color-bg-card)',
          borderRadius: 20,
          padding: '40px 40px 32px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          transform: visible ? 'translateY(0)' : 'translateY(12px)',
          transition: 'transform 150ms ease',
          minWidth: 260,
        }}
      >
        <div style={{
          fontSize: 52, fontWeight: 300, fontFamily: 'var(--font-sans)',
          color: 'var(--color-text-primary)', letterSpacing: '0.05em',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {mm}:{ss}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--color-accent)',
            animation: 'voice-pulse 1.2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>
            Recording
          </span>
        </div>

        <button
          onClick={onStop}
          aria-label="Stop recording"
          style={{
            width: 52, height: 52, borderRadius: '50%', border: 'none',
            background: 'var(--color-accent)', color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 0 8px rgba(13,191,90,0.15)',
            marginTop: 8,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        </button>

        <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)' }}>
          Tap to stop
        </div>

        {errorMsg && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger-text)', fontFamily: 'var(--font-sans)', textAlign: 'center', maxWidth: 280 }}>
            {errorMsg}
          </div>
        )}

        <button
          onClick={onCancel}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 4, padding: '4px 8px' }}
        >
          Cancel
        </button>
      </div>

      <style>{`
        @keyframes voice-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.8); } }
      `}</style>
    </div>,
    document.body
  );
}

function TranscribingOverlay() {
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'var(--color-overlay-backdrop)', backdropFilter: 'blur(2px)', opacity: visible ? 1 : 0, transition: 'opacity 150ms' }}
    >
      <div style={{ background: 'var(--color-bg-card)', borderRadius: 20, padding: '36px 40px', boxShadow: '0 16px 48px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--color-border-subtle)', borderTopColor: 'var(--color-accent)', animation: 'voice-spin 0.8s linear infinite' }} />
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Transcribing…</div>
        <style>{`@keyframes voice-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>,
    document.body
  );
}

export function VoiceSourceInline({ id }: { id: string }) {
  const voiceNoteId = useGraphStore((s) => s.nodes.find((n) => n.id === id)?.data.config?.voiceNoteId as string | undefined);
  const updateConfig = useGraphStore((s) => s.updateNodeConfig);
  const { addNote, updateNote } = useVoiceStore();
  const note = useVoiceStore((s) => voiceNoteId ? s.notes.find((n) => n.id === voiceNoteId) : undefined);
  const groqKey = useSettingsStore((s) => s.groqKey);

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const mediaRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recognitionRef = useRef<any>(null);
  const startTimeRef = useRef(0);
  const noteIdRef = useRef('');
  const finalRef = useRef('');
  const interimRef = useRef('');
  const shouldRestartRef = useRef(false);
  const groqKeyRef = useRef(groqKey);
  useEffect(() => { groqKeyRef.current = groqKey; }, [groqKey]);

  const startRecording = useCallback(async () => {
    setMicError(null);
    finalRef.current = '';
    interimRef.current = '';
    chunksRef.current = [];

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recog = new SpeechRecognition();
        recog.continuous = true;
        recog.interimResults = true;
        recog.lang = navigator.language || 'en-US';
        recog.onresult = (e: any) => {
          let interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const t = e.results[i][0].transcript;
            if (e.results[i].isFinal) finalRef.current += t + ' ';
            else interim += t;
          }
          interimRef.current = interim;
        };
        recog.onerror = (e: any) => {
          if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
            setMicError('Microphone blocked. Check browser permissions.');
            shouldRestartRef.current = false;
          } else if (e?.error === 'network') {
            console.warn('Live transcription offline — will try Whisper on stop.');
          }
        };
        recog.onend = () => { if (shouldRestartRef.current) { try { recog.start(); } catch { /* already started */ } } };
        shouldRestartRef.current = true;
        recog.start();
        recognitionRef.current = recog;
      } catch { shouldRestartRef.current = false; }
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
      setMicError('Microphone access denied. Check browser permissions.');
      return;
    }

    const noteId = `vn-${Date.now()}`;
    noteIdRef.current = noteId;
    startTimeRef.current = Date.now();
    setRecording(true);
    addNote({ id: noteId, title: 'Recording…', durationMs: 0, transcript: '', status: 'recording', createdAt: new Date().toISOString() });
  }, [addNote]);

  const stopRecording = useCallback(async () => {
    shouldRestartRef.current = false;
    try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
    recognitionRef.current = null;

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

    if (!transcript && blob && blob.size > 0 && groqKeyRef.current) {
      setTranscribing(true);
      updateNote(noteId, { durationMs: duration, status: 'transcribing' });
      try {
        transcript = await transcribeWithGroq(blob, groqKeyRef.current);
      } catch (err: any) {
        updateNote(noteId, { title: 'Untitled note', durationMs: duration, transcript: '', status: 'error', errorReason: `Transcription failed: ${err?.message || 'unknown error'}` });
        setTranscribing(false);
        return;
      }
      setTranscribing(false);
    } else if (!transcript) {
      const reason = !groqKeyRef.current
        ? 'No transcript captured. Add a Groq API key in Settings for Whisper transcription.'
        : 'No audio captured.';
      updateNote(noteId, { title: 'Untitled note', durationMs: duration, transcript: '', status: 'error', errorReason: reason });
      return;
    }

    const fallbackTitle = transcript.split(/\s+/).slice(0, 5).join(' ');
    updateNote(noteId, { title: fallbackTitle, durationMs: duration, transcript, status: 'ready' });
    useOutputStore.getState().setOutput(id, { text: transcript });
    updateConfig(id, { voiceNoteId: noteId });

    generateSourceTitle(transcript).then(smart => {
      if (smart) updateNote(noteId, { title: smart });
    }).catch(() => {});
  }, [id, updateConfig, updateNote]);

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
    useVoiceStore.getState().removeNote(noteIdRef.current);
    setRecording(false);
  }, []);

  const noteTitle = note?.status === 'ready' ? note.title : undefined;
  const noteDuration = note?.durationMs ?? 0;
  const noteStatus = note?.status;

  return (
    <div
      className="nowheel"
      onMouseDown={(e) => e.stopPropagation()}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}
    >
      {recording && (
        <RecordingOverlay
          startTime={startTimeRef.current}
          onStop={stopRecording}
          onCancel={cancelRecording}
          errorMsg={micError}
        />
      )}
      {transcribing && <TranscribingOverlay />}

      {noteTitle ? (
        <div
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '10px 12px',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500,
              color: 'var(--color-text-primary)', lineHeight: 'var(--leading-snug)',
              overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
            }}>
              {noteTitle}
            </div>
            <div style={{ marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)' }}>
              {formatDuration(noteDuration)}
            </div>
          </div>
          <button
            onClick={startRecording}
            style={{
              marginTop: 10, alignSelf: 'flex-start',
              background: 'none', border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-sm)', padding: '3px 10px',
              fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)',
              color: 'var(--color-text-secondary)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
            Re-record
          </button>
        </div>
      ) : noteStatus === 'error' ? (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          background: 'var(--color-danger-bg, #FEF4F4)',
          border: '1px solid #ECC0C0',
          borderRadius: 'var(--radius-lg)',
          padding: '10px 12px',
        }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-danger-text)', lineHeight: 1.4, flex: 1 }}>
            {note?.errorReason || 'Transcription failed. Try again.'}
          </div>
          <button
            onClick={startRecording}
            style={{
              marginTop: 10, alignSelf: 'flex-start',
              background: 'none', border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-sm)', padding: '3px 10px',
              fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)',
              color: 'var(--color-text-secondary)', cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      ) : (
        <button
          onClick={startRecording}
          style={{
            flex: 1,
            border: '1px dashed var(--color-border-default)',
            borderRadius: 'var(--radius-lg)',
            background: 'none',
            cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
            color: 'var(--color-text-placeholder)',
            transition: 'background 150ms, border-color 150ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-surface)'; e.currentTarget.style.borderStyle = 'solid'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderStyle = 'dashed'; }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-disabled)' }}>
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="22"/>
          </svg>
          Start recording
        </button>
      )}

      {micError && !recording && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger-text)', fontFamily: 'var(--font-sans)' }}>
          {micError}
        </div>
      )}
    </div>
  );
}
