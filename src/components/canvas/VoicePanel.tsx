import { useRef, useEffect, useState, useCallback } from 'react';

interface Props { onTranscriptReady: (text: string) => void }

export default function VoicePanel({ onTranscriptReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [showText, setShowText] = useState(false);
  const recRef = useRef<any>(null);
  const tRef = useRef(0);
  const fullRef = useRef('');
  const listeningRef = useRef(false);

  // Orb animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let raf: number;
    const draw = () => {
      const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2;
      ctx.fillStyle = '#f2efe9';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 5; i++) {
        const angle = tRef.current * 0.8 + i * 1.3;
        const r = 160 + Math.sin(tRef.current * 0.5 + i) * 80;
        const x = cx + Math.cos(angle) * r * 0.7;
        const y = cy + Math.sin(angle) * r * 0.5;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, 250 + Math.sin(tRef.current + i) * 60);
        const hue = listening ? 145 + i * 10 : 150 + i * 8;
        const alpha = listening ? 0.35 : 0.15;
        grad.addColorStop(0, `hsla(${hue},55%,65%,${alpha})`);
        grad.addColorStop(0.5, `hsla(${hue + 20},45%,55%,${alpha * 0.4})`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
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
    <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden cursor-pointer"
      onClick={() => !listening && start()}>
      {/* Full background shader */}
      <canvas ref={canvasRef} width={800} height={800} className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }} />

      <div className={`relative z-10 flex flex-col items-center gap-4 ${showText ? '' : 'flex-1 justify-center'}`} style={{ padding: showText ? '32px 0 16px' : 0 }}>
        <div style={{ font: '500 14px/20px var(--font-sans)', color: 'var(--cg-ink-3)' }}>
          {listening ? 'Listening...' : 'Tap to start listening'}
        </div>
      </div>

      {showText && (
        <div className="relative z-10 flex-1 w-full max-w-[720px] overflow-y-auto px-8">
          <div style={{ font: '400 15px/1.7 var(--font-sans)', color: 'var(--cg-ink)' }} className="whitespace-pre-wrap">
            {transcript}{interim && <span style={{ color: 'var(--cg-ink-3)' }}>{interim}</span>}
          </div>
        </div>
      )}

      <div className="relative z-10 flex gap-3 py-6">
        <button className="btn btn-outline" onClick={() => setShowText(!showText)}>{showText ? 'Hide text' : 'Show text'}</button>
        <button className="btn btn-primary" onClick={endSession}>End session</button>
      </div>
      <div className="relative z-10" style={{ font: '400 14px/1.5 var(--font-sans)', color: 'var(--cg-ink-3)', paddingBottom: 24 }}>
        {listening ? 'Voice on' : 'Voice off'}
      </div>
    </div>
  );
}
