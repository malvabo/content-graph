import { useEffect, useRef } from 'react';

type Variant = 'presence' | 'warmth';

const VARIANTS: Record<Variant, {
  bg: string;
  orbs: Array<{ r: number; g: number; b: number; a: number; cx: number; cy: number; radius: number; freqX: number; freqY: number; phaseX: number; phaseY: number; ampX: number; ampY: number }>;
}> = {
  presence: {
    bg: '#ffffff',
    orbs: [
      { r: 196, g: 181, b: 253, a: 0.62, cx: 0.20, cy: 0.25, radius: 0.70, freqX: 0.35, freqY: 0.28, phaseX: 0,   phaseY: 1.0, ampX: 0.14, ampY: 0.12 },
      { r: 147, g: 197, b: 253, a: 0.50, cx: 0.75, cy: 0.65, radius: 0.65, freqX: 0.25, freqY: 0.20, phaseX: 2.2, phaseY: 0.5, ampX: 0.12, ampY: 0.14 },
    ],
  },
  warmth: {
    bg: '#ffffff',
    orbs: [
      { r: 252, g: 165, b: 165, a: 0.55, cx: 0.25, cy: 0.30, radius: 0.70, freqX: 0.35, freqY: 0.28, phaseX: 0,   phaseY: 1.2, ampX: 0.14, ampY: 0.12 },
      { r: 252, g: 211, b:  77, a: 0.42, cx: 0.70, cy: 0.65, radius: 0.65, freqX: 0.25, freqY: 0.20, phaseX: 1.8, phaseY: 0.4, ampX: 0.12, ampY: 0.14 },
    ],
  },
};

/**
 * Soft ambient gradient for avatar/presence contexts.
 * variant="presence" — violet + sky blue (calm, intelligent)
 * variant="warmth"   — blush + amber (warm, expressive)
 */
export default function SmartGradient({
  style,
  variant = 'presence',
}: {
  style?: React.CSSProperties;
  variant?: Variant;
}) {
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
      if (w === 0 || h === 0) return;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const r = Math.max(w, h);
      const { bg, orbs } = VARIANTS[variant];

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      for (const o of orbs) {
        const x = w * (o.cx + o.ampX * Math.sin(t * o.freqX + o.phaseX));
        const y = h * (o.cy + o.ampY * Math.cos(t * o.freqY + o.phaseY));
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r * o.radius);
        grad.addColorStop(0,    `rgba(${o.r}, ${o.g}, ${o.b}, ${o.a})`);
        grad.addColorStop(0.35, `rgba(${o.r}, ${o.g}, ${o.b}, ${+(o.a * 0.55).toFixed(3)})`);
        grad.addColorStop(0.70, `rgba(${o.r}, ${o.g}, ${o.b}, ${+(o.a * 0.15).toFixed(3)})`);
        grad.addColorStop(1,    `rgba(${o.r}, ${o.g}, ${o.b}, 0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [variant]);

  return (
    <div style={{ position: 'relative', background: '#ffffff', overflow: 'hidden', ...style }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
      <svg
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', mixBlendMode: 'multiply', opacity: 0.08 }}
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
