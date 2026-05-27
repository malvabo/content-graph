import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';

interface Star {
  x: number;
  y: number;
  z: number;
  size: number;
  baseAlpha: number;
  twinklePhase: number;
}

function makeStars(count: number, w: number, h: number): Star[] {
  const out: Star[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    out.push({
      x: Math.random() * w,
      y: Math.random() * h,
      z: r * r,
      size: 0.5 + Math.random() * 1.6,
      baseAlpha: 0.25 + Math.random() * 0.7,
      twinklePhase: Math.random() * Math.PI * 2,
    });
  }
  return out;
}

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

    let stars: Star[] = [];
    let raf = 0;
    const start = performance.now();

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = makeStars(180, w, h);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = 'rgba(217,115,26,0.10)';
      ctx.beginPath();
      ctx.ellipse(w * 0.1, h * 0.05, 320, 220, 0, 0, Math.PI * 2);
      ctx.fill();

      for (const s of stars) {
        const tw = 0.55 + 0.45 * Math.sin(t * 1.4 + s.twinklePhase);
        const alpha = Math.max(0, Math.min(1, s.baseAlpha * tw));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
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
        background: '#050505',
        color: '#fff',
        fontFamily: 'var(--font-sans, system-ui)',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* Floating tag — mirrors the demo screenshot */}
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
