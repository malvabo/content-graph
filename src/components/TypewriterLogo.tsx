import { useEffect, useState } from 'react';

export default function TypewriterLogo({ fontSize = 96 }: { fontSize?: number }) {
  const label = 'up150';
  const [len, setLen] = useState(0);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (!deleting && len < label.length) {
      t = setTimeout(() => setLen(l => l + 1), 110);
    } else if (!deleting && len === label.length) {
      t = setTimeout(() => setDeleting(true), 900);
    } else if (deleting && len > 0) {
      t = setTimeout(() => setLen(l => l - 1), 70);
    } else if (deleting && len === 0) {
      t = setTimeout(() => setDeleting(false), 300);
    }
    return () => clearTimeout(t);
  }, [len, deleting]);
  return (
    <div aria-label="up150" style={{ display: 'inline-flex', alignItems: 'baseline' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize, fontWeight: 400, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>
        {label.slice(0, len)}
      </span>
      <span style={{ display: 'inline-block', width: 2, height: '1.1em', marginLeft: 1, background: 'var(--color-accent)', borderRadius: 1, verticalAlign: 'text-bottom', animation: 'caret-blink 0.9s step-end infinite' }} />
    </div>
  );
}
