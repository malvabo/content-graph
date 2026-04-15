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

  // Orb animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const BG = '#1a1a1a';
    let raf: number;
    let collapse = 0;

    const particles = Array.from({ length: 40 }, () => ({
      angle: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.5,
      size: 2 + Math.random() * 4,
      hue: 175 + Math.random() * 15,
      phase: Math.random() * Math.PI * 2,
      homeDist: 80 + Math.random() * 200,
    }));

    const FINAL_R = 60;

    const draw = () => {
      const target = listening ? 1 : 0;
      collapse += (target - collapse) * 0.06;
      if (Math.abs(collapse - target) < 0.005) collapse = target;

      const c3 = collapse * collapse * collapse;
      const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2;

      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);

      // Clip to canvas bounds
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.clip();

      // --- Fog blobs: even radial spread ---
      const fogAlpha = (1 - c3) * 0.25;
      if (fogAlpha > 0.01) {
        for (let i = 0; i < 5; i++) {
          const angle = tRef.current * 0.8 + i * 1.3;
          const spread = (160 + Math.sin(tRef.current * 0.5 + i) * 80) * (1 - c3);
          const x = cx + Math.cos(angle) * spread;
          const y = cy + Math.sin(angle) * spread;
          const size = (250 + Math.sin(tRef.current + i) * 60) * (1 - c3 * 0.85);
          const grad = ctx.createRadialGradient(x, y, 0, x, y, Math.max(size, 1));
          const hue = 178 + i * 5;
          grad.addColorStop(0, `hsla(${hue},80%,45%,${fogAlpha})`);
          grad.addColorStop(0.6, `hsla(${hue + 5},70%,40%,${fogAlpha * 0.3})`);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, w, h);
        }
      }

      // --- Particles: perfectly circular orbits ---
      for (const p of particles) {
        p.angle += p.speed * 0.01;
        const targetDist = FINAL_R * 0.6 + Math.sin(tRef.current * 2 + p.phase) * 8;
        const d = p.homeDist * (1 - c3) + targetDist * c3;
        const px = cx + Math.cos(p.angle + Math.sin(tRef.current * 0.3 + p.phase) * 0.5) * d;
        const py = cy + Math.sin(p.angle + Math.cos(tRef.current * 0.4 + p.phase) * 0.5) * d;
        const sat = 70 + collapse * 25;
        const light = 50 - collapse * 15;
        const alpha = 0.15 + collapse * 0.6;
        const sz = p.size * (1 - collapse * 0.5);
        ctx.beginPath();
        ctx.arc(px, py, Math.max(sz, 0.5), 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},${sat}%,${light}%,${alpha})`;
        ctx.fill();
      }

      // --- Central glow ---
      if (collapse > 0.1) {
        const gp = Math.min(1, (collapse - 0.1) / 0.9);
        const gp2 = gp * gp;
        const outerR = 200 * (1 - gp2 * 0.7);
        const grad = ctx.createRadialGradient(cx, cy, FINAL_R * gp2 * 0.3, cx, cy, outerR);
        grad.addColorStop(0, `hsla(180,90%,38%,${gp2 * 0.7})`);
        grad.addColorStop(0.4, `hsla(178,80%,42%,${gp2 * 0.35})`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- Hard circle ---
      if (collapse > 0.7) {
        const hp = ((collapse - 0.7) / 0.3) ** 2;
        ctx.beginPath();
        ctx.arc(cx, cy, FINAL_R, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(180,90%,32%,${hp * 0.5})`;
        ctx.fill();
      }

      // --- Stroke ring: same center & radius as circle ---
      if (collapse > 0.5) {
        const sp = ((Math.min(1, (collapse - 0.5) / 0.5)) ** 2);
        ctx.beginPath();
        ctx.arc(cx, cy, FINAL_R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * sp);
        ctx.strokeStyle = `hsla(180,80%,35%,${sp * 0.9})`;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      ctx.restore();
      tRef.current += 0.015;
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
      style={{ background: '#1a1a1a' }}
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
