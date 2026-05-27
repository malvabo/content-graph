import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';

export default function WelcomeScreen({
  onGetStarted,
  onLogIn,
}: {
  onGetStarted: () => void;
  onLogIn?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [appeared, setAppeared] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setAppeared(true), 60);
    return () => window.clearTimeout(t);
  }, []);

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
      g1.addColorStop(0,   'rgba(138, 220, 210, 0.92)');
      g1.addColorStop(0.45,'rgba(98,  178, 163, 0.48)');
      g1.addColorStop(1,   'rgba(72,  138, 120, 0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, w, h);

      // Orb 2: mid-teal, center-right, slower drift
      const x2 = w * (0.74 + 0.09 * Math.sin(t * 0.17 + 1.5));
      const y2 = h * (0.38 + 0.13 * Math.cos(t * 0.14 + 2.0));
      const g2 = ctx.createRadialGradient(x2, y2, 0, x2, y2, r * 0.52);
      g2.addColorStop(0,   'rgba(72, 152, 138, 0.78)');
      g2.addColorStop(0.55,'rgba(52, 112,  98, 0.38)');
      g2.addColorStop(1,   'rgba(42,  85,  72, 0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);

      // Orb 3: lighter mint accent, lower-center drift
      const x3 = w * (0.42 + 0.18 * Math.sin(t * 0.13 + 3.2));
      const y3 = h * (0.74 + 0.08 * Math.cos(t * 0.19 + 0.8));
      const g3 = ctx.createRadialGradient(x3, y3, 0, x3, y3, r * 0.42);
      g3.addColorStop(0,   'rgba(108, 194, 180, 0.62)');
      g3.addColorStop(1,   'rgba(78,  150, 135, 0)');
      ctx.fillStyle = g3;
      ctx.fillRect(0, 0, w, h);

      // Orb 4: subtle dark-green anchor, top-right corner
      const x4 = w * (0.88 + 0.06 * Math.sin(t * 0.11 + 0.4));
      const y4 = h * (0.08 + 0.06 * Math.cos(t * 0.09 + 1.2));
      const g4 = ctx.createRadialGradient(x4, y4, 0, x4, y4, r * 0.38);
      g4.addColorStop(0,   'rgba(42, 90, 52, 0.80)');
      g4.addColorStop(1,   'rgba(32, 68, 40, 0)');
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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: '#2A5032',
        color: '#fff',
        fontFamily: 'var(--font-sans, system-ui)',
        overflow: 'hidden',
      }}
    >
      {/* Animated gradient canvas — movement lives here */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* Grain overlay — static film grain sits on top of the moving gradient */}
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
        <filter id="grain-filter" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.68"
            numOctaves="4"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain-filter)" />
      </svg>

      {/* Floating tag */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={appeared ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7, delay: 0.4 }}
        style={{
          position: 'absolute',
          top: '46%',
          left: '14%',
          padding: '6px 10px',
          borderRadius: 6,
          background: 'rgba(20,18,18,0.86)',
          border: '0.5px solid rgba(255,255,255,0.10)',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: 11,
          letterSpacing: '0.06em',
          color: 'rgba(255,255,255,0.78)',
        }}
      >
        FINANCIAL DATA
      </motion.div>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingBottom: 'max(40px, env(safe-area-inset-bottom, 20px) + 24px)',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={appeared ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.25 }}
          style={{ textAlign: 'center', marginBottom: 56 }}
        >
          <div
            style={{
              fontSize: 60,
              fontWeight: 600,
              color: '#fff',
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
            }}
          >
            Oula
          </div>
          <div
            style={{
              fontSize: 17,
              color: 'rgba(255,255,255,0.72)',
              marginTop: 10,
            }}
          >
            Your AI content graph
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={appeared ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          style={{
            width: 'min(calc(100% - 40px), 360px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <motion.button
            onClick={onGetStarted}
            whileTap={{ scale: 0.97 }}
            style={{
              width: '100%',
              height: 54,
              borderRadius: 16,
              border: 'none',
              background: 'rgba(255,255,255,0.94)',
              color: 'rgb(20,18,18)',
              fontFamily: 'var(--font-sans, system-ui)',
              fontSize: 17,
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '-0.01em',
            }}
          >
            Get started
          </motion.button>

          <motion.button
            onClick={onLogIn}
            whileTap={{ scale: 0.97 }}
            style={{
              width: '100%',
              height: 54,
              borderRadius: 16,
              border: '0.5px solid rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.85)',
              fontFamily: 'var(--font-sans, system-ui)',
              fontSize: 17,
              fontWeight: 500,
              cursor: 'pointer',
              letterSpacing: '-0.01em',
            }}
          >
            Log in
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
