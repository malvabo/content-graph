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

  // Orb animation — dark sphere with aurora ring
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const BG = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() || '#F2EFE9';
    let raf: number;
    let collapse = 0;
    const R = 120; // sphere radius

    const draw = () => {
      const target = listening ? 1 : 0;
      collapse += (target - collapse) * 0.04;
      if (Math.abs(collapse - target) < 0.003) collapse = target;

      const t = tRef.current;
      const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2;
      const c = collapse;

      // Clear with page background
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.clip();

      // --- Fog state (collapse = 0): soft teal blobs ---
      const fogAlpha = (1 - c) * 0.22;
      if (fogAlpha > 0.005) {
        for (let i = 0; i < 5; i++) {
          const a = t * 0.8 + i * 1.3;
          const spread = (160 + Math.sin(t * 0.5 + i) * 80) * (1 - c);
          const x = cx + Math.cos(a) * spread;
          const y = cy + Math.sin(a) * spread;
          const sz = (250 + Math.sin(t + i) * 60) * (1 - c * 0.85);
          const grad = ctx.createRadialGradient(x, y, 0, x, y, Math.max(sz, 1));
          grad.addColorStop(0, `hsla(${178 + i * 5},80%,45%,${fogAlpha})`);
          grad.addColorStop(0.6, `hsla(${183 + i * 5},70%,40%,${fogAlpha * 0.3})`);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);
        }
      }

      // --- Collapsed state: dark sphere with aurora ---
      if (c > 0.05) {
        const p = Math.min(1, (c - 0.05) / 0.95);
        const p2 = p * p;

        // Subtle tinted sphere body (not dark/opaque)
        const sphereGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        sphereGrad.addColorStop(0, `rgba(0,40,50,${p2 * 0.25})`);
        sphereGrad.addColorStop(0.7, `rgba(0,30,40,${p2 * 0.18})`);
        sphereGrad.addColorStop(1, `rgba(0,20,30,${p2 * 0.1})`);
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fillStyle = sphereGrad;
        ctx.fill();

        // Aurora ring — 3 overlapping glowing arcs that orbit
        for (let i = 0; i < 3; i++) {
          const baseAngle = t * (0.4 + i * 0.15) + i * 2.1;
          const wobble = Math.sin(t * 0.7 + i * 1.5) * 0.3;
          const ringR = R * (0.55 + Math.sin(t * 0.3 + i) * 0.08);
          const arcLen = Math.PI * (0.8 + Math.sin(t * 0.5 + i * 2) * 0.3);

          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(wobble);

          // Each arc: teal → purple gradient feel via hue shift
          const hue = 190 + i * 40 + Math.sin(t + i) * 20;
          const light = 65 + Math.sin(t * 0.8 + i) * 10;

          // Outer glow
          ctx.beginPath();
          ctx.arc(0, 0, ringR, baseAngle, baseAngle + arcLen);
          ctx.strokeStyle = `hsla(${hue},70%,${light}%,${p2 * 0.15})`;
          ctx.lineWidth = 20;
          ctx.lineCap = 'round';
          ctx.stroke();

          // Mid glow
          ctx.beginPath();
          ctx.arc(0, 0, ringR, baseAngle, baseAngle + arcLen);
          ctx.strokeStyle = `hsla(${hue},80%,${light + 10}%,${p2 * 0.35})`;
          ctx.lineWidth = 8;
          ctx.stroke();

          // Core bright line
          ctx.beginPath();
          ctx.arc(0, 0, ringR, baseAngle, baseAngle + arcLen);
          ctx.strokeStyle = `hsla(${hue - 10},60%,${light + 25}%,${p2 * 0.7})`;
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.restore();
        }

        // Subtle sphere edge highlight
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,80,80,${p2 * 0.15})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.restore();
      tRef.current += 0.012;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [listening]);

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
  }, []);

  const stop = useCallback(() => {
    setListening(false);
    listeningRef.current = false;
    recRef.current?.stop();
    recRef.current = null;
  }, []);

  const endSession = useCallback(() => {
    stop();
    if (fullRef.current.trim()) onTranscriptReady(fullRef.current.trim());
  }, [stop, onTranscriptReady]);

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden cursor-pointer"
      onClick={() => !listening && start()}>
      {/* Full background shader */}
      <canvas ref={canvasRef} width={800} height={800} className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }} />

      <div className="relative z-10 flex flex-col items-center gap-4 pt-10">
        <div style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-fixed)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>
          {listening ? 'Listening...' : 'Tap anywhere to start'}
        </div>
      </div>

      {/* Show transcript only when not actively listening */}
      {!listening && (transcript || interim) && (
        <div className="relative z-10 flex-1 w-full max-w-[720px] mx-auto overflow-y-auto px-8 py-4">
          <div style={{ fontWeight: 'var(--weight-normal)', fontSize: 'var(--text-md)', lineHeight: 'var(--leading-loose)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }} className="whitespace-pre-wrap">
            {transcript}<span style={{ color: 'var(--color-text-tertiary)' }}>{interim}</span>
          </div>
        </div>
      )}

      <div className="flex-1" />

      <div className="relative z-10 flex gap-3 py-8 justify-center">
        <button className="btn-xl btn-primary" style={{ minWidth: 200, fontSize: 16 }} onClick={endSession}>End session</button>
      </div>
    </div>
  );
}
