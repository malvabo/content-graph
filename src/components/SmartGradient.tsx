import { useEffect, useRef } from 'react';

/**
 * Option B — Presence.
 * Two large soft orbs (violet #C4B5FD at 7%, sky blue #93C5FD at 5%)
 * drifting very slowly on near-black. Calm and alive.
 */
export default function SmartGradient({ style }: { style?: React.CSSProperties }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const start = performance.now();

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const r = Math.max(w, h);

      ctx.fillStyle = '#07070f';
      ctx.fillRect(0, 0, w, h);

      // Orb 1: violet #C4B5FD at 7% — upper-left, slow drift
      const x1 = w * (0.22 + 0.10 * Math.sin(t * 0.08));
      const y1 = h * (0.30 + 0.08 * Math.cos(t * 0.07 + 1.0));
      const g1 = ctx.createRadialGradient(x1, y1, 0, x1, y1, r * 0.90);
      g1.addColorStop(0,   'rgba(196, 181, 253, 0.07)');
      g1.addColorStop(0.5, 'rgba(196, 181, 253, 0.03)');
      g1.addColorStop(1,   'rgba(196, 181, 253, 0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, w, h);

      // Orb 2: sky blue #93C5FD at 5% — lower-right, slightly different phase
      const x2 = w * (0.72 + 0.09 * Math.sin(t * 0.06 + 2.2));
      const y2 = h * (0.62 + 0.10 * Math.cos(t * 0.05 + 0.5));
      const g2 = ctx.createRadialGradient(x2, y2, 0, x2, y2, r * 0.85);
      g2.addColorStop(0,   'rgba(147, 197, 253, 0.05)');
      g2.addColorStop(0.5, 'rgba(147, 197, 253, 0.02)');
      g2.addColorStop(1,   'rgba(147, 197, 253, 0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div style={{ position: 'relative', background: '#07070f', overflow: 'hidden', ...style }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* Static grain on top */}
      <svg
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          mixBlendMode: 'soft-light',
          opacity: 0.35,
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <filter id="sg-grain" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#sg-grain)" />
      </svg>
    </div>
  );
}
