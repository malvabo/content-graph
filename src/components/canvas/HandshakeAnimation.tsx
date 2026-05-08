import { useEffect, memo } from 'react';

interface Props {
  x: number;
  y: number;
  onDone: () => void;
}

/*
  Two organic bezier lines slide in from opposite sides and cross exactly
  once in the centre — the crossing is the grip.  The right path renders
  on top (SVG paint order) so one arm visually passes over the other,
  just like a real handshake.  Both lines then shake together (Y
  oscillation) before the wrapper fades out.
*/
function HandshakeAnimation({ x, y, onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, 1700);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translateY(-50%)',
        pointerEvents: 'none',
        zIndex: 1000,
        animation: 'hs-fade 1.7s ease forwards',
        overflow: 'visible',
      }}
    >
      {/*
        80 × 26 px canvas.  x=0 sits at the output handle.
        The two paths cross around x=40 (the midpoint).

        Left arm:  starts flat, makes an upward wave, then dips DOWN
                   as it enters the grip zone (y rises toward 20).
        Right arm: starts flat, makes a downward wave, then rises UP
                   into the grip zone (y falls toward 6).
        → at x≈40 left is below right, they have crossed.
      */}
      <svg
        width="80"
        height="26"
        viewBox="0 0 80 26"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        overflow="visible"
      >
        {/* Left arm — from the node's output handle */}
        <path
          d="M 0,13 C 15,13 22,5 34,11 C 40,14.5 42,21 46,19"
          style={{ animation: 'hs-left 1.7s ease forwards' }}
        />

        {/* Right arm — approaches from the right; renders on top at the cross */}
        <path
          d="M 80,13 C 65,13 58,21 46,15 C 40,10.5 38,5 34,8"
          style={{ animation: 'hs-right 1.7s ease forwards' }}
        />
      </svg>
    </div>
  );
}

export default memo(HandshakeAnimation);
