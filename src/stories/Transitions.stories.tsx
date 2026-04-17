import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import '../index.css';

/**
 * Documents the real transition/animation tokens from tokens.css and index.css.
 * All durations, easings, and keyframe animations used in the shipped product.
 */

const DURATIONS = [
  { token: '--duration-fast', value: '80ms', usage: 'Button press scale' },
  { token: '--duration-base', value: '100ms', usage: 'Background, border, color transitions' },
  { token: '--duration-medium', value: '150ms', usage: 'Focus rings, spotlight' },
  { token: '--duration-slow', value: '200ms', usage: 'Node selection, dimming' },
  { token: '--duration-enter', value: '300ms', usage: 'Gradient border fade, panel enter' },
];

const KEYFRAMES = [
  { name: 'pulse', duration: '1.2s', usage: 'Running status dot' },
  { name: 'done-pulse', duration: '0.5s', usage: 'Complete status dot' },
  { name: 'border-rotate', duration: '3s', usage: 'Run button gradient spin' },
  { name: 'flow-dash', duration: '0.6s', usage: 'Edge flow animation' },
  { name: 'btn-spin', duration: '0.65s', usage: 'Loading spinner' },
  { name: 'fadeIn', duration: '150ms', usage: 'Tooltip, notification enter' },
  { name: 'fadeSlideUp', duration: '200ms', usage: 'Dropdown enter' },
  { name: 'shimmer', duration: '1.5s', usage: 'Skeleton loading bars' },
];

function TransitionsDoc() {
  const [active, setActive] = useState<string | null>(null);
  return (
    <div style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', maxWidth: 640 }}>
      <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-medium)', marginBottom: 'var(--space-4)' }}>Duration Tokens</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-8)' }}>
        {DURATIONS.map(d => (
          <div key={d.token} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', width: 160, flexShrink: 0 }}>{d.token}</code>
            <div style={{ width: 80, flexShrink: 0 }}>
              <div style={{ height: 4, borderRadius: 'var(--radius-full)', background: 'var(--color-accent)', transition: `width ${d.value} var(--ease-default)`, width: active === d.token ? '100%' : '20%' }}
                onMouseEnter={() => setActive(d.token)} onMouseLeave={() => setActive(null)} />
            </div>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', width: 50, flexShrink: 0 }}>{d.value}</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{d.usage}</span>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-medium)', marginBottom: 'var(--space-4)' }}>Keyframe Animations</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {KEYFRAMES.map(k => (
          <div key={k.name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', width: 130, flexShrink: 0 }}>{k.name}</code>
            <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {k.name === 'pulse' && <div style={{ width: 6, height: 6, borderRadius: 'var(--radius-full)', background: 'var(--p-status-running)', animation: 'pulse 1.2s ease-in-out infinite' }} />}
              {k.name === 'btn-spin' && <div style={{ width: 14, height: 14, border: '2px solid var(--color-border-default)', borderTopColor: 'var(--color-accent)', borderRadius: 'var(--radius-full)', animation: 'btn-spin 0.65s linear infinite' }} />}
              {k.name === 'shimmer' && <div className="skeleton-bar" style={{ width: 24, height: 4, borderRadius: 'var(--radius-sm)' }} />}
              {!['pulse', 'btn-spin', 'shimmer'].includes(k.name) && <div style={{ width: 6, height: 6, borderRadius: 'var(--radius-full)', background: 'var(--color-accent)' }} />}
            </div>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', width: 50, flexShrink: 0 }}>{k.duration}</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{k.usage}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const meta: Meta = { title: 'Foundations/Transitions', component: TransitionsDoc, tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = {};
