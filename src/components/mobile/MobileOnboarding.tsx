import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

interface Props {
  onComplete: () => void;
}

type Phase = 'idle' | 'prompt' | 'recording' | 'platform' | 'draft' | 'posting';

// ─── Platform draft copy ──────────────────────────────────────────────────────

const PLATFORM_DRAFTS: Record<string, string> = {
  linkedin: `Just had a realization worth sharing.

Most content advice tells you to post more. Stay consistent. Stay top of mind.

But the posts that actually land? They have one thing in common: clarity.

Here's what I've learned:

→ One idea per post
→ Lead with the insight, not the backstory
→ End with a real question, not a period

What's your approach — volume or depth?`,
  x: `Hot take: most content advice is wrong.

You don't need to post daily. You need to post clearly. One real insight beats 30 filler posts every time. The feed rewards depth — people just don't tell you that.`,
  instagram: `Something shifted for me recently ✨

I stopped trying to say everything and started saying one thing really well.

The posts that connected weren't the polished ones. They were the honest ones.

If you've been feeling like nothing you make is good enough — you're not alone. Start with what's true. The rest follows.

Drop a 🤍 if this resonates`,
  threads: `okay so real talk

been thinking about why some posts land and others disappear into the feed

i think it's just honesty? the ones that feel real because they actually are

anyway that's the whole thought`,
};

// ─── Aurora blobs — vivid colors, lissajous-like paths, 90px blur ─────────────

const BLOBS = [
  {
    color: 'radial-gradient(ellipse, rgba(255,150,18,0.88) 0%, rgba(255,90,5,0.42) 44%, transparent 70%)',
    w: 540, h: 460,
    // Warm amber lower-center — lissajous: x 31s, y 43s
    xPath: ['-6%', '14%', '-10%', '20%', '-6%'],
    yPath: ['36%', '52%', '64%', '44%', '36%'],
    xDur: 31, yDur: 43,
  },
  {
    color: 'radial-gradient(ellipse, rgba(98,12,255,0.82) 0%, rgba(68,0,218,0.38) 44%, transparent 70%)',
    w: 500, h: 460,
    // Deep violet upper-left — lissajous: x 38s, y 27s
    xPath: ['-34%', '-16%', '-40%', '-22%', '-34%'],
    yPath: ['-24%', '-8%', '-32%', '-4%', '-24%'],
    xDur: 38, yDur: 27,
  },
  {
    color: 'radial-gradient(ellipse, rgba(255,48,148,0.78) 0%, rgba(218,18,110,0.34) 44%, transparent 70%)',
    w: 440, h: 400,
    // Pink bloom mid-right — lissajous: x 29s, y 47s
    xPath: ['24%', '46%', '30%', '52%', '24%'],
    yPath: ['46%', '62%', '38%', '72%', '46%'],
    xDur: 29, yDur: 47,
  },
  {
    color: 'radial-gradient(ellipse, rgba(16,212,72,0.68) 0%, rgba(6,168,42,0.28) 44%, transparent 70%)',
    w: 420, h: 380,
    // Green pocket lower-left — lissajous: x 35s, y 25s
    xPath: ['-26%', '-6%', '-20%', '-38%', '-26%'],
    yPath: ['56%', '72%', '48%', '80%', '56%'],
    xDur: 35, yDur: 25,
  },
];

// ─── Platform discs ───────────────────────────────────────────────────────────

const PLATFORMS = [
  { id: 'linkedin',  label: 'LinkedIn',  color: 'rgba(10,102,194,0.80)',  glow: 'rgba(10,102,194,0.40)'  },
  { id: 'x',         label: 'X',         color: 'rgba(210,210,220,0.80)', glow: 'rgba(200,200,210,0.38)'  },
  { id: 'instagram', label: 'Instagram', color: 'rgba(193,53,132,0.80)',  glow: 'rgba(193,53,132,0.40)'  },
  { id: 'threads',   label: 'Threads',   color: 'rgba(100,80,200,0.80)',  glow: 'rgba(100,80,200,0.38)'  },
];

const ARC = [
  { left: '10%', top: '56%' },
  { left: '32%', top: '45%' },
  { left: '56%', top: '45%' },
  { left: '76%', top: '56%' },
];

// ─── Orb targets per phase ────────────────────────────────────────────────────
// idle: 200px circle at 60% vertical
// prompt: 300×76 pill at 76%
// recording: hidden
// platform: 160×44 pill at 11%
// draft: 18px dot beside headline
// posting: large fading bloom

