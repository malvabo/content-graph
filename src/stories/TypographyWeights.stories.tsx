import type { Meta, StoryObj } from '@storybook/react';
import '../index.css';
const leadings = ['--leading-none','--leading-tight','--leading-snug','--leading-normal','--leading-relaxed','--leading-loose'] as const;
function TypographyWeights() {
  return (<div style={{ fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
    <div>
      <div className="text-label" style={{ marginBottom: 'var(--space-3)' }}>Weights</div>
      <div style={{ display: 'flex', gap: 'var(--space-8)' }}>
        <div style={{ fontWeight: 'var(--weight-normal)', fontSize: 'var(--text-md)' }}>Normal (400)</div>
        <div style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-md)' }}>Medium (500)</div>
      </div>
    </div>
    <div>
      <div className="text-label" style={{ marginBottom: 'var(--space-3)' }}>Line Heights</div>
      {leadings.map((t) => (
        <div key={t} style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
          <div style={{ width: 'var(--size-panel)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', flexShrink: 0 }}>{t}</div>
          <div style={{ fontSize: 'var(--text-sm)', lineHeight: `var(${t})`, color: 'var(--color-text-primary)', background: 'var(--color-bg-surface)', padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-sm)' }}>
            The quick brown fox jumps over the lazy dog.
          </div>
        </div>
      ))}
    </div>
    <div>
      <div className="text-label" style={{ marginBottom: 'var(--space-3)' }}>Families</div>
      <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
        <div style={{ flex: 1, padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
          <div className="text-label" style={{ marginBottom: 'var(--space-2)' }}>Sans</div>
          <div style={{ fontSize: 'var(--text-lg)', fontFamily: 'var(--font-sans)' }}>The quick brown fox</div>
        </div>
        <div style={{ flex: 1, padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
          <div className="text-label" style={{ marginBottom: 'var(--space-2)' }}>Mono</div>
          <div style={{ fontSize: 'var(--text-lg)', fontFamily: 'var(--font-mono)' }}>The quick brown fox</div>
        </div>
      </div>
    </div>
  </div>);
}
const meta: Meta = { title: 'Foundations/Typography/Weights & Leading', component: TypographyWeights, tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = {};
