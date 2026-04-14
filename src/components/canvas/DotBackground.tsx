import { useRef, useEffect, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';

const GAP = 14;
const RADIUS = 80;
const BASE_COLOR = [213, 208, 200]; // #D5D0C8
const HOVER_COLOR = [40, 36, 32];   // near black

export default function DotBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -999, y: -999 });
  const rafRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0 });
  const { getViewport } = useReactFlow();

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) { rafRef.current = requestAnimationFrame(draw); return; }
    const ctx = canvas.getContext('2d')!;
    const { w, h } = sizeRef.current;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const { x: panX, y: panY, zoom } = getViewport();
    const scaledGap = GAP * zoom;
    const offsetX = ((panX * zoom) % scaledGap + scaledGap) % scaledGap;
    const offsetY = ((panY * zoom) % scaledGap + scaledGap) % scaledGap;
    const mx = mouseRef.current.x, my = mouseRef.current.y;

    const cols = Math.ceil(w / scaledGap) + 1;
    const rows = Math.ceil(h / scaledGap) + 1;

    for (let r = 0; r < rows; r++) {
      const y = offsetY + r * scaledGap;
      for (let c = 0; c < cols; c++) {
        const x = offsetX + c * scaledGap;
        const dist = Math.sqrt((x - mx) ** 2 + (y - my) ** 2);
        const t = dist < RADIUS ? 1 - dist / RADIUS : 0;
        const blend = t * t;
        const cr = BASE_COLOR[0] + (HOVER_COLOR[0] - BASE_COLOR[0]) * blend;
        const cg = BASE_COLOR[1] + (HOVER_COLOR[1] - BASE_COLOR[1]) * blend;
        const cb = BASE_COLOR[2] + (HOVER_COLOR[2] - BASE_COLOR[2]) * blend;
        ctx.fillStyle = `rgb(${cr|0},${cg|0},${cb|0})`;
        ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
      }
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    rafRef.current = requestAnimationFrame(draw);
  }, [getViewport]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      sizeRef.current = { w: rect.width, h: rect.height };
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onLeave = () => { mouseRef.current = { x: -999, y: -999 }; };
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);

    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); canvas.removeEventListener('mousemove', onMove); canvas.removeEventListener('mouseleave', onLeave); };
  }, [draw]);

  return (
    <canvas ref={canvasRef} className="absolute inset-0 pointer-events-auto" style={{ zIndex: 0 }} />
  );
}
