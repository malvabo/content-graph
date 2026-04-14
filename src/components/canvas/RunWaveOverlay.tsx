import { useRef, useEffect } from 'react';
import { useExecutionStore } from '../../store/executionStore';

const GAP = 22;
const BASE_R = 1;
const WAVE_R = 2.4;
const PEAK_ALPHA = 0.5;
const WAVE_WIDTH = 220;
const CYCLE_MS = 4000; // one full sweep top→bottom

// cubic-bezier ease-in-out: slow start, fast middle, slow end
function bezierEase(t: number): number {
  return t * t * (3 - 2 * t); // smoothstep approximation of cubic-bezier(.4,0,.2,1)
}

export default function RunWaveOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const isRunning = useExecutionStore((s) => Object.values(s.status).some((v) => v === 'running'));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!isRunning) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      cancelAnimationFrame(rafRef.current);
      startRef.current = 0;
      return;
    }

    const ctx = canvas.getContext('2d')!;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    startRef.current = performance.now();

    const draw = (now: number) => {
      const elapsed = now - startRef.current;
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // linear progress 0→1 within cycle, then repeat
      const linearT = (elapsed % CYCLE_MS) / CYCLE_MS;
      // apply bezier easing so it's slow at top, fast in middle, slow at bottom
      const easedT = bezierEase(linearT);
      // wave center position: from -WAVE_WIDTH to h+WAVE_WIDTH
      const totalTravel = h + WAVE_WIDTH * 2;
      const waveY = -WAVE_WIDTH + easedT * totalTravel;

      const cols = Math.ceil(w / GAP) + 1;
      const rows = Math.ceil(h / GAP) + 1;

      for (let r = 0; r < rows; r++) {
        const y = r * GAP;
        const dist = Math.abs(y - waveY);
        const t = Math.max(0, 1 - dist / WAVE_WIDTH);
        const ease = t * t * (3 - 2 * t);

        const alpha = PEAK_ALPHA * ease;
        if (alpha < 0.01) continue;

        const radius = BASE_R + (WAVE_R - BASE_R) * ease;
        ctx.fillStyle = `rgba(13, 191, 90, ${alpha})`;

        for (let c = 0; c < cols; c++) {
          ctx.beginPath();
          ctx.arc(c * GAP, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', resize); };
  }, [isRunning]);

  if (!isRunning) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9 }}
    />
  );
}
