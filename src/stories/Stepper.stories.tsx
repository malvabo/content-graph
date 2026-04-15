import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import '../index.css';
function Stepper({ label = 'outputs', defaultValue = 1, min = 1, max = 5 }: { label?: string; defaultValue?: number; min?: number; max?: number }) {
  const [val, setVal] = useState(defaultValue);
  const btnStyle = { width: 'var(--size-control-xs)', height: 'var(--size-control-xs)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-default)', background: 'var(--color-bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-sm)', cursor: 'pointer' } as const;
  return (<div style={{ fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
    <button style={btnStyle} onClick={() => setVal(Math.max(min, val - 1))}>-</button>
    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', width: 'var(--size-control-xs)', textAlign: 'center' }}>{val}</span>
    <button style={btnStyle} onClick={() => setVal(Math.min(max, val + 1))}>+</button>
    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-placeholder)' }}>{label}</span>
  </div>);
}
const meta: Meta<typeof Stepper> = { title: 'Components/Form/Stepper', component: Stepper, tags: ['autodocs'], argTypes: { label: { control: 'text' }, defaultValue: { control: 'number' }, min: { control: 'number' }, max: { control: 'number' } } };
export default meta;
export const Default: StoryObj<typeof Stepper> = { args: { label: 'outputs', defaultValue: 1 } };
export const AtMax: StoryObj<typeof Stepper> = { args: { label: 'outputs', defaultValue: 5, max: 5 } };
