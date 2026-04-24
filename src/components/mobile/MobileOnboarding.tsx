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

// ─── Aurora blobs ─────────────────────────────────────────────────────────────

const auroraBlobs = [
  {
    color: 'radial-gradient(ellipse, rgba(255,140,60,0.55) 0%, rgba(255,100,30,0.18) 45%, transparent 70%)',
    width: 420, height: 380,
    initial: { x: '-10%', y: '42%' },
    animate: { x: ['-10%', '8%', '-6%', '-10%'], y: ['42%', '50%', '38%', '42%'] },
    idleDuration: 26, recDuration: 9,
  },
  {
    color: 'radial-gradient(ellipse, rgba(140,60,255,0.50) 0%, rgba(100,30,200,0.16) 45%, transparent 70%)',
    width: 380, height: 360,
    initial: { x: '-30%', y: '-20%' },
    animate: { x: ['-30%', '-18%', '-34%', '-30%'], y: ['-20%', '-10%', '-26%', '-20%'] },
    idleDuration: 30, recDuration: 10,
  },
  {
    color: 'radial-gradient(ellipse, rgba(30,180,90,0.40) 0%, rgba(10,120,50,0.12) 45%, transparent 70%)',
    width: 340, height: 300,
    initial: { x: '-24%', y: '60%' },
    animate: { x: ['-24%', '-10%', '-28%', '-24%'], y: ['60%', '68%', '54%', '60%'] },
    idleDuration: 22, recDuration: 8,
  },
  {
    color: 'radial-gradient(ellipse, rgba(240,80,160,0.42) 0%, rgba(200,50,120,0.14) 45%, transparent 70%)',
    width: 360, height: 320,
    initial: { x: '28%', y: '55%' },
    animate: { x: ['28%', '18%', '34%', '28%'], y: ['55%', '62%', '48%', '55%'] },
    idleDuration: 28, recDuration: 9,
  },
  {
    color: 'radial-gradient(ellipse, rgba(60,120,255,0.32) 0%, rgba(30,80,200,0.10) 45%, transparent 70%)',
    width: 300, height: 280,
    initial: { x: '38%', y: '-18%' },
    animate: { x: ['38%', '28%', '42%', '38%'], y: ['-18%', '-8%', '-24%', '-18%'] },
    idleDuration: 24, recDuration: 8,
  },
];

// ─── Platform discs ───────────────────────────────────────────────────────────

const platforms = [
  { id: 'linkedin',  label: 'LinkedIn',  color: 'rgba(10,102,194,0.78)',  glow: 'rgba(10,102,194,0.38)'  },
  { id: 'x',         label: 'X',         color: 'rgba(210,210,220,0.78)', glow: 'rgba(200,200,210,0.36)'  },
  { id: 'instagram', label: 'Instagram', color: 'rgba(193,53,132,0.78)',  glow: 'rgba(193,53,132,0.38)'  },
  { id: 'threads',   label: 'Threads',   color: 'rgba(100,80,200,0.78)',  glow: 'rgba(100,80,200,0.36)'  },
];

const arcPositions = [
  { left: '10%', top: '56%' },
  { left: '32%', top: '45%' },
  { left: '56%', top: '45%' },
  { left: '76%', top: '56%' },
];

// ─── Orb phase targets ────────────────────────────────────────────────────────

const ORB: Record<Phase, object> = {
  idle:      { width: 200, height: 200, borderRadius: '50%', top: '50%', left: '50%', x: '-50%', y: '-50%', opacity: 1, scale: 1 },
  prompt:    { width: 300, height: 76,  borderRadius: 38,    top: '76%', left: '50%', x: '-50%', y: '-50%', opacity: 1, scale: 1 },
  recording: { width: 140, height: 140, borderRadius: '50%', top: '50%', left: '50%', x: '-50%', y: '-50%', opacity: 0, scale: 0.6 },
  platform:  { width: 160, height: 44,  borderRadius: 22,    top: '11%', left: '50%', x: '-50%', y: '-50%', opacity: 1, scale: 1 },
  // small glow dot — sits left of the centered headline
  draft:     { width: 18,  height: 18,  borderRadius: '50%', top: '8.2%', left: '50%', x: -108,  y: '-50%', opacity: 1, scale: 1 },
  // bloom: expands from draft-dot position to center fill then fades
  posting:   { width: 220, height: 220, borderRadius: '50%', top: '50%', left: '50%', x: '-50%', y: '-50%', opacity: 0, scale: 1 },
};

