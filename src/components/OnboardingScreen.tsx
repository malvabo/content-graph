import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  size: number; alpha: number;
}

interface Cloud {
  x: number; y: number;
  w: number; h: number;
  opacity: number;
  seed: number;
  driftR: number;
  driftDuration: number;
  rotSpeed: number;
  phase: number;
}

interface Label {
  text: string;
  // normalised screen position (0-1)
  nx: number; ny: number;
  ghost: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rng(seed: number, n: number) {
  const v = Math.sin(seed * 91.3 + n * 293.1) * 43758.5;
  return v - Math.floor(v);
}

function makeCloudCanvas(seed: number, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  for (let i = 0; i < 14; i++) {
    const cx = rng(seed, i * 3) * w;
    const cy = rng(seed, i * 3 + 1) * h;
    const r  = rng(seed, i * 3 + 2) * Math.min(w, h) * 0.25 + Math.min(w, h) * 0.10;
    const a  = rng(seed, i * 3 + 2) * 0.11 + 0.03;
    const isTeal = i % 3 === 0;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    if (isTeal) {
      grad.addColorStop(0, `rgba(181,240,230,${a * 1.4})`);
      grad.addColorStop(1, `rgba(181,240,230,0)`);
    } else {
      grad.addColorStop(0, `rgba(255,255,255,${a * 2})`);
      grad.addColorStop(0.5, `rgba(230,230,230,${a})`);
      grad.addColorStop(1, `rgba(255,255,255,0)`);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
  return c;
}

function makeParticleSprite(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return c;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  onFinish: () => void;
}

export default function OnboardingScreen({ onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const [appeared, setAppeared] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAppeared(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // ---- resize ----
    const resize = () => {
      canvas.width  = window.innerWidth  * devicePixelRatio;
      canvas.height = window.innerHeight * devicePixelRatio;
      canvas.style.width  = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };
    resize();
    window.addEventListener('resize', resize);

    // ---- particles ----
    const W = 60, H = 80, D = 40; // world box half-extents
    const spawnParticle = (layer: 'near' | 'far'): Particle => {
      const f = layer === 'far' ? 1.5 : 1;
      return {
        x: (Math.random() - 0.5) * W * 2 * f,
        y: (Math.random() - 0.5) * H * 2 * f,
        z: (Math.random() - 0.5) * D * 2 * f,
        vx: (Math.random() - 0.5) * 0.012 * f,
        vy: (Math.random() - 0.5) * 0.012 * f + 0.006,
        vz: (Math.random() - 0.5) * 0.008 * f,
        size: layer === 'near'
          ? 0.18 + Math.random() * 0.12
          : 0.10 + Math.random() * 0.08,
        alpha: layer === 'near' ? 0.7 + Math.random() * 0.3 : 0.3 + Math.random() * 0.2,
      };
    };

    const nearParticles: Particle[] = Array.from({ length: 80 },  () => spawnParticle('near'));
    const farParticles:  Particle[] = Array.from({ length: 20 },  () => spawnParticle('far'));

    // ---- sprite ----
    const sprite = makeParticleSprite(24);

    // ---- clouds ----
    const CLOUD_SIZE = 256;
    const cloudDefs = [
      { nx: 0.18, ny: 0.30, wf: 0.55, hf: 0.28, opacity: 0.80, seed: 1, driftR: 0.04, dur: 22000, phase: 0    },
      { nx: 0.72, ny: 0.55, wf: 0.48, hf: 0.22, opacity: 0.65, seed: 2, driftR: 0.03, dur: 28000, phase: 3500 },
      { nx: 0.40, ny: 0.75, wf: 0.62, hf: 0.30, opacity: 0.60, seed: 3, driftR: 0.05, dur: 19000, phase: 1200 },
      { nx: 0.82, ny: 0.22, wf: 0.40, hf: 0.25, opacity: 0.50, seed: 4, driftR: 0.03, dur: 32000, phase: 7000 },
      { nx: 0.10, ny: 0.60, wf: 0.50, hf: 0.33, opacity: 0.45, seed: 5, driftR: 0.04, dur: 25000, phase: 4000 },
      { nx: 0.55, ny: 0.15, wf: 0.44, hf: 0.20, opacity: 0.55, seed: 6, driftR: 0.04, dur: 21000, phase: 9000 },
    ];
    const cloudTextures = cloudDefs.map(d => makeCloudCanvas(d.seed, CLOUD_SIZE, CLOUD_SIZE));

    // ---- FOV / projection ----
    const FOV = 52;  // degrees, matching iOS

    const project = (p: { x: number; y: number; z: number }) => {
      const cw = canvas.width / devicePixelRatio;
      const ch = canvas.height / devicePixelRatio;
      const fov = (FOV * Math.PI) / 180;
      const camZ = 38;
      const dz = camZ - p.z;
      if (dz <= 0) return null;
      const scale = (ch / 2) / Math.tan(fov / 2) / dz;
      return {
        sx: cw / 2 + p.x * scale,
        sy: ch / 2 - p.y * scale,
        scale,
      };
    };

    // ---- draw gradient ----
    const drawGradient = () => {
      const w = canvas.width;
      const h = canvas.height;
      const gr = ctx.createLinearGradient(w * 0.2, 0, w * 0.8, h);
      gr.addColorStop(0,    'rgb(125,212,235)');
      gr.addColorStop(0.35, 'rgb(168,227,207)');
      gr.addColorStop(0.65, 'rgb( 92,196,199)');
      gr.addColorStop(1,    'rgb( 43,143,127)');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, w, h);
    };

    // ---- loop ----
    let start: number | null = null;

    const tick = (ts: number) => {
      if (!start) start = ts;
      const t = ts - start;
      const dpr = devicePixelRatio;
      const cw = canvas.width / dpr;
      const ch = canvas.height / dpr;

      ctx.save();
      ctx.scale(dpr, dpr);

      drawGradient();

      // -- clouds --
      cloudDefs.forEach((def, i) => {
        const elapsed = (t + def.phase) % def.dur;
        const progress = elapsed / def.dur;
        const angle = progress * Math.PI * 2;
        const dx = Math.cos(angle) * def.driftR * cw;
        const dy = Math.sin(angle) * def.driftR * ch * 0.4;
        const cx = def.nx * cw + dx;
        const cy = def.ny * ch + dy;
        const w  = def.wf * cw;
        const h  = def.hf * ch;
        ctx.globalAlpha = def.opacity;
        ctx.drawImage(cloudTextures[i], cx - w / 2, cy - h / 2, w, h);
      });

      ctx.globalAlpha = 1;

      // -- particles --
      const drawParticles = (particles: Particle[], layer: 'near' | 'far') => {
        for (const p of particles) {
          p.x += p.vx; p.y += p.vy; p.z += p.vz;
          // wrap
          const bW = layer === 'far' ? W * 3 : W * 2;
          const bH = layer === 'far' ? H * 3 : H * 2;
          const bD = layer === 'far' ? D * 3 : D * 2;
          if (p.x > bW)  p.x = -bW;
          if (p.x < -bW) p.x = bW;
          if (p.y > bH)  p.y = -bH;
          if (p.y < -bH) p.y = bH;
          if (p.z > bD)  p.z = -bD;
          if (p.z < -bD) p.z = bD;

          const proj = project(p);
          if (!proj) continue;
          const { sx, sy, scale } = proj;
          const radius = p.size * scale * 40;
          if (radius < 0.3) continue;

          ctx.globalAlpha = p.alpha * (layer === 'far' ? 0.5 : 1);
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(sprite, sx - radius, sy - radius, radius * 2, radius * 2);
          ctx.globalCompositeOperation = 'source-over';
        }
      };

      drawParticles(farParticles,  'far');
      drawParticles(nearParticles, 'near');

      ctx.globalAlpha = 1;
      ctx.restore();

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // ---- labels ----
  const labels: Label[] = [
    { text: 'PEOPLE',         nx: 0.72, ny: 0.38, ghost: false },
    { text: 'FINANCIAL DATA', nx: 0.28, ny: 0.52, ghost: true  },
    { text: 'COMPANIES',      nx: 0.70, ny: 0.62, ghost: false },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, overflow: 'hidden' }}>
      {/* 3D scene */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Floating labels */}
      {labels.map(l => (
        <AnimatePresence key={l.text}>
          {appeared && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              style={{
                position: 'absolute',
                left: `${l.nx * 100}%`,
                top:  `${l.ny * 100}%`,
                transform: 'translate(-50%, -50%)',
                fontFamily: 'monospace',
                fontSize: 10,
                fontWeight: 500,
                color: '#fff',
                background: l.ghost
                  ? 'rgba(20,51,41,0.45)'
                  : 'rgba(5,15,13,0.78)',
                borderRadius: 2,
                padding: '5px 11px',
                border: l.ghost ? '0.5px solid rgba(255,255,255,0.25)' : 'none',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}
            >
              {l.text}
            </motion.div>
          )}
        </AnimatePresence>
      ))}

      {/* Bottom UI */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingBottom: 'max(52px, env(safe-area-inset-bottom, 20px) + 32px)',
      }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={appeared ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
          style={{ textAlign: 'center', marginBottom: 48 }}
        >
          <div style={{
            fontFamily: 'var(--font-sans, system-ui)',
            fontSize: 52,
            fontWeight: 600,
            color: '#fff',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}>
            up
          </div>
          <div style={{
            fontFamily: 'var(--font-sans, system-ui)',
            fontSize: 17,
            color: 'rgba(255,255,255,0.72)',
            marginTop: 12,
          }}>
            Your AI content graph
          </div>
        </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={appeared ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.55 }}
          onClick={onFinish}
          style={{
            width: 'min(calc(100% - 56px), 360px)',
            height: 54,
            borderRadius: 16,
            border: 'none',
            background: 'rgba(255,255,255,0.92)',
            color: 'rgb(26,77,66)',
            fontFamily: 'var(--font-sans, system-ui)',
            fontSize: 17,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '-0.01em',
          }}
          whileTap={{ scale: 0.97 }}
        >
          Get started
        </motion.button>
      </div>
    </div>
  );
}
