import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

interface Props {
  onComplete: () => void;
}

type Phase = 'idle' | 'prompt' | 'recording';

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

// Recording canvas — 4 green blobs orbiting center, reacting to mic audio level.
// Transparent background so aurora blobs show through.
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

    // Mic setup — best-effort; animation runs even if denied
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

      // Sample mic level
      if (analyser) {
        analyser.getByteFrequencyData(dataArr);
        let sum = 0;
        for (let k = 0; k < dataArr.length; k++) sum += dataArr[k];
        audioLevelRef.current = Math.min(1, (sum / dataArr.length) / 80);
      }

      const level = audioLevelRef.current;
      const isSpeaking = level > 0.12;
      const targetSpread = isSpeaking ? 10 : 88;
      spread += (targetSpread - spread) * 0.04;

      // Transparent — aurora shows through
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < 4; i++) {
        const angle = t * 0.65 + i * (Math.PI * 0.5);
        const r = spread + Math.sin(t * 0.45 + i * 1.1) * 20;
        const px = cx + Math.cos(angle) * r * 0.88;
        const py = cy + Math.sin(angle) * r * 0.72;
        const sz = (155 + Math.sin(t * 0.9 + i * 0.8) * 38) * (1 + level * 0.5);
        const hue = 145 + i * 5;
        const alpha = 0.22 + level * 0.32;
        const grad = ctx.createRadialGradient(px, py, 0, px, py, sz);
        grad.addColorStop(0, `hsla(${hue},58%,52%,${alpha.toFixed(2)})`);
        grad.addColorStop(0.5, `hsla(${hue},50%,48%,${(alpha * 0.28).toFixed(2)})`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      // Central convergence glow — brightens when speaking
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
      stream?.getTracks().forEach(t => t.stop());
      audioCtx?.close().catch(() => {});
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      onClick={onStop}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        cursor: 'pointer',
        zIndex: 20,
        touchAction: 'none',
      }}
    />
  );
}

const orbIdle = {
  width: 200,
  height: 200,
  borderRadius: '50%',
  top: '50%',
  left: '50%',
  x: '-50%',
  y: '-50%',
  opacity: 1,
  scale: 1,
};

const orbPrompt = {
  width: 300,
  height: 76,
  borderRadius: 38,
  top: '76%',
  left: '50%',
  x: '-50%',
  y: '-50%',
  opacity: 1,
  scale: 1,
};

const orbRecording = {
  width: 140,
  height: 140,
  borderRadius: '50%',
  top: '50%',
  left: '50%',
  x: '-50%',
  y: '-50%',
  opacity: 0,
  scale: 0.6,
};

