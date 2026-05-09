import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { Menu, MenuItem } from '../ui/Menu';
import { useVoiceStore } from '../../store/voiceStore';
import { useGraphStore, type ContentNode } from '../../store/graphStore';
import { useOutputStore } from '../../store/outputStore';
import { useSettingsStore } from '../../store/settingsStore';
import { computeSafePosition } from '../../utils/nodePlacement';
import RecordButton from './RecordButton';

/** Sync every voice-source node's output to match the note's latest transcript.
 *  Called after transcription succeeds (initial stop or retry) so workflow nodes
 *  that already reference this note don't show stale text. */
function syncVoiceSourceOutputs(noteId: string, transcript: string) {
  const nodes = useGraphStore.getState().nodes.filter(
    n => n.data?.subtype === 'voice-source' && (n.data as { config?: { voiceNoteId?: string } })?.config?.voiceNoteId === noteId,
  );
  for (const n of nodes) useOutputStore.getState().setOutput(n.id, { text: transcript });
}

// Push a saved voice note into the active workflow as a voice-source node.
// The node references the note by id (not a baked-in string), so later edits
// to the transcript flow through on re-run. Selects the new node so the user
// sees exactly what was added when we navigate to the workflow.
// Returns true on success; false if there is no active workflow OR the note
// has no transcript yet (in which case the caller should warn the user).
function pushVoiceNoteToWorkflow(noteId: string, noteTitle: string): 'ok' | 'no-workflow' | 'empty-transcript' {
  const graphState = useGraphStore.getState();
  if (!graphState.workflowId) return 'no-workflow';
  const transcript = useVoiceStore.getState().notes.find((n) => n.id === noteId)?.transcript ?? '';
  if (!transcript) return 'empty-transcript';
  const id = `voice-source-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const node: ContentNode = {
    id,
    type: 'contentNode',
    position: computeSafePosition(),
    deletable: true,
    data: {
      subtype: 'voice-source',
      label: 'Voice: ' + noteTitle.slice(0, 30),
      badge: 'Vc',
      category: 'source',
      description: 'From voice note',
      config: { voiceNoteId: noteId },
    },
  };
  graphState.addNode(node);
  useOutputStore.getState().setOutput(id, { text: transcript });
  graphState.setSelectedNodeId(id);
  return 'ok';
}

async function transcribeWithGroq(blob: Blob, apiKey: string): Promise<string> {
  // Defensive trim: keys pasted into Settings before the save-time sanitizer
  // shipped may still carry surrounding whitespace or quotes — Groq rejects
  // those with a confusing "Invalid API Key" 401.
  const key = apiKey.trim().replace(/^['"`]+|['"`]+$/g, '');
  // Fingerprint only — never log the full key. Tells us on failure whether the
  // key was missing, truncated, or looks shaped right.
  console.info('[Groq]', { keyLen: key.length, prefix: key.slice(0, 4), suffix: key.slice(-4), blobBytes: blob.size, blobType: blob.type });
  if (!key) throw new Error('Groq API key missing. Add it in Settings → API Keys → Groq.');
  if (!key.startsWith('gsk_')) {
    throw new Error('That doesn\'t look like a Groq key — it should start with "gsk_". Get one from https://console.groq.com/keys.');
  }
  const form = new FormData();
  form.append('file', blob, 'recording.webm');
  form.append('model', 'whisper-large-v3');
  form.append('response_format', 'json');
  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 401) {
      throw new Error('Invalid Groq API key. Re-copy it from https://console.groq.com/keys (no quotes, no trailing spaces) and paste into Settings → API Keys → Groq.');
    }
    if (res.status === 429) {
      throw new Error('Groq rate limit hit. Wait a moment and retry.');
    }
    throw new Error(`Groq ${res.status}: ${body || 'transcription failed'}`);
  }
  const data = await res.json();
  return (data.text || '').trim();
}

function pickMimeType(): string | undefined {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  const MR: any = (window as any).MediaRecorder;
  if (!MR?.isTypeSupported) return undefined;
  return types.find(t => MR.isTypeSupported(t));
}

/* Icons */
const DotsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
);

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

