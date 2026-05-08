import { useEffect, memo } from 'react';

interface Props {
  x: number;
  y: number;
  onDone: () => void;
}

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
      {/* 56×28 canvas; x=0 sits at the output handle */}
      <svg
        width="56"
        height="28"
        viewBox="0 0 56 28"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        overflow="visible"
      >
        {/* ── Left hand: comes out of the node output handle ── */}
        <g style={{ animation: 'hs-left 1.7s ease forwards' }}>
          {/* Wrist / arm stub from the handle */}
          <line x1="0" y1="14" x2="5" y2="14" />
          {/* Palm */}
          <rect x="5" y="7" width="13" height="14" rx="2.5" />
          {/* Four finger stubs from the top of the palm */}
          <line x1="7"  y1="7" x2="7"  y2="4" />
          <line x1="10" y1="7" x2="10" y2="4" />
          <line x1="13" y1="7" x2="13" y2="4" />
          <line x1="16" y1="7" x2="16" y2="4" />
          {/* Thumb */}
          <line x1="5" y1="21" x2="3" y2="24" />
        </g>

        {/* ── Right hand: approaches from behind (from the right) ── */}
        <g style={{ animation: 'hs-right 1.7s ease forwards' }}>
          {/* Wrist stub */}
          <line x1="56" y1="14" x2="51" y2="14" />
          {/* Palm */}
          <rect x="38" y="7" width="13" height="14" rx="2.5" />
          {/* Four finger stubs (also top, slightly offset for the interlock look) */}
          <line x1="40" y1="7" x2="40" y2="4" />
          <line x1="43" y1="7" x2="43" y2="4" />
          <line x1="46" y1="7" x2="46" y2="4" />
          <line x1="49" y1="7" x2="49" y2="4" />
          {/* Thumb */}
          <line x1="51" y1="21" x2="53" y2="24" />
        </g>
      </svg>
    </div>
  );
}

export default memo(HandshakeAnimation);
