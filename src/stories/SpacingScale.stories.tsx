import type { Meta, StoryObj } from '@storybook/react';
import '../index.css';
const tokens = ['--space-1','--space-2','--space-3','--space-4','--space-5','--space-6','--space-8','--space-10','--space-12'];
function SpacingScale() {
  return (<div style={{ fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'flex-end', gap: 'var(--space-2)' }}>{tokens.map((t) => (<div key={t} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)' }}><div style={{ width: `var(${t})`, height: `var(${t})`, background: 'var(--color-accent)', borderRadius: 2 }} /><span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{t.replace('--space-','')}</span></div>))}</div>);
}
const meta: Meta = { title: 'Foundations/Spacing/Scale', component: SpacingScale, tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = {};
