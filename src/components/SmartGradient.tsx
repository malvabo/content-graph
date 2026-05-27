import type { CSSProperties } from 'react';

type Variant = 'presence' | 'warmth';

const ORB_COLORS: Record<Variant, [string, string]> = {
  presence: [
    'radial-gradient(circle, rgba(196,181,253,0.70) 0%, rgba(196,181,253,0.30) 40%, rgba(196,181,253,0) 70%)',
    'radial-gradient(circle, rgba(147,197,253,0.58) 0%, rgba(147,197,253,0.22) 40%, rgba(147,197,253,0) 70%)',
  ],
  warmth: [
    'radial-gradient(circle, rgba(252,165,165,0.65) 0%, rgba(252,165,165,0.26) 40%, rgba(252,165,165,0) 70%)',
    'radial-gradient(circle, rgba(252,211,77,0.52)  0%, rgba(252,211,77,0.18)  40%, rgba(252,211,77,0)  70%)',
  ],
};

const KEYFRAMES = `
  @keyframes sg-orb-1 {
    0%,100% { transform: translate(0%,    0%); }
    25%     { transform: translate(10%,  -9%); }
    50%     { transform: translate(16%,  12%); }
    75%     { transform: translate(-8%,  14%); }
  }
  @keyframes sg-orb-2 {
    0%,100% { transform: translate(0%,    0%); }
    33%     { transform: translate(-14%,-11%); }
    66%     { transform: translate(12%,   9%); }
  }
`;

/**
 * Soft ambient gradient — two large orbs drifting via CSS keyframes.
 * variant="presence" — violet + sky blue
 * variant="warmth"   — blush + amber
 */
export default function SmartGradient({
  style,
  variant = 'presence',
}: {
  style?: CSSProperties;
  variant?: Variant;
}) {
  const [orb1, orb2] = ORB_COLORS[variant];

  return (
    <div style={{ position: 'relative', background: '#ffffff', overflow: 'hidden', ...style }}>
      <style>{KEYFRAMES}</style>

      {/* Orb 1 — upper-left */}
      <div style={{
        position: 'absolute',
        width: '80%',
        height: '80%',
        top: '-15%',
        left: '-10%',
        background: orb1,
        animation: 'sg-orb-1 16s ease-in-out infinite',
        willChange: 'transform',
      }} />

      {/* Orb 2 — lower-right */}
      <div style={{
        position: 'absolute',
        width: '75%',
        height: '75%',
        bottom: '-15%',
        right: '-10%',
        background: orb2,
        animation: 'sg-orb-2 20s ease-in-out infinite',
        willChange: 'transform',
      }} />

      {/* Grain */}
      <svg
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', mixBlendMode: 'multiply', opacity: 0.07 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <filter id="sg-grain" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#sg-grain)" />
      </svg>
    </div>
  );
}
