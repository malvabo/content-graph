import type { Meta, StoryObj } from '@storybook/react';
import '../index.css';
const groups: Record<string, [string, string][]> = {
  Backgrounds: [['--color-bg','Page'],['--color-bg-surface','Surface'],['--color-bg-card','Card'],['--color-bg-popover','Popover'],['--color-bg-subtle','Subtle'],['--color-bg-dark','Dark']],
  Text: [['--color-text-primary','Primary'],['--color-text-secondary','Secondary'],['--color-text-tertiary','Tertiary'],['--color-text-disabled','Disabled'],['--color-text-placeholder','Placeholder'],['--color-text-on-dark','On dark']],
  Borders: [['--color-border-default','Default'],['--color-border-subtle','Subtle'],['--color-border-strong','Strong'],['--color-border-handle','Handle']],
  Interactive: [['--color-interactive-default','Default'],['--color-interactive-hover','Hover'],['--color-interactive-active','Active'],['--color-interactive-focus','Focus']],
  Accent: [['--color-accent','Default'],['--color-accent-hover','Hover'],['--color-accent-active','Active'],['--color-accent-subtle','Subtle']],
  Success: [['--color-success-bg','Bg'],['--color-success-border','Border'],['--color-success-text','Text']],
  Warning: [['--color-warning-bg','Bg'],['--color-warning-border','Border'],['--color-warning-text','Text']],
  Danger: [['--color-danger-bg','Bg'],['--color-danger-border','Border'],['--color-danger-text','Text'],['--color-danger','Action']],
};
function ColorSemantic() {
  return (<div style={{ fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
    {Object.entries(groups).map(([g, tokens]) => (<div key={g}><div className="text-label" style={{ marginBottom: 'var(--space-2)' }}>{g}</div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-1)' }}>{tokens.map(([t, l]) => (<div key={t} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-1) var(--space-2)' }}><div style={{ width: 'var(--size-swatch)', height: 'var(--size-swatch)', borderRadius: 'var(--radius-sm)', background: `var(${t})`, border: '1px solid var(--color-overlay-dark)' }} /><div><div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{t}</div><div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{l}</div></div></div>))}</div></div>))}
  </div>);
}
const meta: Meta = { title: 'Foundations/Color/Semantic', component: ColorSemantic, tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = {};
