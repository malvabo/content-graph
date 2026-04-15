import type { Meta, StoryObj } from '@storybook/react';
import '../index.css';
const tokens = ['--shadow-sm','--shadow-md','--shadow-lg','--shadow-glow'];
function Shadows() {
  return (<div style={{ fontFamily: 'var(--font-sans)', display: 'flex', gap: 'var(--space-4)' }}>{tokens.map((t) => (<div key={t} style={{ width: 'var(--size-panel)', height: 'var(--size-panel)', maxHeight: 'var(--space-10)', background: 'var(--color-bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: `var(${t})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{t.replace('--shadow-','')}</span></div>))}</div>);
}
const meta: Meta = { title: 'Foundations/Elevation/Shadows', component: Shadows, tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = {};
