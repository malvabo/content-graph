import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import '../index.css';
function Toggle({ label = 'Option', defaultChecked = false }: { label?: string; defaultChecked?: boolean }) {
  const [on, setOn] = useState(defaultChecked);
  return (<div style={{ fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: 'var(--size-panel)' }}>
    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{label}</span>
    <button onClick={() => setOn(!on)} style={{ width: 'var(--size-control-md)', height: 'var(--space-5)', borderRadius: 'var(--radius-full)', background: on ? 'var(--color-accent)' : 'var(--color-border-default)', position: 'relative', border: 'none', cursor: 'pointer', transition: `background var(--duration-base)` }} role="switch" aria-checked={on}>
      <div style={{ width: 'var(--text-sm)', height: 'var(--text-sm)', borderRadius: 'var(--radius-full)', background: 'var(--color-bg-card)', position: 'absolute', top: 2, left: on ? 'var(--space-4)' : 2, transition: `left var(--duration-medium)` }} />
    </button>
  </div>);
}
const meta: Meta<typeof Toggle> = { title: 'Components/Form/Toggle', component: Toggle, tags: ['autodocs'], argTypes: { label: { control: 'text' }, defaultChecked: { control: 'boolean' } } };
export default meta;
export const Off: StoryObj<typeof Toggle> = { args: { label: 'Include hashtags', defaultChecked: false } };
export const On: StoryObj<typeof Toggle> = { args: { label: 'Include emoji', defaultChecked: true } };