const ORB: Record<Phase, object> = {
  idle:      { width: 200, height: 200, borderRadius: 100, top: '60%', left: '50%', x: '-50%', y: '-50%', opacity: 1 },
  prompt:    { width: 300, height: 76,  borderRadius: 38,  top: '76%', left: '50%', x: '-50%', y: '-50%', opacity: 1 },
  recording: { width: 160, height: 160, borderRadius: 80,  top: '52%', left: '50%', x: '-50%', y: '-50%', opacity: 0 },
  platform:  { width: 160, height: 44,  borderRadius: 22,  top: '11%', left: '50%', x: '-50%', y: '-50%', opacity: 1 },
  draft:     { width: 18,  height: 18,  borderRadius: 9,   top: '8.2%', left: '50%', x: -108,  y: '-50%', opacity: 1 },
  posting:   { width: 240, height: 240, borderRadius: 120, top: '50%', left: '50%', x: '-50%', y: '-50%', opacity: 0 },
};

const SPRING = { type: 'spring' as const, stiffness: 80, damping: 18, mass: 1 };
// Custom ease: deliberate, not mechanical
const EASE: [number, number, number, number] = [0.4, 0.0, 0.6, 1.0];

// ─── Recording canvas ─────────────────────────────────────────────────────────

function RecordingCanvas({ onStop }: { onStop: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioLevelRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let t = 0, spread = 88, raf: number;
    let analyser: AnalyserNode | null = null;
    let audioCtx: AudioContext | null = null;
    let stream: MediaStream | null = null;
    const dataArr = new Uint8Array(128);

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(s => {
        stream = s;
        audioCtx = new AudioContext();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.7;
        audioCtx.createMediaStreamSource(stream).connect(analyser);
      })
      .catch(() => {});

    const draw = () => {
      const w = window.innerWidth, h = window.innerHeight;
      const cx = w / 2, cy = h * 0.52;
      if (analyser) {
        analyser.getByteFrequencyData(dataArr);
        let sum = 0;
        for (let k = 0; k < dataArr.length; k++) sum += dataArr[k];
        audioLevelRef.current = Math.min(1, (sum / dataArr.length) / 80);
      }
      const level = audioLevelRef.current;
      spread += ((level > 0.12 ? 10 : 88) - spread) * 0.04;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < 4; i++) {
        const angle = t * 0.65 + i * (Math.PI * 0.5);
        const r = spread + Math.sin(t * 0.45 + i * 1.1) * 20;
        const px = cx + Math.cos(angle) * r * 0.88;
        const py = cy + Math.sin(angle) * r * 0.72;
        const sz = (155 + Math.sin(t * 0.9 + i * 0.8) * 38) * (1 + level * 0.5);
        const alpha = 0.22 + level * 0.32;
        const grad = ctx.createRadialGradient(px, py, 0, px, py, sz);
        const hue = 145 + i * 5;
        grad.addColorStop(0, `hsla(${hue},58%,52%,${alpha.toFixed(2)})`);
        grad.addColorStop(0.5, `hsla(${hue},50%,48%,${(alpha * 0.28).toFixed(2)})`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }
      if (level > 0.05) {
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 120 + level * 80);
        glow.addColorStop(0, `hsla(150,60%,55%,${(level * 0.28).toFixed(2)})`);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
      }
      t += 0.010;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      stream?.getTracks().forEach(tr => tr.stop());
      audioCtx?.close().catch(() => {});
    };
  }, []);

  return (
    <canvas ref={canvasRef} onClick={onStop}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 20, touchAction: 'none' }}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MobileOnboarding({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [hintVisible, setHintVisible] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [orbAbsorb, setOrbAbsorb] = useState(false);
  const [draftText, setDraftText] = useState('');

  function advance() {
    if (phase === 'idle') { setPhase('prompt'); setTimeout(() => setHintVisible(true), 1200); }
  }
  function startRecording() { setHintVisible(false); setPhase('recording'); }
  function goToPlatform() { setPhase('platform'); }

  function pickPlatform(id: string) {
    if (selectedPlatform) return;
    setSelectedPlatform(id);
    setTimeout(() => setOrbAbsorb(true), 180);
    setTimeout(() => {
      setDraftText(PLATFORM_DRAFTS[id] ?? '');
      setPhase('draft');
      setOrbAbsorb(false);
    }, 900);
  }

  function triggerPost() {
    if (phase !== 'draft') return;
    setPhase('posting');
    setTimeout(onComplete, 1800);
  }

  const isIdle = phase === 'idle';

  return (
    <LayoutGroup>
      <div
        onClick={isIdle ? advance : undefined}
        className="onb-root"
        style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none' }}
      >
        <style>{`
          /* @property for smooth base-gradient angle drift */
          @property --bg-a {
            syntax: '<angle>';
            initial-value: 155deg;
            inherits: false;
          }
          @keyframes bg-drift { to { --bg-a: 205deg; } }
          .onb-root {
            background: linear-gradient(var(--bg-a), #0b0608 0%, #0f0810 55%, #09090f 100%);
            animation: bg-drift 22s linear infinite alternate;
          }
          /* White caret + selection in draft textarea */
          .onb-draft-ta {
            caret-color: rgba(255,255,255,0.92);
            color: rgba(255,255,255,0.88);
            background: transparent;
            border: none;
            outline: none;
            resize: none;
            padding: 0;
            margin: 0;
          }
          .onb-draft-ta::selection { background: rgba(255,255,255,0.16); }
        `}</style>

        {/* ── Aurora blobs — lissajous motion, 90px blur, vivid ── */}
        {BLOBS.map((b, i) => (
          <motion.div key={i} aria-hidden
            animate={{ x: b.xPath, y: b.yPath }}
            transition={{
              x: { duration: b.xDur, repeat: Infinity, ease: 'easeInOut', repeatType: 'loop' },
              y: { duration: b.yDur, repeat: Infinity, ease: 'easeInOut', repeatType: 'loop' },
            }}
            style={{
              position: 'absolute', top: 0, left: 0,
              width: b.w, height: b.h,
              background: b.color,
              filter: 'blur(90px)',
              willChange: 'transform',
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Grain */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, opacity: 0.045, zIndex: 1, pointerEvents: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat', backgroundSize: '200px 200px',
        }} />

        {/* ── Orb — built from 3 stacked radial gradients, mix-blend-mode:screen ──
              No border. No box-shadow. No fill. This is light, not an object.     */}
        <motion.div
          layoutId="main-orb"
          onClick={(e) => {
            if (phase === 'prompt') { e.stopPropagation(); startRecording(); }
            if (phase === 'draft')  { e.stopPropagation(); triggerPost(); }
          }}
          animate={{
            ...ORB[phase],
            ...(orbAbsorb ? { scale: [1, 1.16, 1] } : {}),
          }}
          transition={SPRING}
          style={{
            position: 'absolute',
            mixBlendMode: 'screen',
            zIndex: 12,
            cursor: (phase === 'prompt' || phase === 'draft') ? 'pointer' : 'default',
            pointerEvents: phase === 'recording' ? 'none' : 'auto',
          }}
        >
          {/* Outer scale breath — 4.5 s, starts at maximum */}
          <motion.div
            animate={isIdle ? { scale: [1.04, 0.96, 1.04] } : { scale: 1 }}
            transition={isIdle ? { duration: 4.5, repeat: Infinity, ease: EASE, repeatType: 'loop' } : { duration: 0.6 }}
            style={{ position: 'absolute', inset: 0 }}
          >
            {/* Core brightness — 3.2 s, starts going down (offset phase) */}
            <motion.div
              aria-hidden
              animate={isIdle ? { opacity: [1.0, 0.85, 1.0] } : { opacity: 1 }}
              transition={isIdle ? { duration: 3.2, repeat: Infinity, ease: EASE, repeatType: 'loop' } : { duration: 0.5 }}
              style={{
                position: 'absolute', inset: 0,
                background: 'radial-gradient(ellipse at center, rgba(255,255,255,1) 0%, rgba(255,255,255,0.90) 15%, transparent 40%)',
              }}
            />

            {/* Mid warm glow */}
            <div aria-hidden style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse at center, transparent 8%, rgba(255,240,230,0) 12%, rgba(255,240,230,0.62) 24%, transparent 70%)',
            }} />

            {/* Outer bleed — 6 s, starts in mid-cycle (most out of phase).
                inset:-45% so it bleeds ~40–55% past the container edge on all sides. */}
            <motion.div
              aria-hidden
              animate={isIdle ? { scale: [1.05, 0.90, 1.15, 0.90, 1.05] } : { scale: 1 }}
              transition={isIdle ? { duration: 6, repeat: Infinity, ease: EASE, repeatType: 'loop' } : { duration: 0.6 }}
              style={{
                position: 'absolute', inset: '-45%',
                background: 'radial-gradient(ellipse at center, transparent 0%, transparent 28%, rgba(255,220,200,0.28) 52%, rgba(255,210,185,0.14) 72%, transparent 94%)',
                pointerEvents: 'none',
              }}
            />
          </motion.div>
        </motion.div>

        {/* ── Recording canvas ── */}
        <AnimatePresence>
          {phase === 'recording' && (
            <motion.div key="rec-canvas"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.55 }}
              style={{ position: 'absolute', inset: 0, zIndex: 20 }}
            >
              <RecordingCanvas onStop={goToPlatform} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Platform discs ── */}
        <AnimatePresence>
          {phase === 'platform' && PLATFORMS.map((p, i) => {
            const pos = ARC[i];
            const isSel = selectedPlatform === p.id;
            const isDim = selectedPlatform !== null && !isSel;
            return (
              <motion.div key={p.id} onClick={() => pickPlatform(p.id)}
                initial={{ opacity: 0, scale: 0.5, y: 30 }}
                animate={isSel ? { opacity: [1, 1, 0], scale: [1, 1.35, 0], y: [0, -8, -340] }
                  : isDim ? { opacity: 0, scale: 0.72 }
                  : { opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={isSel ? { duration: 0.72, ease: 'easeIn', times: [0, 0.3, 1] }
                  : isDim ? { duration: 0.45 }
                  : { ...SPRING, delay: i * 0.08 + 0.15 }}
                style={{ position: 'absolute', left: pos.left, top: pos.top, transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, cursor: selectedPlatform ? 'default' : 'pointer', zIndex: 15 }}
              >
                <div style={{ position: 'relative', width: 88, height: 88 }}>
                  <div style={{ position: 'absolute', inset: -14, borderRadius: '50%', background: `radial-gradient(circle, ${p.glow} 0%, transparent 70%)`, filter: 'blur(12px)', pointerEvents: 'none' }} />
                  <div style={{ width: 88, height: 88, borderRadius: '50%', background: `radial-gradient(circle at 38% 36%, ${p.color} 0%, ${p.color.replace(/[\d.]+\)$/, '0.45)')} 55%, ${p.color.replace(/[\d.]+\)$/, '0.18)')} 100%)`, filter: 'blur(3px)' }} />
                </div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.78)', letterSpacing: '0.01em', pointerEvents: 'none' }}>{p.label}</div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* ── Draft card ── */}
        <AnimatePresence>
          {(phase === 'draft' || phase === 'posting') && (
            <motion.div key="draft-card"
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: phase === 'posting' ? 0 : 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={SPRING}
              style={{ position: 'absolute', top: '14%', bottom: '13%', left: 20, right: 20, display: 'flex', flexDirection: 'column', zIndex: 10 }}
            >
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', borderRadius: 20, padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <textarea
                  className="onb-draft-ta"
                  value={draftText}
                  onChange={e => setDraftText(e.target.value)}
                  style={{ flex: 1, fontFamily: 'var(--font-sans)', fontSize: 15.5, lineHeight: 1.72 }}
                />
              </div>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.8 }}
                style={{ textAlign: 'center', marginTop: 16, fontFamily: 'var(--font-sans)', fontSize: 13, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.03em', pointerEvents: 'none' }}
              >Tap the orb to post</motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Posting bloom ── */}
        <AnimatePresence>
          {phase === 'posting' && (
            <>
              <motion.div key="bloom"
                initial={{ scale: 0.1, opacity: 0.85 }}
                animate={{ scale: 9, opacity: 0 }}
                transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
                style={{ position: 'absolute', width: 190, height: 190, borderRadius: '50%', top: '50%', left: '50%', x: '-50%', y: '-50%', background: 'radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(220,200,255,0.18) 50%, transparent 70%)', filter: 'blur(8px)', pointerEvents: 'none', zIndex: 50 }}
              />
              <motion.div key="posted-label"
                initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ ...SPRING, delay: 0.35 }}
                style={{ position: 'absolute', top: '50%', left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 32, fontWeight: 700, color: 'rgba(255,255,255,0.94)', letterSpacing: '-0.03em', y: '-50%', pointerEvents: 'none', zIndex: 55 }}
              >Posted ✦</motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── Headlines — popLayout with overlapping cross-dissolve ── */}
        <AnimatePresence mode="popLayout">
          {phase === 'idle' && (
            <motion.div key="h-idle" layoutId="headline"
              initial={{ opacity: 0, y: 20, scale: 1.05 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              transition={{ duration: 0.35, delay: 0.12, ease: [0.4, 0, 0.2, 1] }}
              style={{ position: 'absolute', top: '25%', left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 44, fontWeight: 700, color: 'rgba(255,255,255,0.95)', letterSpacing: '-0.02em', pointerEvents: 'none', zIndex: 5 }}
            >Let's write a post</motion.div>
          )}
          {phase === 'prompt' && (
            <motion.div key="h-prompt"
              initial={{ opacity: 0, y: 20, scale: 1.05 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              transition={{ duration: 0.35, delay: 0.15, ease: [0.4, 0, 0.2, 1] }}
              style={{ position: 'absolute', top: '30%', left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 36, fontWeight: 700, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.02em', pointerEvents: 'none', zIndex: 5 }}
            >What's on your mind?</motion.div>
          )}
          {phase === 'recording' && (
            <motion.div key="h-rec"
              initial={{ opacity: 0, y: 20, scale: 1.05 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              transition={{ duration: 0.35, delay: 0.15, ease: [0.4, 0, 0.2, 1] }}
              style={{ position: 'absolute', top: '18%', left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 26, fontWeight: 600, color: 'rgba(255,255,255,0.78)', letterSpacing: '-0.02em', pointerEvents: 'none', zIndex: 5 }}
            >Go ahead, I'm listening</motion.div>
          )}
          {phase === 'platform' && (
            <motion.div key="h-platform"
              initial={{ opacity: 0, y: 20, scale: 1.05 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              transition={{ duration: 0.35, delay: 0.15, ease: [0.4, 0, 0.2, 1] }}
              style={{ position: 'absolute', top: '22%', left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 30, fontWeight: 700, color: 'rgba(255,255,255,0.90)', letterSpacing: '-0.02em', pointerEvents: 'none', zIndex: 5 }}
            >Where should this go?</motion.div>
          )}
          {(phase === 'draft' || phase === 'posting') && (
            <motion.div key="h-draft" layoutId="headline"
              initial={{ opacity: 0, y: 20, scale: 1.05 }}
              animate={{ opacity: phase === 'posting' ? 0 : 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              transition={{ duration: 0.35, delay: 0.12, ease: [0.4, 0, 0.2, 1] }}
              style={{ position: 'absolute', top: '6%', left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.84)', letterSpacing: '-0.02em', pointerEvents: 'none', zIndex: 5 }}
            >Here's your draft</motion.div>
          )}
        </AnimatePresence>

        {/* ── Hints ── */}
        <AnimatePresence>
          {phase === 'prompt' && hintVisible && (
            <motion.div key="hint-rec"
              initial={{ opacity: 0 }} animate={{ opacity: 0.40 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }}
              style={{ position: 'absolute', bottom: '10%', left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'rgba(255,255,255,1)', letterSpacing: '0.05em', pointerEvents: 'none', zIndex: 5 }}
            >tap to record</motion.div>
          )}
          {phase === 'recording' && (
            <motion.div key="hint-stop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: 1.2, duration: 0.8 }}
              style={{ position: 'absolute', bottom: '10%', left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'rgba(255,255,255,0.32)', letterSpacing: '0.05em', pointerEvents: 'none', zIndex: 5 }}
            >tap anywhere to continue</motion.div>
          )}
        </AnimatePresence>

        {/* ── Skip — ghosted word, bottom-right corner, 30% opacity ── */}
        <AnimatePresence>
          {isIdle && (
            <motion.button key="skip"
              initial={{ opacity: 0 }} animate={{ opacity: 0.30 }} exit={{ opacity: 0 }}
              transition={{ delay: 1.0, duration: 0.6 }}
              onClick={(e) => { e.stopPropagation(); onComplete(); }}
              style={{ position: 'absolute', bottom: 28, right: 24, background: 'none', border: 'none', fontFamily: 'var(--font-sans)', fontSize: 14, color: 'rgba(255,255,255,1)', letterSpacing: '0.02em', cursor: 'pointer', padding: '8px 0', zIndex: 30 }}
            >skip</motion.button>
          )}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}
