import { useRef, useEffect } from 'react';
import { Panel, useViewport } from '@xyflow/react';

const SPOT_R = 20;

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

    let lightColor = '';
    let darkColor = '';
    const updateColors = () => {
      const s = getComputedStyle(document.documentElement);
      lightColor = s.getPropertyValue('--color-border-subtle').trim() || '#333338';
      darkColor = s.getPropertyValue('--color-text-primary').trim() || '#1A2420';
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

      // Calculate dot grid based on viewport transform
      const { x: vx, y: vy, zoom } = viewport;
      const scaledGap = GAP * zoom;
      if (scaledGap < 3) { rafRef.current = requestAnimationFrame(draw); return; }

      const offsetX = (vx % scaledGap + scaledGap) % scaledGap;
      const offsetY = (vy % scaledGap + scaledGap) % scaledGap;

      for (let x = offsetX; x < w; x += scaledGap) {
        for (let y = offsetY; y < h; y += scaledGap) {
          const dx = x - mx, dy = y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const inSpot = dist < SPOT_R;

          ctx.beginPath();
          ctx.arc(x, y, DOT_R * zoom, 0, Math.PI * 2);
          ctx.fillStyle = inSpot ? darkColor : lightColor;
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
