import { useEffect, useRef } from 'react';

/**
 * Dark ambient gradient — violet + deep teal orbs drifting very slowly over
 * a near-black surface. Grain layer (SVG feTurbulence) sits stationary on top.
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

      // Near-black base with faint blue-violet tint
      ctx.fillStyle = '#07070f';
      ctx.fillRect(0, 0, w, h);

      // Orb 1: deep violet — large, drifts upper-left → center-left
      // ~80px travel over ~20s on a 375px screen (amplitude 0.12, freq 0.08)
      const x1 = w * (0.18 + 0.12 * Math.sin(t * 0.08));
      const y1 = h * (0.28 + 0.10 * Math.cos(t * 0.07 + 1.0));
      const g1 = ctx.createRadialGradient(x1, y1, 0, x1, y1, r * 0.80);
      g1.addColorStop(0,    'rgba(130, 50, 220, 0.72)');
      g1.addColorStop(0.40, 'rgba(90,  30, 160, 0.35)');
      g1.addColorStop(1,    'rgba(50,  10,  90, 0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, w, h);

      // Orb 2: deep teal — medium, drifts right side downward
      const x2 = w * (0.78 + 0.10 * Math.sin(t * 0.06 + 2.2));
      const y2 = h * (0.55 + 0.12 * Math.cos(t * 0.05 + 0.5));
      const g2 = ctx.createRadialGradient(x2, y2, 0, x2, y2, r * 0.65);
      g2.addColorStop(0,    'rgba(0, 150, 170, 0.65)');
      g2.addColorStop(0.45, 'rgba(0, 100, 120, 0.28)');
      g2.addColorStop(1,    'rgba(0,  55,  70, 0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);

      // Orb 3: indigo accent — smaller, lower-center
      const x3 = w * (0.48 + 0.09 * Math.sin(t * 0.09 + 4.1));
      const y3 = h * (0.75 + 0.08 * Math.cos(t * 0.07 + 2.8));
      const g3 = ctx.createRadialGradient(x3, y3, 0, x3, y3, r * 0.45);
      g3.addColorStop(0,    'rgba(70, 40, 180, 0.55)');
      g3.addColorStop(1,    'rgba(40, 20, 110, 0)');
      ctx.fillStyle = g3;
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
      {/* Moving gradient layer */}
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
          opacity: 0.45,
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
