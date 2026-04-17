import { useRef, useEffect, useState, useCallback } from 'react';

interface Props { onTranscriptReady: (text: string) => void }

export default function VoicePanel({ onTranscriptReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const recRef = useRef<any>(null);
  const tRef = useRef(0);
  const fullRef = useRef('');
  const listeningRef = useRef(false);
  const ampRef = useRef(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  /* Orb animation — warm palette, no green ring, no dark artifacts */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const BG = { current: getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() || '#F2EFE9' };
    const obs = new MutationObserver(() => { BG.current = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() || '#F2EFE9'; });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    let raf: number;
    let collapse = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * devicePixelRatio;
      canvas.height = rect.height * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const target = listening ? 1 : 0;
      collapse += (target - collapse) * 0.03;
      const amp = ampRef.current;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width, h = rect.height, cx = w / 2, cy = h / 2;

      ctx.fillStyle = BG.current;
      ctx.fillRect(0, 0, w, h);

      /* Warm-toned floating blobs */
      const blobs = 4;
      for (let i = 0; i < blobs; i++) {
        const angle = tRef.current * 0.6 + i * (Math.PI * 2 / blobs);
        const breathe = 1 + amp * 0.4;
        const spreadR = (140 + Math.sin(tRef.current * 0.4 + i) * 50) * (1 - collapse * 0.88);
        const x = cx + Math.cos(angle) * spreadR;
        const y = cy + Math.sin(angle) * spreadR;
        const size = (180 + Math.sin(tRef.current * 0.7 + i * 2) * 40) * (1 - collapse * 0.5) * breathe;

        const grad = ctx.createRadialGradient(x, y, 0, x, y, size);
        const hue = 170 + i * 15;
        const sat = 35 + collapse * 25;
        const light = 72 - collapse * 12;
        const alpha = 0.12 + collapse * 0.3;
        grad.addColorStop(0, `hsla(${hue},${sat}%,${light}%,${alpha})`);
        grad.addColorStop(0.6, `hsla(${hue + 10},${sat - 5}%,${light + 8}%,${alpha * 0.25})`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      tRef.current += 0.012;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); obs.disconnect(); };
  }, [listening]);

  const streamRef = useRef<MediaStream | null>(null);

  /* Audio amplitude from mic */
  const startAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const actx = new AudioContext();
      const src = actx.createMediaStreamSource(stream);
      const analyser = actx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      audioCtxRef.current = actx;
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const poll = () => {
        if (!listeningRef.current) return;
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        ampRef.current = (sum / data.length) / 255;
        requestAnimationFrame(poll);
      };
      poll();
    } catch { /* mic denied — orb still works, just no amplitude */ }
  }, []);

  const start = useCallback(() => {
    if (listeningRef.current) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    fullRef.current = '';
    setTranscript('');
    setInterim('');
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onstart = () => { setListening(true); listeningRef.current = true; };
    rec.onresult = (e: any) => {
      let fin = '', int = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) fin += e.results[i][0].transcript + ' ';
        else int = e.results[i][0].transcript;
      }
      if (fin) { fullRef.current += fin; setTranscript(fullRef.current); }
      setInterim(int);
    };
    rec.onerror = () => { setListening(false); listeningRef.current = false; };
    rec.onend = () => { if (listeningRef.current) try { rec.start(); } catch { /* empty */ } };
    rec.start();
    recRef.current = rec;
    startAudio();
  }, [startAudio]);

  const stop = useCallback(() => {
    setListening(false);
    listeningRef.current = false;
    ampRef.current = 0;
    recRef.current?.stop();
    recRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { stop(); }, [stop]);

  const [emptyMsg, setEmptyMsg] = useState(false);

  const endSession = useCallback(() => {
    stop();
    if (fullRef.current.trim()) {
      onTranscriptReady(fullRef.current.trim());
    } else {
      setEmptyMsg(true);
      setTimeout(() => setEmptyMsg(false), 2000);
    }
  }, [stop, onTranscriptReady]);

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden cursor-pointer"
      style={{ background: 'var(--color-bg)' }}
      onClick={() => !listening && start()}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }} />

      {/* Centered label + orb group */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-6">
        {/* Transcript while listening */}
        {listening && (transcript || interim) && (
          <div style={{
            maxWidth: 480, textAlign: 'center', padding: '0 24px',
            fontFamily: 'var(--font-sans)', fontSize: 15, lineHeight: 1.6,
            color: 'var(--color-text-secondary)',
          }}>
            {transcript}<span style={{ opacity: 0.5 }}>{interim}</span>
          </div>
        )}
      </div>

      {/* Show full transcript after stopping */}
      {!listening && (transcript || interim) && (
        <div className="relative z-10 flex-1 w-full max-w-[720px] mx-auto overflow-y-auto px-8 py-4">
          <div style={{
            fontWeight: 'var(--weight-normal)', fontSize: 'var(--text-md)',
            lineHeight: 'var(--leading-loose)', fontFamily: 'var(--font-sans)',
            color: 'var(--color-text-primary)',
          }} className="whitespace-pre-wrap">
            {transcript}<span style={{ color: 'var(--color-text-tertiary)' }}>{interim}</span>
          </div>
        </div>
      )}

      {/* Bottom actions */}
      <div className="relative z-10 flex gap-3 py-8 justify-center">
        {listening && (
          <button
            className="btn-xl btn-ghost"
            style={{ minWidth: 120, fontSize: 15 }}
            onClick={(e) => { e.stopPropagation(); stop(); }}
          >
            Cancel
          </button>
        )}
        <button
          className="btn-xl btn-primary"
          style={{ minWidth: 200, fontSize: 16 }}
          onClick={(e) => { e.stopPropagation(); endSession(); }}
        >
          End session
        </button>
        {emptyMsg && (
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
            No speech detected
          </span>
        )}
      </div>

      {/* Animated dots CSS */}
      <style>{`
        .voice-dots::after {
          content: '';
          animation: dots 1.5s steps(4, end) infinite;
        }
        @keyframes dots {
          0% { content: ''; }
          25% { content: '.'; }
          50% { content: '..'; }
          75% { content: '...'; }
          100% { content: ''; }
        }
      `}</style>
    </div>
  );
}
