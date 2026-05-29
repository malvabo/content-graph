import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useVoiceStore } from '../../store/voiceStore';
import { useGraphStore } from '../../store/graphStore';
import { useOutputStore } from '../../store/outputStore';
import { useSettingsStore } from '../../store/settingsStore';
import { transcribeWithGroq } from '../../lib/groqTranscribe';
import RecordButton from './RecordButton';

function syncVoiceSourceOutputs(noteId: string, transcript: string) {
  const nodes = useGraphStore.getState().nodes.filter(
    n => n.data?.subtype === 'voice-source' && (n.data as { config?: { voiceNoteId?: string } })?.config?.voiceNoteId === noteId,
  );
  for (const n of nodes) useOutputStore.getState().setOutput(n.id, { text: transcript });
}

function pickMimeType(): string | undefined {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  const MR: any = (window as any).MediaRecorder;
  if (!MR?.isTypeSupported) return undefined;
  return types.find(t => MR.isTypeSupported(t));
}

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
  stream?: MediaStream | null;
}

function RecordingOverlay({ onStop, onDiscard, startTime, errorMsg, fatal, stream }: OverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const [visible, setVisible] = useState(false);
  const audioLevelRef = useRef(0);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  useEffect(() => {
    const iv = setInterval(() => setElapsed(Date.now() - startTime), 200);
    return () => clearInterval(iv);
  }, [startTime]);

  useEffect(() => {
    if (!fatal) return;
    const t = setTimeout(onDiscard, 3000);
    return () => clearTimeout(t);
  }, [fatal, onDiscard]);

  // Drive audioLevelRef from the live microphone stream
  useEffect(() => {
    if (!stream) return;
    let audioCtx: AudioContext | undefined;
    let raf: number;
    try {
      audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        audioLevelRef.current = data.reduce((a, b) => a + b, 0) / (data.length * 255);
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* mic unavailable */ }
    return () => { cancelAnimationFrame(raf); audioCtx?.close(); };
  }, [stream]);

  // Amber particle wave — particles converge on wave from above and below
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const POSITIONS = 100;
    const LAYERS = 6; // more layers = broader, denser band
    let t = 0, raf: number;

    const pseudoRandom = (n: number) => {
      const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
      return v - Math.floor(v);
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width * devicePixelRatio;
      canvas.height = r.height * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const r = canvas.getBoundingClientRect();
      const w = r.width, h = r.height, cy = h / 2;
      ctx.fillStyle = '#0d0e16';
      ctx.fillRect(0, 0, w, h);

      const level = audioLevelRef.current;
      const amplified = Math.min(1.0, Math.pow(Math.max(level, 0.005), 0.28) * 2.8);
      // Less movement: lower amplitude, slower wave
      const amplitude = amplified * cy * 0.42;

      for (let layer = 0; layer < LAYERS; layer++) {
        for (let i = 0; i < POSITIONS; i++) {
          const idx = layer * POSITIONS + i;
          const progress = i / (POSITIONS - 1);

          const r1 = pseudoRandom(idx);
          const r2 = pseudoRandom(idx + 500);
          const r3 = pseudoRandom(idx + 1000);

          // Staggered lifecycle phases so all stages are visible at once
          const phaseOffset = (layer / LAYERS) + r1 * (1 / LAYERS);
          const phase = (t * 0.2 + phaseOffset) % 1.0;

          // Slower, smoother wave — fewer cycles, lower frequency
          const wave1 = Math.sin(progress * Math.PI * 3.0 + t * 0.9) * amplitude;
          const wave2 = Math.sin(progress * Math.PI * 5.0 + t * 1.3 + 1.1) * amplitude * 0.28;
          const waveY = cy + wave1 + wave2;

          // Approach from above or below
          const side = r2 < 0.5 ? -1 : 1;
          // Wider travel distance for a broader band
          const travelDist = 30 + r3 * 58;

          // distFrac: 0 = at wave (phase 0.5), 1 = at spawn
          const distFrac = Math.abs(phase - 0.5) * 2;
          const easedDist = distFrac * distFrac;
          const yOffset = side * travelDist * easedDist;

          // Particles grow as they converge — broader visible size range
          const proximity = 1 - distFrac;
          const size = Math.max(0.2, (0.4 + proximity * 3.8) * (0.5 + r3 * 0.8) * (1 + amplified * 0.5));

          // Higher alpha ceiling so the wave is clearly visible
          const alpha = proximity * proximity * (0.75 + r1 * 0.22);

          // Fade at horizontal edges
          const envelope = Math.sin(progress * Math.PI);
          const finalAlpha = alpha * envelope;

          if (finalAlpha < 0.015) continue;

          ctx.beginPath();
          ctx.arc(w * progress, waveY + yOffset, size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(246,185,59,${finalAlpha.toFixed(3)})`;
          ctx.fill();
        }
      }

      t += 0.011;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  const mm = String(Math.floor(elapsed / 60000)).padStart(2, '0');
  const ss = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0');

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center" style={{ background: 'var(--color-overlay-backdrop)', backdropFilter: 'blur(2px)', opacity: visible ? 1 : 0, transition: 'opacity 150ms' }}>
      <div className="flex flex-col w-full overflow-hidden rounded-t-[16px] md:rounded-[16px]"
        style={{ maxWidth: 480, minHeight: 320, maxHeight: '80vh', background: '#0d0e16', boxShadow: '0 16px 48px rgba(0,0,0,0.4)', transform: visible ? 'translateY(0)' : 'translateY(16px)', transition: 'transform 150ms ease, opacity 150ms ease', position: 'relative' }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 'inherit' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px 32px', gap: 14 }}>
          <div style={{ fontSize: 48, fontWeight: 300, fontFamily: 'var(--font-sans)', color: '#fff', letterSpacing: '0.05em', fontVariantNumeric: 'tabular-nums' }}>{mm}:{ss}</div>
          <div aria-live="polite" style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: fatal ? '#ff6b6b' : 'rgba(246,185,59,0.8)' }}>
            {fatal ? 'Recording stopped' : 'Recording'}
          </div>

          {!fatal && (
            <button onClick={onStop} aria-label="Stop recording and save"
              style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'rgba(246,185,59,1)', color: '#0d0e16', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(246,185,59,0.4)', marginTop: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
            </button>
          )}
          {!fatal && <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'rgba(255,255,255,0.35)' }}>Tap to stop</div>}

          {errorMsg && (
            <div style={{ fontSize: 'var(--text-xs)', color: '#ff6b6b', fontFamily: 'var(--font-sans)', textAlign: 'center', maxWidth: 360 }}>
              {errorMsg}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function VoiceLibrary() {
  const { addNote, updateNote, removeNote } = useVoiceStore();
  const groqKey = useSettingsStore(s => s.groqKey);
  const [recording, setRecording] = useState(false);
  const [micError, setMicError] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [liveOffline, setLiveOffline] = useState(false);
  const [fatal, setFatal] = useState(false);
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

  // Reconcile orphans on mount
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
      // Per-recording chunks array so late `dataavailable` events (e.g. iOS
      // Safari fires one after stop() resolves) can't contaminate the next
      // recording's blob. chunksRef points at the live array; stopRecording
      // detaches it before clearing.
      const localChunks: BlobPart[] = [];
      chunksRef.current = localChunks;
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) localChunks.push(e.data);
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

    // Snapshot then detach so late `dataavailable` chunks from this recorder
    // push into the orphan array, never the next recording's.
    const recordedChunks = chunksRef.current;
    chunksRef.current = [];
    const mimeType = (recordedChunks[0] as Blob | undefined)?.type || 'audio/webm';
    const blob = recordedChunks.length ? new Blob(recordedChunks, { type: mimeType }) : null;

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

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', gap: 'var(--space-3)' }}>
      <RecordButton size={96} onClick={startRecording} state="idle" />
      {micError && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger-text)', fontFamily: 'var(--font-sans)' }}>
          Microphone access denied. Check browser permissions.
        </div>
      )}
      {errorMsg && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger-text)', fontFamily: 'var(--font-sans)', textAlign: 'center', maxWidth: 280 }}>
          {errorMsg}
        </div>
      )}
      {recording && (
        <RecordingOverlay
          onStop={stopRecording}
          onDiscard={discardRecording}
          startTime={startTimeRef.current}
          errorMsg={errorMsg}
          fatal={fatal}
          transcriptSoFar={liveTranscript}
          liveOffline={liveOffline}
          stream={mediaRef.current}
        />
      )}
    </div>
  );
}
