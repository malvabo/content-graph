import { useState, useEffect, useRef, type ReactNode } from 'react';

export function HoverBorderGradient({ children, className = '', containerClassName = '' }: {
  children: ReactNode; className?: string; containerClassName?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [angle, setAngle] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!hovered) return;
    const start = performance.now();
    const animate = (now: number) => {
      setAngle(((now - start) * 0.18) % 360);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [hovered]);

  return (
    <div
      className={`relative rounded-full p-[2px] overflow-hidden ${containerClassName}`}
      style={{
        background: hovered
          ? `conic-gradient(from ${angle}deg, transparent 0%, #0DBF5A 10%, transparent 20%, transparent 100%)`
          : 'var(--cg-border)',
        transition: hovered ? 'none' : 'background 300ms',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={`rounded-full bg-white px-4 py-2 text-sm font-medium ${className}`}
        style={{ boxShadow: hovered ? '0 0 20px rgba(13,191,90,0.15)' : 'none' }}>
        {children}
      </div>
    </div>
  );
}
