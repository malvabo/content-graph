import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';

interface Props {
  onComplete: () => void;
}

type Phase = 'idle' | 'prompt';

const auroraBlobs = [
  {
    // warm orange — bottom center
    color: 'radial-gradient(ellipse, rgba(255,140,60,0.55) 0%, rgba(255,100,30,0.18) 45%, transparent 70%)',
    width: 420, height: 380,
    initial: { x: '-10%', y: '42%' },
    animate: { x: ['-10%', '8%', '-6%', '-10%'], y: ['42%', '50%', '38%', '42%'] },
    duration: 26,
  },
  {
    // purple — top left
    color: 'radial-gradient(ellipse, rgba(140,60,255,0.50) 0%, rgba(100,30,200,0.16) 45%, transparent 70%)',
    width: 380, height: 360,
    initial: { x: '-30%', y: '-20%' },
    animate: { x: ['-30%', '-18%', '-34%', '-30%'], y: ['-20%', '-10%', '-26%', '-20%'] },
    duration: 30,
  },
  {
    // deep green — bottom left
    color: 'radial-gradient(ellipse, rgba(30,180,90,0.40) 0%, rgba(10,120,50,0.12) 45%, transparent 70%)',
    width: 340, height: 300,
    initial: { x: '-24%', y: '60%' },
    animate: { x: ['-24%', '-10%', '-28%', '-24%'], y: ['60%', '68%', '54%', '60%'] },
    duration: 22,
  },
  {
    // pink/rose — mid low right
    color: 'radial-gradient(ellipse, rgba(240,80,160,0.42) 0%, rgba(200,50,120,0.14) 45%, transparent 70%)',
    width: 360, height: 320,
    initial: { x: '28%', y: '55%' },
    animate: { x: ['28%', '18%', '34%', '28%'], y: ['55%', '62%', '48%', '55%'] },
    duration: 28,
  },
  {
    // cool blue — top right
    color: 'radial-gradient(ellipse, rgba(60,120,255,0.32) 0%, rgba(30,80,200,0.10) 45%, transparent 70%)',
    width: 300, height: 280,
    initial: { x: '38%', y: '-18%' },
    animate: { x: ['38%', '28%', '42%', '38%'], y: ['-18%', '-8%', '-24%', '-18%'] },
    duration: 24,
  },
];

const orbIdle = {
  width: 200,
  height: 200,
  borderRadius: '50%',
  top: '50%',
  left: '50%',
  x: '-50%',
  y: '-50%',
};

const orbPrompt = {
  width: 300,
  height: 76,
  borderRadius: 38,
  top: '76%',
  left: '50%',
  x: '-50%',
  y: '-50%',
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

  function complete() {
    onComplete();
  }

  const orbTarget = phase === 'idle' ? orbIdle : orbPrompt;

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
      {/* Aurora blobs */}
      {auroraBlobs.map((blob, i) => (
        <motion.div
          key={i}
          aria-hidden
          initial={{ x: blob.initial.x, y: blob.initial.y }}
          animate={{ x: blob.animate.x, y: blob.animate.y }}
          transition={{ duration: blob.duration, repeat: Infinity, ease: 'easeInOut', repeatType: 'loop' }}
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

      {/* Noise/grain overlay for texture */}
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
        }}
      />

      {/* Idle phase label */}
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
            }}
          >
            Let's write a post
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prompt phase label */}
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
            }}
          >
            What's on your mind?
          </motion.div>
        )}
      </AnimatePresence>

      {/* Morphing orb */}
      <motion.div
        onClick={(e) => { if (phase === 'prompt') { e.stopPropagation(); complete(); } }}
        aria-label={phase === 'idle' ? 'Tap to continue' : 'Tap to start recording'}
        animate={orbTarget}
        transition={{ type: 'spring', stiffness: 60, damping: 18, mass: 1.2 }}
        style={{
          position: 'absolute',
          cursor: 'pointer',
          zIndex: 10,
        }}
      >
        {/* Outer halo */}
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

        {/* Orb body */}
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

      {/* "Tap to record" hint — prompt phase only */}
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
            }}
          >
            tap to record
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
            }}
          >
            Skip
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
