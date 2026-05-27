import { useState } from 'react';
import SmartGradient from './SmartGradient';

const TABS = [
  { id: 'presence', label: 'Presence', sub: 'Violet + sky blue' },
  { id: 'warmth',   label: 'Warmth',   sub: 'Blush + amber'    },
] as const;

export default function GradientPreview({ style }: { style?: React.CSSProperties }) {
  const [active, setActive] = useState<'presence' | 'warmth'>('presence');

  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', ...style }}>
      <SmartGradient variant={active} style={{ flex: 1 }} />

      {/* Tab bar — floats above the gradient */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 8,
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 12,
        padding: '4px',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              padding: '8px 20px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              background: active === tab.id ? 'rgba(255,255,255,0.12)' : 'transparent',
              transition: 'background 200ms',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: active === tab.id ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-sans, system-ui)', letterSpacing: '-0.01em' }}>
              {tab.label}
            </span>
            <span style={{ fontSize: 11, color: active === tab.id ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-sans, system-ui)' }}>
              {tab.sub}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