const SPRING = { type: 'spring' as const, stiffness: 100, damping: 20 };

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

  const fastAurora = phase === 'recording' || phase === 'platform';

  function advance() { if (phase === 'idle') { setPhase('prompt'); setTimeout(() => setHintVisible(true), 1200); } }
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

  return (
    <LayoutGroup>
      <div
        onClick={phase === 'idle' ? advance : undefined}
        className="onboarding-root"
        style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none' }}
      >
        {/* CSS @property gradient drift */}
        <style>{`
          @property --bg-a {
            syntax: '<angle>';
            initial-value: 160deg;
            inherits: false;
          }
          @keyframes bg-drift { to { --bg-a: 205deg; } }
          .onboarding-root {
            background: linear-gradient(var(--bg-a), #0d0608 0%, #100810 55%, #0c0d18 100%);
            animation: bg-drift 18s linear infinite alternate;
          }
          .draft-area {
            caret-color: rgba(255,255,255,0.90);
            color: rgba(255,255,255,0.88);
          }
          .draft-area::selection { background: rgba(255,255,255,0.18); }
        `}</style>

        {/* Aurora blobs */}
        {auroraBlobs.map((blob, i) => (
          <motion.div key={i} aria-hidden
            initial={{ x: blob.initial.x, y: blob.initial.y }}
            animate={{
              x: blob.animate.x, y: blob.animate.y,
              scale: fastAurora ? [1, 1.12, 0.94, 1.08, 1] : 1,
              opacity: fastAurora ? [1, 1.4, 0.9, 1.3, 1] : 1,
            }}
            transition={{
              x: { duration: fastAurora ? blob.recDuration : blob.idleDuration, repeat: Infinity, ease: 'easeInOut', repeatType: 'loop' },
              y: { duration: fastAurora ? blob.recDuration : blob.idleDuration, repeat: Infinity, ease: 'easeInOut', repeatType: 'loop' },
              scale: fastAurora ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.6 },
              opacity: fastAurora ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.6 },
            }}
            style={{ position: 'absolute', top: 0, left: 0, width: blob.width, height: blob.height, background: blob.color, filter: 'blur(54px)', willChange: 'transform', pointerEvents: 'none' }}
          />
        ))}

        {/* Grain */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, opacity: 0.04, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '200px 200px', pointerEvents: 'none', zIndex: 1 }} />

        {/* ── Morphing orb (always mounted, layoutId for FLIP) ── */}
        <motion.div
          layoutId="main-orb"
          onClick={(e) => {
            if (phase === 'prompt') { e.stopPropagation(); startRecording(); }
            if (phase === 'draft')  { e.stopPropagation(); triggerPost(); }
          }}
          animate={{
            ...ORB[phase],
            ...(orbAbsorb ? { scale: [1, 1.18, 1] } : {}),
          }}
          transition={SPRING}
          style={{
            position: 'absolute', zIndex: 12,
            cursor: (phase === 'prompt' || phase === 'draft') ? 'pointer' : 'default',
            pointerEvents: phase === 'recording' ? 'none' : 'auto',
          }}
        >
          {/* Halo */}
          <motion.div aria-hidden
            animate={
              phase === 'idle'
                ? { scale: [1, 1.08, 1], opacity: [0.22, 0.40, 0.22] }
                : phase === 'draft'
                ? { scale: [1, 1.5, 1], opacity: [0.5, 0.9, 0.5] }
                : { scale: 1, opacity: 0.18 }
            }
            transition={
              (phase === 'idle' || phase === 'draft')
                ? { duration: phase === 'draft' ? 2.4 : 4, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0.8 }
            }
            style={{ position: 'absolute', inset: phase === 'draft' ? -10 : -28, borderRadius: 'inherit', background: 'radial-gradient(ellipse, rgba(255,255,255,0.30) 0%, transparent 70%)', filter: 'blur(12px)', pointerEvents: 'none' }}
          />
          {/* Body */}
          <motion.div aria-hidden
            animate={phase === 'idle' ? { scale: [0.96, 1.04, 0.96] } : { scale: 1 }}
            transition={phase === 'idle' ? { duration: 4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.6 }}
            style={{ width: '100%', height: '100%', borderRadius: 'inherit', background: 'linear-gradient(145deg, rgba(255,255,255,0.96) 0%, rgba(240,235,255,0.88) 50%, rgba(220,210,255,0.82) 100%)', boxShadow: '0 0 60px 20px rgba(255,255,255,0.22), 0 0 120px 40px rgba(200,170,255,0.12), inset 0 1px 0 rgba(255,255,255,0.9)', pointerEvents: 'none' }}
          />
        </motion.div>

        {/* ── Recording canvas ── */}
        <AnimatePresence>
          {phase === 'recording' && (
            <motion.div key="rec-canvas" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }} style={{ position: 'absolute', inset: 0, zIndex: 20 }}>
              <RecordingCanvas onStop={goToPlatform} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Platform discs ── */}
        <AnimatePresence>
          {phase === 'platform' && platforms.map((p, i) => {
            const pos = arcPositions[i];
            const isSelected = selectedPlatform === p.id;
            const isDimmed = selectedPlatform !== null && !isSelected;
            return (
              <motion.div key={p.id} onClick={() => pickPlatform(p.id)}
                initial={{ opacity: 0, scale: 0.5, y: 30 }}
                animate={
                  isSelected ? { opacity: [1, 1, 0], scale: [1, 1.35, 0], y: [0, -8, -340] }
                  : isDimmed  ? { opacity: 0, scale: 0.72, y: 0 }
                  : { opacity: 1, scale: 1, y: 0 }
                }
                exit={{ opacity: 0, scale: 0.6 }}
                transition={
                  isSelected ? { duration: 0.72, ease: 'easeIn', times: [0, 0.3, 1] }
                  : isDimmed  ? { duration: 0.45 }
                  : { ...SPRING, delay: i * 0.08 + 0.15 }
                }
                style={{ position: 'absolute', left: pos.left, top: pos.top, transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, cursor: selectedPlatform ? 'default' : 'pointer', zIndex: 15 }}
              >
                <div style={{ position: 'relative', width: 88, height: 88 }}>
                  <div style={{ position: 'absolute', inset: -14, borderRadius: '50%', background: `radial-gradient(circle, ${p.glow} 0%, transparent 70%)`, filter: 'blur(12px)', pointerEvents: 'none' }} />
                  <div style={{ width: 88, height: 88, borderRadius: '50%', background: `radial-gradient(circle at 38% 36%, ${p.color} 0%, ${p.color.replace(/[\d.]+\)$/, '0.45)')} 55%, ${p.color.replace(/[\d.]+\)$/, '0.18)')} 100%)`, filter: 'blur(3px)', boxShadow: `0 4px 24px ${p.glow}` }} />
                </div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.80)', letterSpacing: '0.01em', pointerEvents: 'none' }}>{p.label}</div>
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
              {/* Frosted card */}
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', borderRadius: 20, padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <textarea
                  className="draft-area"
                  value={draftText}
                  onChange={e => setDraftText(e.target.value)}
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'var(--font-sans)', fontSize: 15.5, lineHeight: 1.72, resize: 'none', padding: 0, margin: 0 }}
                />
              </div>

              {/* "Tap the orb to post" */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.8 }}
                style={{ textAlign: 'center', marginTop: 16, fontFamily: 'var(--font-sans)', fontSize: 13, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.03em', pointerEvents: 'none' }}
              >
                Tap the orb to post
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Posting bloom overlay ── */}
        <AnimatePresence>
          {phase === 'posting' && (
            <>
              <motion.div key="bloom"
                initial={{ scale: 0.1, opacity: 0.9 }}
                animate={{ scale: 9, opacity: 0 }}
                transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
                style={{ position: 'absolute', width: 180, height: 180, borderRadius: '50%', top: '50%', left: '50%', x: '-50%', y: '-50%', background: 'radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(220,200,255,0.18) 50%, transparent 70%)', filter: 'blur(8px)', pointerEvents: 'none', zIndex: 50 }}
              />
              <motion.div key="posted-label"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ...SPRING, delay: 0.35 }}
                style={{ position: 'absolute', top: '50%', left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 32, fontWeight: 700, color: 'rgba(255,255,255,0.94)', letterSpacing: '-0.03em', y: '-50%', pointerEvents: 'none', zIndex: 55 }}
              >
                Posted ✦
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── Headlines ── */}
        <AnimatePresence>
          {phase === 'idle' && (
            <motion.div key="h-idle" layoutId="headline"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.6 }}
              style={{ position: 'absolute', top: '34%', left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 26, fontWeight: 600, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.02em', pointerEvents: 'none', zIndex: 5 }}
            >Let's write a post</motion.div>
          )}
          {phase === 'prompt' && (
            <motion.div key="h-prompt" layoutId="headline"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.6 }}
              style={{ position: 'absolute', top: '28%', left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 24, fontWeight: 600, color: 'rgba(255,255,255,0.88)', letterSpacing: '-0.02em', pointerEvents: 'none', zIndex: 5 }}
            >What's on your mind?</motion.div>
          )}
          {phase === 'recording' && (
            <motion.div key="h-recording"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.6 }}
              style={{ position: 'absolute', top: '18%', left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,0.80)', letterSpacing: '-0.02em', pointerEvents: 'none', zIndex: 5 }}
            >Go ahead, I'm listening</motion.div>
          )}
          {phase === 'platform' && (
            <motion.div key="h-platform"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.6 }}
              style={{ position: 'absolute', top: '22%', left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 24, fontWeight: 600, color: 'rgba(255,255,255,0.88)', letterSpacing: '-0.02em', pointerEvents: 'none', zIndex: 5 }}
            >Where should this go?</motion.div>
          )}
          {(phase === 'draft' || phase === 'posting') && (
            <motion.div key="h-draft" layoutId="headline"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: phase === 'posting' ? 0 : 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.55 }}
              style={{ position: 'absolute', top: '6%', left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 20, fontWeight: 600, color: 'rgba(255,255,255,0.82)', letterSpacing: '-0.02em', pointerEvents: 'none', zIndex: 5 }}
            >Here's your draft</motion.div>
          )}
        </AnimatePresence>

        {/* ── Hints ── */}
        <AnimatePresence>
          {phase === 'prompt' && hintVisible && (
            <motion.div key="hint-record" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }}
              style={{ position: 'absolute', bottom: '12%', left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 14, color: 'rgba(255,255,255,0.42)', letterSpacing: '0.04em', pointerEvents: 'none', zIndex: 5 }}
            >tap to record</motion.div>
          )}
          {phase === 'recording' && (
            <motion.div key="hint-stop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: 1.2, duration: 0.8 }}
              style={{ position: 'absolute', bottom: '12%', left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 14, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em', pointerEvents: 'none', zIndex: 5 }}
            >tap anywhere to continue</motion.div>
          )}
        </AnimatePresence>

        {/* ── Skip (idle only) ── */}
        <AnimatePresence>
          {phase === 'idle' && (
            <motion.button key="skip" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: 0.8, duration: 0.5 }}
              onClick={(e) => { e.stopPropagation(); onComplete(); }}
              style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 20, padding: '6px 16px', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'rgba(255,255,255,0.52)', cursor: 'pointer', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 30 }}
            >Skip</motion.button>
          )}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}