async function generateSmartTitle(transcript: string): Promise<string> {
  const { anthropicKey, groqKey } = useSettingsStore.getState();
  const prompt = `Give this spoken transcript a concise 3–6 word title that captures the main topic. Return ONLY the title — no quotes, no punctuation, no explanation.\n\nTranscript: ${transcript.slice(0, 600)}`;
  if (anthropicKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 20, messages: [{ role: 'user', content: prompt }] }),
      });
      if (res.ok) { const t = (await res.json()).content?.[0]?.text?.trim(); if (t) return t; }
    } catch { /* fall through */ }
  }
  if (groqKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey.trim()}` },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 20, messages: [{ role: 'user', content: prompt }] }),
      });
      if (res.ok) { const t = (await res.json()).choices?.[0]?.message?.content?.trim(); if (t) return t; }
    } catch { /* fall through */ }
  }
  return '';
}


interface OverlayProps {
  onStop: () => void;
  onDiscard: () => void;
  startTime: number;
  errorMsg?: string | null;
  fatal?: boolean;
  transcriptSoFar: string;
  liveOffline?: boolean;
}

function RecordingOverlay({ onStop, onDiscard, startTime, errorMsg, fatal, transcriptSoFar }: OverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  useEffect(() => {
    const iv = setInterval(() => setElapsed(Date.now() - startTime), 200);
    return () => clearInterval(iv);
  }, [startTime]);
  useEffect(() => {
    // Keep the transcript scrolled to the newest words as speech arrives.
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcriptSoFar]);

  // Fatal errors (permission denied, language-not-supported) auto-close after 3s so
  // the user doesn't get stuck staring at a recording UI that can't actually record.
  useEffect(() => {
    if (!fatal) return;
    const t = setTimeout(onDiscard, 3000);
    return () => clearTimeout(t);
  }, [fatal, onDiscard]);

  const mm = String(Math.floor(elapsed / 60000)).padStart(2, '0');
  const ss = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-bg-card').trim() || '#fff';
    let t = 0, raf: number;
    const resize = () => { const r = canvas.getBoundingClientRect(); canvas.width = r.width * devicePixelRatio; canvas.height = r.height * devicePixelRatio; ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); };
    resize(); window.addEventListener('resize', resize);
    const draw = () => {
      const r = canvas.getBoundingClientRect(); const w = r.width, h = r.height, cx = w / 2, cy = h / 2;
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 5; i++) {
        const angle = t * 0.8 + i * 1.3;
        const spread = 80 + Math.sin(t * 0.5 + i) * 40;
        const x = cx + Math.cos(angle) * spread * 0.7;
        const y = cy + Math.sin(angle) * spread * 0.5;
        const sz = 120 + Math.sin(t + i) * 30;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, sz);
        const hue = 145 + i * 5;
        grad.addColorStop(0, `hsla(${hue},60%,55%,0.22)`);
        grad.addColorStop(0.6, `hsla(${hue},50%,50%,0.06)`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      }
      t += 0.012; raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center" style={{ background: 'var(--color-overlay-backdrop)', backdropFilter: 'blur(2px)', opacity: visible ? 1 : 0, transition: 'opacity 150ms' }}>
      <div className="flex flex-col w-full overflow-hidden rounded-t-[16px] md:rounded-[16px]"
        style={{ maxWidth: 480, maxHeight: '80vh', background: 'var(--color-bg-card)', boxShadow: '0 16px 48px rgba(0,0,0,0.18)', transform: visible ? 'translateY(0)' : 'translateY(16px)', transition: 'transform 150ms ease, opacity 150ms ease', position: 'relative' }}>
        {/* Cloud canvas background */}
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 'inherit' }} />
        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px 32px', gap: 14 }}>
          <div ref={transcriptRef} aria-hidden style={{ display: 'none' }} />
          <div style={{ fontSize: 48, fontWeight: 300, fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', letterSpacing: '0.05em', fontVariantNumeric: 'tabular-nums' }}>{mm}:{ss}</div>
          <div aria-live="polite" style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: fatal ? 'var(--color-danger-text)' : 'var(--color-text-tertiary)' }}>
            {fatal ? 'Recording stopped' : 'Recording'}
          </div>

          {!fatal && (
            <button onClick={onStop} aria-label="Stop recording and save"
              style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-glow)', marginTop: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
            </button>
          )}
          {!fatal && <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)' }}>Tap to stop</div>}

          {errorMsg && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger-text)', fontFamily: 'var(--font-sans)', textAlign: 'center', maxWidth: 360 }}>
              {errorMsg}
            </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  );
}

export default function VoiceLibrary({ onUseInWorkflow, onSendToScript }: { onUseInWorkflow?: () => void; onSendToScript?: (text: string) => void }) {
  const { notes, addNote, updateNote, removeNote } = useVoiceStore();
  const groqKey = useSettingsStore(s => s.groqKey);
  const [recording, setRecording] = useState(false);
  const [micError, setMicError] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [liveOffline, setLiveOffline] = useState(false);
  const [fatal, setFatal] = useState(false);
  // Editor state
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const editorTextareaRef = useRef<HTMLTextAreaElement>(null);

  const mediaRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startTimeRef = useRef(0);
  const noteIdRef = useRef('');
  const menuRef = useRef<HTMLDivElement>(null);
  const finalRef = useRef('');
  const interimRef = useRef('');
  const shouldRestartRef = useRef(false);
  const groqKeyRef = useRef(groqKey);
  useEffect(() => { groqKeyRef.current = groqKey; }, [groqKey]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const openEditor = (noteId: string) => {
    const n = useVoiceStore.getState().notes.find(x => x.id === noteId);
    if (!n) return;
    setEditTitle(n.title);
    setEditContent(n.transcript || '');
    setViewId(noteId);
  };

  const closeEditor = () => {
    if (!viewId) return;
    const n = useVoiceStore.getState().notes.find(x => x.id === viewId);
    if (n) {
      if (editTitle.trim() && editTitle.trim() !== n.title) updateNote(viewId, { title: editTitle.trim() });
      if (editContent !== n.transcript) {
        updateNote(viewId, { transcript: editContent });
        const matches = useGraphStore.getState().nodes.filter(
          node => node.data?.subtype === 'voice-source' && (node.data as any)?.config?.voiceNoteId === viewId,
        );
        for (const node of matches) useOutputStore.getState().setOutput(node.id, { text: editContent });
      }
    }
    setViewId(null);
  };

  // Close menu on outside click
  useEffect(() => {
    if (!menuId) return;
    const h = (e: Event) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuId(null); };
    document.addEventListener('mousedown', h);
    document.addEventListener('touchstart', h);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h); };
  }, [menuId]);

  // Reconcile orphans on mount: crashes / reloads can leave notes stuck in
  // transient states. 'recording' is unrecoverable (no blob persisted), so mark
  // it failed. 'transcribing' also can't be resumed — same treatment. Runs once.
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
    setFatal(false);
    setLiveOffline(false);
    setLiveTranscript('');
    finalRef.current = '';
    interimRef.current = '';
    chunksRef.current = [];

    // 1. Kick off SpeechRecognition synchronously inside the user gesture.
    //    iOS Safari requires .start() to be called before any await.
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) {
      // No live transcription available — flag the overlay now so it shows
      // "Audio capturing…" instead of "Listening…" forever. Whisper (if
      // a Groq key is set) still runs on stop.
      setLiveOffline(true);
    }
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
          setLiveTranscript((finalRef.current + ' ' + interim).trim());
        };
        recog.onerror = (e: any) => {
          console.error('SpeechRecognition error', e?.error, e);
          if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
            setErrorMsg('Microphone blocked. Check browser permissions.');
            setFatal(true);
            shouldRestartRef.current = false;
          } else if (e?.error === 'no-speech' || e?.error === 'audio-capture') {
            // swallow — onend will restart
          } else if (e?.error === 'network') {
            // don't alarm the user; Whisper fallback may still produce a transcript
            console.warn('Live transcription offline — will try Whisper on stop.');
            setLiveOffline(true);
          } else if (e?.error === 'language-not-supported') {
            setErrorMsg('Your browser language isn\'t supported for live transcription.');
            setFatal(true);
            shouldRestartRef.current = false;
          }
        };
        recog.onend = () => {
          if (shouldRestartRef.current) {
            try { recog.start(); } catch { /* already started */ }
          }
        };
        shouldRestartRef.current = true;
        recog.start();
        recognitionRef.current = recog;
      } catch (err) {
        console.error('SpeechRecognition unavailable', err);
        shouldRestartRef.current = false;
      }
    }

    // 2. Request mic + wire MediaRecorder — provides audio for Whisper fallback.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRef.current = stream;
      const mime = pickMimeType();
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      mr.start(1000);
      recorderRef.current = mr;
    } catch (err) {
      console.error('Mic access denied', err);
      shouldRestartRef.current = false;
      try { recognitionRef.current?.stop(); } catch { /* noop */ }
      recognitionRef.current = null;
      setMicError(true);
      setTimeout(() => setMicError(false), 3000);
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

    // Flush MediaRecorder so all chunks land in chunksRef before we assemble the blob.
    // Watchdog: some browsers (iOS 16 Safari webm path) occasionally hang the
    // stop event — cap the wait at 2s so the UI never freezes on the overlay.
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

    // If Web Speech produced nothing, fall back to Groq Whisper when the user has a key.
    if (!transcript && blob && blob.size > 0 && groqKeyRef.current) {
      updateNote(noteId, { durationMs: duration, status: 'transcribing' });
      try {
        transcript = await transcribeWithGroq(blob, groqKeyRef.current);
      } catch (err: any) {
        console.error('Whisper fallback failed', err);
        errorReason = `Transcription failed: ${err?.message || 'unknown error'}`;
      }
    } else if (!transcript && blob && blob.size > 0 && !groqKeyRef.current) {
      errorReason = 'No transcript captured. Add a Groq API key in Settings for Whisper transcription.';
    } else if (!transcript && (!blob || blob.size === 0)) {
      errorReason = 'No audio captured.';
    }

    if (errorReason && !transcript) {
      updateNote(noteId, { title: 'Untitled note', durationMs: duration, transcript: '', status: 'error', errorReason });
      return;
    }

    const fallbackTitle = transcript ? transcript.split(/\s+/).slice(0, 5).join(' ') : 'Untitled note';
    updateNote(noteId, { title: fallbackTitle, durationMs: duration, transcript, status: 'ready', errorReason: undefined });
    syncVoiceSourceOutputs(noteId, transcript);
    if (transcript) {
      generateSmartTitle(transcript).then(smart => {
        if (smart) useVoiceStore.getState().updateNote(noteId, { title: smart });
      }).catch(() => {});
    }
  }, [updateNote]);

  // Discard the in-progress recording entirely. Only used when a fatal permission
  // error fires and nothing was captured.
  const discardRecording = useCallback(() => {
    shouldRestartRef.current = false;
    try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
    recognitionRef.current = null;
    const mr = recorderRef.current;
    if (mr && mr.state !== 'inactive') { try { mr.stop(); } catch { /* noop */ } }
    recorderRef.current = null;
    mediaRef.current?.getTracks().forEach(t => t.stop());
    mediaRef.current = null;
    chunksRef.current = [];
    removeNote(noteIdRef.current);
    setRecording(false);
    setFatal(false);
    setLiveTranscript('');
  }, [removeNote]);

  // Re-record: start a fresh session first, and only remove the failed note if
  // the new session actually begins (mic permission granted, MediaRecorder up).
  // Without this, a mid-reset permission revocation left the user with nothing.
  const reRecord = useCallback(async (noteId: string) => {
    const before = useVoiceStore.getState().notes.length;
    await startRecording();
    const after = useVoiceStore.getState().notes.length;
    // startRecording adds a note on success; if the count didn't grow, it failed.
    if (after > before) removeNote(noteId);
  }, [removeNote, startRecording]);

  const confirmDelete = () => {
    if (!deleteId) return;
    removeNote(deleteId);
    setDeleteId(null);
  };

  // ── Editor view ──────────────────────────────────────────────────────────
  if (viewId) {
    return (
      <div className="mobile-safe-scroll" style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)', minWidth: 0, maxWidth: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Editor header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 10, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border-subtle)', flexShrink: 0 }}>
          <button
            onClick={closeEditor}
            aria-label="Back to notes"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 'var(--radius-sm)', flexShrink: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <input
            aria-label="Note title"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', background: 'none', border: 'none', outline: 'none', padding: 0, letterSpacing: '-0.01em' }}
          />
          <button
            onClick={() => { setDeleteId(viewId); }}
            aria-label="Delete note"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 'var(--radius-sm)', flexShrink: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>

        {/* Editable transcript */}
        <textarea
          ref={editorTextareaRef}
          value={editContent}
          onChange={e => setEditContent(e.target.value)}
          placeholder="No transcript yet…"
          style={{ flex: 1, width: '100%', padding: '20px', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-normal)', color: 'var(--color-text-primary)', background: 'transparent', border: 'none', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
        />

        {/* Delete confirmation */}
        <Dialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
          <DialogContent maxWidth={340} hideClose className="p-5" style={{ fontFamily: 'var(--font-sans)' }}>
            <DialogTitle style={{ marginBottom: 'var(--space-2)' }}>Delete voice note?</DialogTitle>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 'var(--space-4)' }}>
              This will permanently remove "{notes.find(n => n.id === deleteId)?.title}" from your library.
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-destructive" onClick={() => { confirmDelete(); setViewId(null); }}>Delete</button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <div className="mobile-safe-scroll" style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)', minWidth: 0, maxWidth: '100%' }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, padding: '14px 20px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: 'var(--color-bg)' }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>Voice Notes</span>
        {!recording && (
          <button onClick={startRecording} className="btn btn-primary" style={{ borderRadius: 'var(--radius-full)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            New
          </button>
        )}
      </div>

      {/* Recording overlay */}
      {recording && (
        <RecordingOverlay
          onStop={stopRecording}
          onDiscard={discardRecording}
          startTime={startTimeRef.current}
          errorMsg={errorMsg}
          fatal={fatal}
          transcriptSoFar={liveTranscript}
          liveOffline={liveOffline}
        />
      )}

      {errorMsg && (
        <div style={{ margin: '8px 20px', fontSize: 'var(--text-xs)', color: 'var(--color-danger-text)', fontFamily: 'var(--font-sans)' }}>{errorMsg}</div>
      )}

      {/* Empty state */}
      {notes.length === 0 && !recording ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'var(--space-8)', minHeight: 300 }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>No notes yet</div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', maxWidth: 260, lineHeight: 1.5, marginBottom: 'var(--space-6)' }}>Tap New to record your first voice note.</div>
          <RecordButton size={96} onClick={startRecording} state="idle" label="Tap to record" />
          {micError && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger-text)', fontFamily: 'var(--font-sans)', marginTop: 'var(--space-2)' }}>Microphone access denied.</div>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {[...notes]
            .filter(n => n.status !== 'recording')
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map(note => {
              const isError = note.status === 'error';
              const isTranscribing = note.status === 'transcribing';
              const displayTitle = (note.status === 'ready' && !note.transcript && note.title === 'Untitled note') ? 'Audio recording' : note.title;
              return (
                <div key={note.id} style={{ position: 'relative', zIndex: menuId === note.id ? 60 : 'auto' }}>
                  <button
                    onClick={() => { if (!isError && !isTranscribing) openEditor(note.id); }}
                    disabled={isTranscribing}
                    aria-label={displayTitle}
                    style={{
                      width: '100%', textAlign: 'left', background: 'none', border: 'none',
                      borderBottom: '1px solid var(--color-border-subtle)',
                      padding: '13px 48px 13px 20px',
                      cursor: isError || isTranscribing ? 'default' : 'pointer',
                      opacity: isTranscribing ? 0.5 : 1,
                      display: 'flex', flexDirection: 'column', gap: 2,
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, color: isError ? 'var(--color-danger-text)' : 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                      {displayTitle}
                    </span>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: isError ? 'var(--color-danger-text)' : isTranscribing ? 'var(--color-warning-text)' : 'var(--color-text-disabled)' }}>
                      {isError ? (note.errorReason || 'Transcription failed') : isTranscribing ? 'Transcribing…' : fmtDate(note.createdAt)}
                    </span>
                  </button>

                  {/* Dots menu */}
                  {!isTranscribing && (
                    <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
                      <button
                        aria-label="More options"
                        className="btn-icon-xs"
                        style={{ background: 'transparent', border: 'none', color: 'var(--color-text-tertiary)' }}
                        onClick={e => { e.stopPropagation(); setMenuId(menuId === note.id ? null : note.id); }}
                      >
                        <DotsIcon />
                      </button>
                      {menuId === note.id && (
                        <Menu ref={menuRef} onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 28, right: 0, zIndex: 50, minWidth: 160 }}>
                          {isError && <MenuItem onClick={() => { reRecord(note.id); setMenuId(null); }}>Re-record</MenuItem>}
                          {!isError && (
                            <MenuItem onClick={() => {
                              const result = pushVoiceNoteToWorkflow(note.id, note.title);
                              setMenuId(null);
                              if (result === 'ok') onUseInWorkflow?.();
                              else if (result === 'no-workflow') { setErrorMsg('Open a workflow first.'); setTimeout(() => setErrorMsg(null), 3000); }
                              else if (result === 'empty-transcript') { setErrorMsg('No transcript yet.'); setTimeout(() => setErrorMsg(null), 3000); }
                            }}>Use in workflow</MenuItem>
                          )}
                          {!isError && <MenuItem onClick={() => { if (note.transcript) onSendToScript?.(note.transcript); setMenuId(null); }}>Analyze in ScriptSense</MenuItem>}
                          <MenuItem danger onClick={() => { setDeleteId(note.id); setMenuId(null); }}>Delete</MenuItem>
                        </Menu>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <DialogContent maxWidth={340} hideClose className="p-5" style={{ fontFamily: 'var(--font-sans)' }}>
          <DialogTitle style={{ marginBottom: 'var(--space-2)' }}>Delete voice note?</DialogTitle>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 'var(--space-4)' }}>
            This will permanently remove "{notes.find(n => n.id === deleteId)?.title}" from your library.
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
            <button className="btn btn-destructive" onClick={confirmDelete}>Delete</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
