import type { Meta, StoryObj } from '@storybook/react';
import '../index.css';
const scale = ['--text-xs','--text-sm','--text-md','--text-lg','--text-xl'] as const;
function TypographyScale() {
  return (<div style={{ fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
    {scale.map((t) => (<div key={t} style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-4)', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border-subtle)' }}><div style={{ width: 'var(--space-10)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', flexShrink: 0 }}>{t}</div><div style={{ fontSize: `var(${t})`, fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)' }}>Content repurposing engine</div></div>))}
  </div>);
}
const meta: Meta = { title: 'Foundations/Typography/Scale', component: TypographyScale, tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = {};
