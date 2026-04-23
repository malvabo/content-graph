import { useRef, useEffect, useState } from 'react';
import { Panel } from '@xyflow/react';
import { useExecutionStore } from '../../store/executionStore';

const PEAK_ALPHA = 0.35;
const WAVE_WIDTH = 250;
const CYCLE_MS = 10000;
const MIN_DISPLAY_MS = 5000;

function bezierEase(t: number): number {
  return t * t * (3 - 2 * t);
}

export default function RunWaveOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const showUntilRef = useRef(0);
  const [show, setShow] = useState(false);
  const isRunning = useExecutionStore((s) => s.runAllActive);

  // Immediately show when running starts, keep for MIN_DISPLAY_MS after stop
  useEffect(() => {
    if (isRunning) {
      showUntilRef.current = performance.now() + MIN_DISPLAY_MS;
      setShow(true);
    } else if (show) {
      const remaining = Math.max(0, showUntilRef.current - performance.now());
      if (remaining <= 0) { setShow(false); return; }
      const t = setTimeout(() => setShow(false), remaining);
      return () => clearTimeout(t);
    }
  }, [isRunning]); // eslint-disable-line react-hooks/exhaustive-deps

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !show) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const start = performance.now();
    const s = getComputedStyle(document.documentElement);
    const GAP = parseFloat(s.getPropertyValue('--dot-gap')) || 12;
    const BASE_R = parseFloat(s.getPropertyValue('--dot-size')) || 1.5;

    const draw = (now: number) => {
      const elapsed = now - start;
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const t = (elapsed % CYCLE_MS) / CYCLE_MS;
      const eased = bezierEase(t);
      const travel = h + WAVE_WIDTH * 2;
      const waveY = -WAVE_WIDTH + eased * travel;
      const cols = Math.ceil(w / GAP) + 1;
      const rows = Math.ceil(h / GAP) + 1;
      for (let r = 0; r < rows; r++) {
        const y = r * GAP;
        const dist = Math.abs(y - waveY);
        const p = Math.max(0, 1 - dist / WAVE_WIDTH);
        const ease = p * p * (3 - 2 * p);
        const alpha = PEAK_ALPHA * ease;
        if (alpha < 0.01) continue;
        ctx.fillStyle = `rgba(13,191,90,${alpha})`;
        for (let c = 0; c < cols; c++) {
          ctx.beginPath();
          ctx.arc(c * GAP, y, BASE_R, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [show]);

  if (!show) return null;

  return (
    <Panel position="top-left" style={{ margin: 0, padding: 0, inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
      <canvas ref={canvasRef} aria-hidden="true" style={{ width: '100%', height: '100%', display: 'block' }} />
    </Panel>
  );
}
