import { useRef, useEffect } from 'react';
import { Panel, useViewport } from '@xyflow/react';

const SPOT_R = 80;

export default function DotSpotlight() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -999, y: -999 });
  const rafRef = useRef(0);
  const viewport = useViewport();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onLeave = () => { mouseRef.current = { x: -999, y: -999 }; };

    canvas.parentElement?.addEventListener('mousemove', onMove);
    canvas.parentElement?.addEventListener('mouseleave', onLeave);

    let baseColor = [0, 0, 0];
    let brightColor = [0, 0, 0];
    const hexToRgb = (hex: string) => {
      hex = hex.replace('#', '');
      return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
    };
    const updateColors = () => {
      const s = getComputedStyle(document.documentElement);
      baseColor = hexToRgb(s.getPropertyValue('--color-dot').trim() || '#42424c');
      brightColor = hexToRgb(s.getPropertyValue('--color-border-strong').trim() || '#3a3a42');
    };
    updateColors();
    const observer = new MutationObserver(updateColors);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    const draw = () => {
      const w = canvas.width, h = canvas.height;
      const mx = mouseRef.current.x, my = mouseRef.current.y;
      ctx.clearRect(0, 0, w, h);

      const s = getComputedStyle(document.documentElement);
      const GAP = parseFloat(s.getPropertyValue('--dot-gap')) || 24;
      const DOT_R = parseFloat(s.getPropertyValue('--dot-size')) || 1;

      const { x: vx, y: vy, zoom } = viewport;
      const scaledGap = GAP * zoom;
      if (scaledGap < 3) { rafRef.current = requestAnimationFrame(draw); return; }

      const offsetX = (vx % scaledGap + scaledGap) % scaledGap;
      const offsetY = (vy % scaledGap + scaledGap) % scaledGap;

      for (let x = offsetX; x < w; x += scaledGap) {
        for (let y = offsetY; y < h; y += scaledGap) {
          const dx = x - mx, dy = y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const t = Math.max(0, 1 - dist / SPOT_R);
          const ease = t * t;

          const r = Math.round(baseColor[0] + (brightColor[0] - baseColor[0]) * ease);
          const g = Math.round(baseColor[1] + (brightColor[1] - baseColor[1]) * ease);
          const b = Math.round(baseColor[2] + (brightColor[2] - baseColor[2]) * ease);

          ctx.beginPath();
          ctx.arc(x, y, DOT_R * zoom, 0, Math.PI * 2);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      observer.disconnect();
      canvas.parentElement?.removeEventListener('mousemove', onMove);
      canvas.parentElement?.removeEventListener('mouseleave', onLeave);
    };
  }, [viewport]);

  return (
    <Panel position="top-left" style={{ margin: 0, padding: 0, inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </Panel>
  );
}
