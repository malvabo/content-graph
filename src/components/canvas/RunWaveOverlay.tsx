import { useRef, useEffect, useState } from 'react';
import { Panel } from '@xyflow/react';
import { useExecutionStore } from '../../store/executionStore';

const GAP = 14;
const BASE_R = 1;
const WAVE_R = 1;
const PEAK_ALPHA = 0.12;
const WAVE_WIDTH = 300;
const CYCLE_MS = 10000;
const MIN_DISPLAY_MS = 5000;

function bezierEase(t: number): number {
  return t * t * (3 - 2 * t);
}

export default function RunWaveOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const isRunning = useExecutionStore((s) => s.runAllActive);

  useEffect(() => {
    if (isRunning) {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = undefined; }
      setVisible(true);
      startRef.current = performance.now();
    } else if (visible) {
      const elapsed = performance.now() - startRef.current;
      const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);
      timerRef.current = setTimeout(() => setVisible(false), remaining);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isRunning]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !visible) return;

    const ctx = canvas.getContext('2d')!;
    const resize = () => {
      const parent = canvas.parentElement?.parentElement;
      if (parent) { canvas.width = parent.clientWidth; canvas.height = parent.clientHeight; }
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement?.parentElement) ro.observe(canvas.parentElement.parentElement);

    const animStart = performance.now();

    const draw = (now: number) => {
      const elapsed = now - animStart;
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const linearT = (elapsed % CYCLE_MS) / CYCLE_MS;
      const easedT = bezierEase(linearT);
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
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [visible]);

  if (!visible) return null;

  return (
    <Panel position="top-left" style={{ margin: 0, padding: 0, inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </Panel>
  );
}
