import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vy: number;
  wobbleAmp: number;
  wobbleFreq: number;
  wobblePhase: number;
  r: number;
  alpha: number;
}

function spawn(w: number, h: number, randomY = true): Particle {
  return {
    x: Math.random() * w,
    y: randomY ? Math.random() * h : h + 4,
    vy: 0.18 + Math.random() * 0.22,
    wobbleAmp: 0.3 + Math.random() * 0.5,
    wobbleFreq: 0.4 + Math.random() * 0.6,
    wobblePhase: Math.random() * Math.PI * 2,
    r: 0.8 + Math.random() * 0.9,
    alpha: 0.15 + Math.random() * 0.10,
  };
}

/**
 * 45 tiny dots drifting slowly upward with Brownian horizontal wobble.
 * Each fades near the top/bottom edges; per-particle opacity 0.15–0.25.
 */
export default function ParticleField({ style }: { style?: React.CSSProperties }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: Particle[] = [];
    let raf = 0;
    const start = performance.now();

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = Array.from({ length: 45 }, () => spawn(w, h, true));
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const fadeZone = h * 0.18;

      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        // Drift upward
        p.y -= p.vy;

        // Horizontal Brownian wobble
        p.x += Math.sin(t * p.wobbleFreq + p.wobblePhase) * p.wobbleAmp;

        // Wrap horizontally
        if (p.x < -4) p.x = w + 4;
        if (p.x > w + 4) p.x = -4;

        // Respawn at bottom when it exits top
        if (p.y < -4) {
          const next = spawn(w, h, false);
          Object.assign(p, next);
        }

        // Edge fade: soft falloff near top and bottom
        const distTop = p.y;
        const distBot = h - p.y;
        const fadeTop = Math.min(1, distTop / fadeZone);
        const fadeBot = Math.min(1, distBot / fadeZone);
        const edgeFade = fadeTop * fadeBot;

        ctx.globalAlpha = p.alpha * edgeFade;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
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
    <div style={{ position: 'relative', background: '#07070f', overflow: 'hidden', ...style }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
    </div>
  );
}
