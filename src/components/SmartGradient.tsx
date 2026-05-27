import { useEffect, useRef } from 'react';

/**
 * Full-bleed animated teal/green gradient with static film grain on top.
 * Gradient orbs drift organically via offset sine/cosine curves.
 * Grain layer (SVG feTurbulence, soft-light blend) stays stationary above.
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

      // Base: dark forest green
      ctx.fillStyle = '#2A5032';
      ctx.fillRect(0, 0, w, h);

      // Orb 1: large mint bloom, upper-left drift
      const x1 = w * (0.08 + 0.12 * Math.sin(t * 0.28));
      const y1 = h * (0.18 + 0.10 * Math.cos(t * 0.22));
      const g1 = ctx.createRadialGradient(x1, y1, 0, x1, y1, r * 0.68);
      g1.addColorStop(0,    'rgba(138, 220, 210, 0.92)');
      g1.addColorStop(0.45, 'rgba(98,  178, 163, 0.48)');
      g1.addColorStop(1,    'rgba(72,  138, 120, 0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, w, h);

      // Orb 2: mid-teal, center-right, slower drift
      const x2 = w * (0.74 + 0.09 * Math.sin(t * 0.17 + 1.5));
      const y2 = h * (0.38 + 0.13 * Math.cos(t * 0.14 + 2.0));
      const g2 = ctx.createRadialGradient(x2, y2, 0, x2, y2, r * 0.52);
      g2.addColorStop(0,    'rgba(72, 152, 138, 0.78)');
      g2.addColorStop(0.55, 'rgba(52, 112,  98, 0.38)');
      g2.addColorStop(1,    'rgba(42,  85,  72, 0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);

      // Orb 3: lighter mint accent, lower-center drift
      const x3 = w * (0.42 + 0.18 * Math.sin(t * 0.13 + 3.2));
      const y3 = h * (0.74 + 0.08 * Math.cos(t * 0.19 + 0.8));
      const g3 = ctx.createRadialGradient(x3, y3, 0, x3, y3, r * 0.42);
      g3.addColorStop(0, 'rgba(108, 194, 180, 0.62)');
      g3.addColorStop(1, 'rgba(78,  150, 135, 0)');
      ctx.fillStyle = g3;
      ctx.fillRect(0, 0, w, h);

      // Orb 4: dark-green anchor, top-right corner
      const x4 = w * (0.88 + 0.06 * Math.sin(t * 0.11 + 0.4));
      const y4 = h * (0.08 + 0.06 * Math.cos(t * 0.09 + 1.2));
      const g4 = ctx.createRadialGradient(x4, y4, 0, x4, y4, r * 0.38);
      g4.addColorStop(0, 'rgba(42, 90, 52, 0.80)');
      g4.addColorStop(1, 'rgba(32, 68, 40, 0)');
      ctx.fillStyle = g4;
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
    <div style={{ position: 'relative', background: '#2A5032', overflow: 'hidden', ...style }}>
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
          opacity: 0.55,
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
