import { useRef, useEffect, useState } from 'react';
import { Panel } from '@xyflow/react';

export default function CursorSpotlight() {
  const [pos, setPos] = useState({ x: -200, y: -200 });
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current?.closest('.react-flow') as HTMLElement | null;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setVisible(true);
    };
    const onLeave = () => setVisible(false);

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <Panel position="top-left" style={{ margin: 0, padding: 0, inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      <div ref={containerRef} style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        background: visible
          ? `radial-gradient(circle 80px at ${pos.x}px ${pos.y}px, rgba(0,0,0,0.06) 0%, transparent 100%)`
          : 'transparent',
        transition: 'opacity 150ms',
        opacity: visible ? 1 : 0,
      }} />
    </Panel>
  );
}
