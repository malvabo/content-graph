import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import '../index.css';
function Select({ label = 'Label', value = 'Option 1', options = ['Option 1','Option 2','Option 3'] }: { label?: string; value?: string; options?: string[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(value);
  return (<div style={{ fontFamily: 'var(--font-sans)', maxWidth: 'var(--size-panel)', position: 'relative' }}>
    <div className="text-field-label" style={{ marginBottom: 'var(--space-1)' }}>{label}</div>
    <button onClick={() => setOpen(!open)} style={{ width: '100%', height: 'var(--size-control-md)', borderRadius: 'var(--radius-md)', border: `1px solid ${open ? 'var(--color-interactive-focus)' : 'var(--color-border-default)'}`, padding: '0 var(--space-2)', fontSize: 'var(--text-sm)', background: 'var(--color-bg-card)', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'var(--font-sans)' }}>
      <span>{selected}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.4, transform: open ? 'rotate(180deg)' : 'none', transition: `transform var(--duration-medium)` }}><path d="m6 9 6 6 6-6"/></svg>
    </button>
    {open && (<div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 'var(--space-1)', borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-popover)', border: '1px solid var(--color-border-subtle)', boxShadow: 'var(--shadow-md)', overflow: 'hidden', zIndex: 10 }}>
      {options.map((o) => (<button key={o} onClick={() => { setSelected(o); setOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-sm)', background: o === selected ? 'var(--color-bg-surface)' : 'transparent', color: 'var(--color-text-primary)', fontWeight: o === selected ? 'var(--weight-medium)' : 'var(--weight-normal)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'block' }}>{o}</button>))}
    </div>)}
  </div>);
}
const meta: Meta<typeof Select> = { title: 'Components/Form/Select', component: Select, tags: ['autodocs'], argTypes: { label: { control: 'text' }, value: { control: 'text' } } };
export default meta;
export const Default: StoryObj<typeof Select> = { args: { label: 'Goal', value: 'Thought leadership', options: ['Thought leadership','Personal story','Industry insight'] } };
export const OpenState: StoryObj<typeof Select> = { name: 'Open', args: { label: 'Model', value: 'claude-haiku-4', options: ['claude-haiku-4','claude-sonnet-4','claude-opus-4'] } };
