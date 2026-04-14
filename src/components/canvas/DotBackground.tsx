import { useRef, useEffect } from 'react';

const GAP = 14;
const RADIUS = 80;
const BASE = [213, 208, 200];
const HOVER = [40, 36, 32];

export default function DotBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -999, y: -999 });

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr, h = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const mx = mouseRef.current.x, my = mouseRef.current.y;
    const hasHover = mx > -RADIUS;
    const cols = Math.ceil(w / GAP) + 1;
    const rows = Math.ceil(h / GAP) + 1;
    const baseStyle = `rgb(${BASE[0]},${BASE[1]},${BASE[2]})`;

    for (let r = 0; r < rows; r++) {
      const y = r * GAP;
      for (let c = 0; c < cols; c++) {
        const x = c * GAP;
        if (hasHover) {
          const dx = x - mx, dy = y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < RADIUS) {
            const t = 1 - dist / RADIUS;
            const b = t * t;
            ctx.fillStyle = `rgb(${BASE[0] + (HOVER[0] - BASE[0]) * b | 0},${BASE[1] + (HOVER[1] - BASE[1]) * b | 0},${BASE[2] + (HOVER[2] - BASE[2]) * b | 0})`;
          } else {
            ctx.fillStyle = baseStyle;
          }
        } else {
          ctx.fillStyle = baseStyle;
        }
        ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      draw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      draw();
    };
    const onLeave = () => { mouseRef.current = { x: -999, y: -999 }; draw(); };
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    return () => { ro.disconnect(); canvas.removeEventListener('mousemove', onMove); canvas.removeEventListener('mouseleave', onLeave); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-auto" style={{ zIndex: 0 }} />;
}
