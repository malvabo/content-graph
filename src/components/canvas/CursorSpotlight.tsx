import { useRef, useEffect, useCallback } from 'react';
import { Panel } from '@xyflow/react';

const GAP = 14;
const RADIUS = 100;
const DOT_R = 1.2;
const DOT_COLOR = [90, 85, 78]; // warm dark grey RGB

export default function CursorSpotlight() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -999, y: -999 });
  const rafRef = useRef(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width, h = canvas.height;
    const mx = mouseRef.current.x, my = mouseRef.current.y;
    ctx.clearRect(0, 0, w, h);

    if (mx < -RADIUS || my < -RADIUS) { rafRef.current = requestAnimationFrame(draw); return; }

    const startCol = Math.max(0, Math.floor((mx - RADIUS) / GAP));
    const endCol = Math.min(Math.ceil(w / GAP), Math.ceil((mx + RADIUS) / GAP));
    const startRow = Math.max(0, Math.floor((my - RADIUS) / GAP));
    const endRow = Math.min(Math.ceil(h / GAP), Math.ceil((my + RADIUS) / GAP));

    for (let r = startRow; r <= endRow; r++) {
      const y = r * GAP;
      for (let c = startCol; c <= endCol; c++) {
        const x = c * GAP;
        const dist = Math.sqrt((x - mx) ** 2 + (y - my) ** 2);
        if (dist > RADIUS) continue;
        const t = 1 - dist / RADIUS;
        const alpha = t * t * 0.7;
        ctx.fillStyle = `rgba(${DOT_COLOR[0]},${DOT_COLOR[1]},${DOT_COLOR[2]},${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, DOT_R, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    rafRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const p = canvas.parentElement?.parentElement;
      if (p) { canvas.width = p.clientWidth; canvas.height = p.clientHeight; }
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement?.parentElement) ro.observe(canvas.parentElement.parentElement);

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onLeave = () => { mouseRef.current = { x: -999, y: -999 }; };

    canvas.parentElement?.parentElement?.addEventListener('mousemove', onMove);
    canvas.parentElement?.parentElement?.addEventListener('mouseleave', onLeave);

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      canvas.parentElement?.parentElement?.removeEventListener('mousemove', onMove);
      canvas.parentElement?.parentElement?.removeEventListener('mouseleave', onLeave);
    };
  }, [draw]);

  return (
    <Panel position="top-left" style={{ margin: 0, padding: 0, inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </Panel>
  );
}
