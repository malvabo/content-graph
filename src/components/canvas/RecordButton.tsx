import { useEffect, useState } from 'react';

interface Props {
  onClick: () => void;
  size?: number;
  state?: 'idle' | 'recording' | 'disabled';
  label?: string;
  'aria-label'?: string;
}

/**
 * Circular mic button with a rotating conic-gradient stroke and a breathing
 * halo. GPU-only animations (transform + opacity), paused under
 * prefers-reduced-motion and when the tab is hidden.
 */
export default function RecordButton({ onClick, size = 128, state = 'idle', label, 'aria-label': ariaLabel }: Props) {
  const disabled = state === 'disabled';
  const recording = state === 'recording';
  const [tabHidden, setTabHidden] = useState(typeof document !== 'undefined' && document.visibilityState === 'hidden');

  useEffect(() => {
    const h = () => setTabHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);

  const animateClass = tabHidden || disabled ? '' : recording ? 'rb-recording' : 'rb-idle';

  // Sizes derived from diameter to keep proportions at 64 / 96 / 128.
  const ring = Math.max(2, Math.round(size * 0.02));        // ring thickness
  const halo = Math.round(size * 0.35);                     // halo spread
  const glyph = Math.round(size * 0.36);                    // mic/stop icon

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: size >= 96 ? 12 : 8 }}>
      <button
        type="button"
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        aria-label={ariaLabel || (recording ? 'Stop recording' : disabled ? 'Microphone unavailable' : 'Start recording')}
        className={`record-button ${animateClass}`}
        style={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: '50%',
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.55 : 1,
          // Inner solid disc with vertical gradient for depth.
          isolation: 'isolate',
        }}
      >
        {/* Breathing halo */}
        <span
          aria-hidden
          className="rb-halo"
          style={{
            position: 'absolute',
            inset: -halo,
            borderRadius: '50%',
            background: recording
              ? `radial-gradient(circle, rgba(244, 63, 94, 0.35) 0%, rgba(244, 63, 94, 0) 60%)`
              : `radial-gradient(circle, rgba(122, 90, 248, 0.35) 0%, rgba(122, 90, 248, 0) 60%)`,
            filter: 'blur(8px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* Rotating conic-gradient ring */}
        <span
          aria-hidden
          className="rb-ring"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            padding: ring,
            background: recording
              ? 'conic-gradient(from 0deg, #f472b6, #7a5af8, #60a5fa, #f472b6)'
              : 'conic-gradient(from 0deg, #c4a7ff, #7a5af8, #a78bfa, #c4a7ff)',
            WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor',
            mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            maskComposite: 'exclude',
            zIndex: 1,
          }}
        />

        {/* Solid disc */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: ring + 2,
            borderRadius: '50%',
            background: 'linear-gradient(145deg, #2a1f4a 0%, #1a1130 100%)',
            boxShadow: '0 8px 30px rgba(120, 80, 255, 0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
            zIndex: 2,
          }}
        />

        {/* Glyph */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3,
            color: 'rgba(255,255,255,0.94)',
          }}
        >
          {recording ? (
            <svg width={glyph * 0.7} height={glyph * 0.7} viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="11" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0" />
              <path d="M12 17v4" />
              <path d="M8 21h8" />
            </svg>
          )}
        </span>
      </button>

      {label && (
        <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>
          {label}
        </div>
      )}

      <style>{`
        @keyframes rb-spin { to { transform: rotate(360deg); } }
        @keyframes rb-halo-breathe { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.85; transform: scale(1.06); } }
        @keyframes rb-halo-pulse { 0%, 100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.15); } }
        @keyframes rb-disc-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.025); } }

        .record-button .rb-ring { animation: rb-spin 6s linear infinite; transform-origin: 50% 50%; }
        .record-button.rb-recording .rb-ring { animation-duration: 2.4s; }
        .record-button.rb-idle .rb-halo { animation: rb-halo-breathe 3s ease-in-out infinite; transform-origin: 50% 50%; }
        .record-button.rb-recording .rb-halo { animation: rb-halo-pulse 1.1s ease-in-out infinite; transform-origin: 50% 50%; }
        .record-button.rb-recording { animation: rb-disc-breathe 900ms ease-in-out infinite; }

        .record-button:focus-visible { outline: 2px solid var(--color-accent, #7a5af8); outline-offset: 6px; border-radius: 50%; }
        .record-button:not(:disabled):hover { filter: brightness(1.1); }
        .record-button:not(:disabled):active { transform: scale(0.98); }

        @media (prefers-reduced-motion: reduce) {
          .record-button .rb-ring,
          .record-button .rb-halo,
          .record-button { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
