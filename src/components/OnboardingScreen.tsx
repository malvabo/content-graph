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

// A single point in the rotating dot cluster. Position is in cluster-local
// coordinates; rotation happens once per frame around the cluster center.
interface Dot {
  x: number; y: number; z: number;
  size: number; alpha: number;
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
    const isAmber = i % 3 === 0;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    if (isAmber) {
      grad.addColorStop(0, `rgba(217,115,26,${a * 1.2})`);
      grad.addColorStop(1, `rgba(217,115,26,0)`);
    } else {
      grad.addColorStop(0, `rgba(255,255,255,${a * 1.3})`);
      grad.addColorStop(0.5, `rgba(235,235,235,${a * 0.7})`);
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
  onClose?: () => void;
}

export default function OnboardingScreen({ onFinish, onClose }: Props) {
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

    // ---- background cache ----
    // The gradient is viewport-sized but static. Draw it once into an offscreen
    // canvas and blit it each frame instead of recreating 3 gradient objects
    // per tick (which GC'd thousands of times per second on mobile).
    const bgCanvas = document.createElement('canvas');
    const bgCtx = bgCanvas.getContext('2d')!;

    const drawBg = (w: number, h: number) => {
      bgCanvas.width  = w;
      bgCanvas.height = h;
      const gr = bgCtx.createLinearGradient(w * 0.2, 0, w * 0.8, h);
      gr.addColorStop(0,    'rgb(33,25,20)');
      gr.addColorStop(0.35, 'rgb(26,20,18)');
      gr.addColorStop(0.65, 'rgb(20,15,13)');
      gr.addColorStop(1,    'rgb(15,13,10)');
      bgCtx.fillStyle = gr;
      bgCtx.fillRect(0, 0, w, h);

      const radius = Math.max(w, h) * 0.7;
      const glowTL = bgCtx.createRadialGradient(w * 0.05, h * 0.05, 0, w * 0.05, h * 0.05, radius);
      glowTL.addColorStop(0, 'rgba(140, 77, 20, 0.35)');
      glowTL.addColorStop(1, 'rgba(140, 77, 20, 0)');
      bgCtx.fillStyle = glowTL;
      bgCtx.fillRect(0, 0, w, h);

      const glowBR = bgCtx.createRadialGradient(w * 1.0, h * 0.85, 0, w * 1.0, h * 0.85, radius);
      glowBR.addColorStop(0, 'rgba(77, 51, 20, 0.22)');
      glowBR.addColorStop(1, 'rgba(77, 51, 20, 0)');
      bgCtx.fillStyle = glowBR;
      bgCtx.fillRect(0, 0, w, h);
    };

    // ---- resize ----
    const resize = () => {
      canvas.width  = window.innerWidth  * devicePixelRatio;
      canvas.height = window.innerHeight * devicePixelRatio;
      canvas.style.width  = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      drawBg(canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);

    // ---- dot cluster (rotates rigidly around its center; the focal motion) ----
    // Build a deterministic point cloud inside an ellipsoid via seeded
    // rejection sampling, mirroring the iOS setupDotCloud.
    const dotCloud: Dot[] = [];
    {
      const target = 140;
      let placed = 0;
      let attempt = 0;
      while (placed < target && attempt < target * 6) {
        const nx = (rng(0, attempt * 3)     - 0.5) * 2;
        const ny = (rng(0, attempt * 3 + 1) - 0.5) * 2;
        const nz = (rng(0, attempt * 3 + 2) - 0.5) * 2;
        attempt++;
        if (nx * nx + ny * ny + nz * nz > 1) continue;
        dotCloud.push({
          x: nx * 9, y: ny * 6, z: nz * 5,
          size:  0.18 + rng(1, 1000 + placed * 2) * 0.22,
          alpha: 0.40 + rng(1, 2000 + placed * 2) * 0.55,
        });
        placed++;
      }
    }

    // ---- ambient back-layer particles (kept as wandering atmosphere) ----
    const W = 60, H = 80, D = 40;
    const spawnFar = (): Particle => ({
      x: (Math.random() - 0.5) * W * 3,
      y: (Math.random() - 0.5) * H * 3,
      z: (Math.random() - 0.5) * D * 3,
      vx: (Math.random() - 0.5) * 0.018,
      vy: (Math.random() - 0.5) * 0.018 + 0.009,
      vz: (Math.random() - 0.5) * 0.012,
      size:  0.10 + Math.random() * 0.08,
      alpha: 0.30 + Math.random() * 0.20,
    });
    const farParticles: Particle[] = Array.from({ length: 20 }, spawnFar);

    // ---- sprite ----
    const sprite = makeParticleSprite(24);

    // ---- clouds (anchored; breathe in place) ----
    const CLOUD_SIZE = 256;
    const cloudDefs = [
      { nx: 0.18, ny: 0.30, wf: 0.55, hf: 0.28, opacity: 0.80, seed: 1, breathMs: 5200 },
      { nx: 0.72, ny: 0.55, wf: 0.48, hf: 0.22, opacity: 0.65, seed: 2, breathMs: 6400 },
      { nx: 0.40, ny: 0.75, wf: 0.62, hf: 0.30, opacity: 0.60, seed: 3, breathMs: 4700 },
      { nx: 0.82, ny: 0.22, wf: 0.40, hf: 0.25, opacity: 0.50, seed: 4, breathMs: 7100 },
      { nx: 0.10, ny: 0.60, wf: 0.50, hf: 0.33, opacity: 0.45, seed: 5, breathMs: 5800 },
      { nx: 0.55, ny: 0.15, wf: 0.44, hf: 0.20, opacity: 0.55, seed: 6, breathMs: 6000 },
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

      ctx.drawImage(bgCanvas, 0, 0, cw, ch);

      // -- clouds: anchored position, breathing scale + opacity --
      // Cosine waves give natural ease-in-out at the extremes. The phase
      // sign per seed mirrors the iOS inhale/exhale-first split so no
      // blob is ever static at t=0 and they immediately desynchronize.
      cloudDefs.forEach((def, i) => {
        const breathSign  = def.seed % 2 === 0 ? 1 : -1;  // even → exhale first
        const breathPhase = Math.PI / 2 + breathSign * (t / def.breathMs) * Math.PI * 2;
        const scale = 1.0 + 0.08 * Math.cos(breathPhase);

        const pulseMs    = def.breathMs * 0.85;
        const pulseSign  = def.seed % 3 === 0 ? -1 : 1;  // multiples of 3 → glow first
        const pulsePhase = Math.PI / 2 + pulseSign * (t / pulseMs) * Math.PI * 2;
        const opacity    = Math.max(0, def.opacity + 0.10 * Math.cos(pulsePhase));

        const cx = def.nx * cw;
        const cy = def.ny * ch;
        const w  = def.wf * cw * scale;
        const h  = def.hf * ch * scale;

        ctx.globalAlpha = opacity;
        ctx.drawImage(cloudTextures[i], cx - w / 2, cy - h / 2, w, h);
      });

      ctx.globalAlpha = 1;

      // -- ambient back-layer particles (wandering atmosphere) --
      for (const p of farParticles) {
        p.x += p.vx; p.y += p.vy; p.z += p.vz;
        const bW = W * 3, bH = H * 3, bD = D * 3;
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

        ctx.globalAlpha = p.alpha * 0.5;
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(sprite, sx - radius, sy - radius, radius * 2, radius * 2);
        ctx.globalCompositeOperation = 'source-over';
      }

      // -- rotating dot cluster (the focal motion) --
      // Y spin: full revolution every 22s; X tilt every 38s — matches iOS.
      const spinY = (t / 22000) * Math.PI * 2;
      const tiltX = (t / 38000) * Math.PI * 2;
      const cosY = Math.cos(spinY), sinY = Math.sin(spinY);
      const cosX = Math.cos(tiltX), sinX = Math.sin(tiltX);

      ctx.globalCompositeOperation = 'lighter';
      for (const d of dotCloud) {
        // Rotate around X (tilt) first, then around Y (spin).
        const y1 = d.y * cosX - d.z * sinX;
        const z1 = d.y * sinX + d.z * cosX;
        const x2 =  d.x * cosY + z1 * sinY;
        const z2 = -d.x * sinY + z1 * cosY;
        const proj = project({ x: x2, y: y1, z: z2 });
        if (!proj) continue;
        // Smaller multiplier than the wandering ambient particles below: the
        // rotating cluster has to read as a *cloud of distinct dots* so the
        // rotation is visible. With *40 the dots overlap into one giant
        // additive-white blob and the spin becomes invisible.
        const radius = d.size * proj.scale * 4;
        if (radius < 0.3) continue;
        ctx.globalAlpha = d.alpha;
        ctx.drawImage(sprite, proj.sx - radius, proj.sy - radius, radius * 2, radius * 2);
      }
      ctx.globalCompositeOperation = 'source-over';

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

      {/* Close button (only when opened as overlay) */}
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 'max(16px, env(safe-area-inset-top, 0px) + 12px)', right: 16,
            width: 32, height: 32, borderRadius: '50%',
            border: 'none', background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'rgba(255,255,255,0.80)', zIndex: 1,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      )}

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
                  ? 'rgba(26,20,18,0.55)'
                  : 'rgba(15,13,10,0.82)',
                borderRadius: 2,
                padding: '5px 11px',
                border: l.ghost
                  ? '0.5px solid rgba(255,255,255,0.18)'
                  : '0.5px solid rgba(255,255,255,0.10)',
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
            background: 'rgba(255,255,255,0.94)',
            color: 'rgb(26,20,18)',
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
