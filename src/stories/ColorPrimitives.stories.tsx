import type { Meta, StoryObj } from '@storybook/react';
import '../index.css';
const groups: Record<string, string[]> = {
  Neutral: ['--p-neutral-50','--p-neutral-100','--p-neutral-200','--p-neutral-300','--p-neutral-350','--p-neutral-400','--p-neutral-450','--p-neutral-500','--p-neutral-600','--p-neutral-650','--p-neutral-700','--p-neutral-750','--p-neutral-800','--p-neutral-900','--p-neutral-950'],
  Green: ['--p-green-500','--p-green-600','--p-green-700'],
  Red: ['--p-red-500','--p-red-600','--p-red-700'],
  Amber: ['--p-amber-500','--p-amber-600'],
  Status: ['--p-status-idle','--p-status-running','--p-status-complete','--p-status-error'],
};
function ColorPrimitives() {
  return (<div style={{ fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
    {Object.entries(groups).map(([g, tokens]) => (<div key={g}><div className="text-label" style={{ marginBottom: 'var(--space-2)' }}>{g}</div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-1)' }}>{tokens.map((t) => (<div key={t} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-1) var(--space-2)' }}><div style={{ width: 'var(--size-swatch)', height: 'var(--size-swatch)', borderRadius: 'var(--radius-sm)', background: `var(${t})`, border: '1px solid var(--color-overlay-dark)' }} /><span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{t}</span></div>))}</div></div>))}
  </div>);
}
const meta: Meta = { title: 'Foundations/Color/Primitives', component: ColorPrimitives, tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = {};