export default function MobileOnboarding({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [hintVisible, setHintVisible] = useState(false);

  function advance() {
    if (phase === 'idle') {
      setPhase('prompt');
      setTimeout(() => setHintVisible(true), 1200);
    }
  }

  function startRecording() {
    setHintVisible(false);
    setPhase('recording');
  }

  const orbTarget = phase === 'idle' ? orbIdle : phase === 'prompt' ? orbPrompt : orbRecording;
  const isRecording = phase === 'recording';

  return (
    <div
      onClick={phase === 'idle' ? advance : undefined}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#0d0608',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* Aurora blobs — animate faster in recording phase */}
      {auroraBlobs.map((blob, i) => (
        <motion.div
          key={i}
          aria-hidden
          initial={{ x: blob.initial.x, y: blob.initial.y }}
          animate={{
            x: blob.animate.x,
            y: blob.animate.y,
            scale: isRecording ? [1, 1.12, 0.94, 1.08, 1] : 1,
            opacity: isRecording ? [1, 1.4, 0.9, 1.3, 1] : 1,
          }}
          transition={{
            x: { duration: isRecording ? blob.recDuration : blob.idleDuration, repeat: Infinity, ease: 'easeInOut', repeatType: 'loop' },
            y: { duration: isRecording ? blob.recDuration : blob.idleDuration, repeat: Infinity, ease: 'easeInOut', repeatType: 'loop' },
            scale: isRecording ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.6 },
            opacity: isRecording ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.6 },
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: blob.width,
            height: blob.height,
            background: blob.color,
            filter: 'blur(54px)',
            willChange: 'transform',
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Grain texture */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.04,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '200px 200px',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Idle label */}
      <AnimatePresence>
        {phase === 'idle' && (
          <motion.div
            key="idle-label"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: '34%',
              left: 0,
              right: 0,
              textAlign: 'center',
              fontFamily: 'var(--font-sans)',
              fontSize: 26,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.92)',
              letterSpacing: '-0.02em',
              pointerEvents: 'none',
              zIndex: 5,
            }}
          >
            Let's write a post
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prompt label */}
      <AnimatePresence>
        {phase === 'prompt' && (
          <motion.div
            key="prompt-label"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: '28%',
              left: 0,
              right: 0,
              textAlign: 'center',
              fontFamily: 'var(--font-sans)',
              fontSize: 24,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.88)',
              letterSpacing: '-0.02em',
              pointerEvents: 'none',
              zIndex: 5,
            }}
          >
            What's on your mind?
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recording label */}
      <AnimatePresence>
        {phase === 'recording' && (
          <motion.div
            key="rec-label"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: '18%',
              left: 0,
              right: 0,
              textAlign: 'center',
              fontFamily: 'var(--font-sans)',
              fontSize: 22,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.80)',
              letterSpacing: '-0.02em',
              pointerEvents: 'none',
              zIndex: 5,
            }}
          >
            Go ahead, I'm listening
          </motion.div>
        )}
      </AnimatePresence>

      {/* Morphing white orb (idle + prompt); fades out entering recording */}
      <motion.div
        onClick={(e) => { if (phase === 'prompt') { e.stopPropagation(); startRecording(); } }}
        aria-label={phase === 'idle' ? 'Tap to continue' : phase === 'prompt' ? 'Tap to start recording' : undefined}
        animate={orbTarget}
        transition={{ type: 'spring', stiffness: 60, damping: 18, mass: 1.2 }}
        style={{
          position: 'absolute',
          cursor: phase === 'prompt' ? 'pointer' : 'default',
          zIndex: 10,
          pointerEvents: phase === 'recording' ? 'none' : 'auto',
        }}
      >
        {/* Halo */}
        <motion.div
          aria-hidden
          animate={
            phase === 'idle'
              ? { scale: [1, 1.08, 1], opacity: [0.22, 0.38, 0.22] }
              : { scale: 1, opacity: 0.18 }
          }
          transition={
            phase === 'idle'
              ? { duration: 4, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.8 }
          }
          style={{
            position: 'absolute',
            inset: -28,
            borderRadius: 'inherit',
            background: 'radial-gradient(ellipse, rgba(255,255,255,0.28) 0%, transparent 70%)',
            filter: 'blur(18px)',
            pointerEvents: 'none',
          }}
        />
        {/* Body */}
        <motion.div
          aria-hidden
          animate={
            phase === 'idle'
              ? { scale: [0.96, 1.04, 0.96] }
              : { scale: 1 }
          }
          transition={
            phase === 'idle'
              ? { duration: 4, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.6 }
          }
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 'inherit',
            background: 'linear-gradient(145deg, rgba(255,255,255,0.96) 0%, rgba(240,235,255,0.88) 50%, rgba(220,210,255,0.82) 100%)',
            boxShadow: '0 0 60px 20px rgba(255,255,255,0.22), 0 0 120px 40px rgba(200,170,255,0.12), inset 0 1px 0 rgba(255,255,255,0.9)',
            pointerEvents: 'none',
          }}
        />
      </motion.div>

      {/* Recording canvas — 4 blobs, transparent bg, mic-reactive */}
      <AnimatePresence>
        {phase === 'recording' && (
          <motion.div
            key="rec-canvas"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            style={{ position: 'absolute', inset: 0, zIndex: 20 }}
          >
            <RecordingCanvas onStop={onComplete} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* "tap to record" hint — prompt phase */}
      <AnimatePresence>
        {phase === 'prompt' && hintVisible && (
          <motion.div
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            style={{
              position: 'absolute',
              bottom: '12%',
              left: 0,
              right: 0,
              textAlign: 'center',
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              color: 'rgba(255,255,255,0.42)',
              letterSpacing: '0.04em',
              pointerEvents: 'none',
              zIndex: 5,
            }}
          >
            tap to record
          </motion.div>
        )}
      </AnimatePresence>

      {/* "tap to stop" hint — recording phase */}
      <AnimatePresence>
        {phase === 'recording' && (
          <motion.div
            key="stop-hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 1.2, duration: 0.8 }}
            style={{
              position: 'absolute',
              bottom: '12%',
              left: 0,
              right: 0,
              textAlign: 'center',
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              color: 'rgba(255,255,255,0.35)',
              letterSpacing: '0.04em',
              pointerEvents: 'none',
              zIndex: 5,
            }}
          >
            tap anywhere to continue
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip button — idle phase only */}
      <AnimatePresence>
        {phase === 'idle' && (
          <motion.button
            key="skip"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            onClick={(e) => { e.stopPropagation(); onComplete(); }}
            style={{
              position: 'absolute',
              top: 20,
              right: 20,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: 20,
              padding: '6px 16px',
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              color: 'rgba(255,255,255,0.52)',
              cursor: 'pointer',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              zIndex: 30,
            }}
          >
            Skip
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
