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
    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() || '#F2EFE9';
    let raf: number;
    let collapse = 0; // 0 = fog, 1 = circle
    const draw = () => {
      const target = listening ? 1 : 0;
      collapse += (target - collapse) * 0.025;
      const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2;
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 5; i++) {
        const angle = tRef.current * 0.8 + i * 1.3;
        // Fog: blobs spread wide. Circle: all converge to center
        const spreadR = 160 + Math.sin(tRef.current * 0.5 + i) * 80;
        const r = spreadR * (1 - collapse * 0.92);
        const x = cx + Math.cos(angle) * r * 0.7;
        const y = cy + Math.sin(angle) * r * 0.5;
        // Fog: large soft radius. Circle: tight small radius
        const fogSize = 250 + Math.sin(tRef.current + i) * 60;
        const size = fogSize * (1 - collapse * 0.7);
        const grad = ctx.createRadialGradient(x, y, 0, x, y, size);
        const hue = 145 + i * 10;
        // Saturation and alpha increase as it collapses
        const sat = 55 + collapse * 30;
        const light = 65 - collapse * 20;
        const alpha = 0.15 + collapse * 0.45;
        grad.addColorStop(0, `hsla(${hue},${sat}%,${light}%,${alpha})`);
        grad.addColorStop(0.5, `hsla(${hue + 20},${sat - 10}%,${light + 5}%,${alpha * 0.4})`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      // Stroke ring appears as it collapses into circle
      if (collapse > 0.3) {
        const ringAlpha = (collapse - 0.3) / 0.7;
        const ringR = 60 + (1 - collapse) * 40;
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(150,60%,45%,${ringAlpha * 0.8})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

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
