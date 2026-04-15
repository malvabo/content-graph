import type { Meta, StoryObj } from '@storybook/react';
import '../index.css';
const tokens = ['--radius-sm','--radius-md','--radius-lg','--radius-xl','--radius-full'];
function RadiusScale() {
  return (<div style={{ fontFamily: 'var(--font-sans)', display: 'flex', gap: 'var(--space-4)' }}>{tokens.map((t) => (<div key={t} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}><div style={{ width: 'var(--size-fab)', height: 'var(--size-fab)', border: '2px solid var(--color-border-default)', borderRadius: `var(${t})` }} /><span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{t.replace('--radius-','')}</span></div>))}</div>);
}
const meta: Meta = { title: 'Foundations/Radius/Scale', component: RadiusScale, tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = {};
