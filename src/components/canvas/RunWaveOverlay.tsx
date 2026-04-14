import { useRef, useEffect } from 'react';
import { useExecutionStore } from '../../store/executionStore';

const GAP = 22;
const BASE_R = 1;
const WAVE_R = 2.2;
const BASE_ALPHA = 0.0;       // dots invisible at rest (RF Background shows through)
const PEAK_ALPHA = 0.55;
const WAVE_SPEED = 0.0012;    // px per ms
const WAVE_WIDTH = 180;       // px height of the soft band

export default function RunWaveOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const isRunning = useExecutionStore((s) => Object.values(s.status).some((v) => v === 'running'));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!isRunning) {
      // clear and stop
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      cancelAnimationFrame(rafRef.current);
      startRef.current = 0;
      return;
    }

    const ctx = canvas.getContext('2d')!;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    startRef.current = performance.now();

    const draw = (now: number) => {
      const elapsed = now - startRef.current;
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // wave center sweeps top→bottom, wraps
      const waveY = (elapsed * WAVE_SPEED * h) % (h + WAVE_WIDTH * 2) - WAVE_WIDTH;

      const cols = Math.ceil(w / GAP) + 1;
      const rows = Math.ceil(h / GAP) + 1;

      for (let r = 0; r < rows; r++) {
        const y = r * GAP;
        // distance from wave center
        const dist = Math.abs(y - waveY);
        const t = Math.max(0, 1 - dist / WAVE_WIDTH); // 0..1 proximity
        const ease = t * t * (3 - 2 * t); // smoothstep

        const alpha = BASE_ALPHA + (PEAK_ALPHA - BASE_ALPHA) * ease;
        if (alpha < 0.01) continue;

        const radius = BASE_R + (WAVE_R - BASE_R) * ease;

        ctx.fillStyle = `rgba(13, 191, 90, ${alpha})`;
        for (let c = 0; c < cols; c++) {
          const x = c * GAP;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [isRunning]);

  if (!isRunning) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
}
