import type { Meta, StoryObj } from '@storybook/react';
import '../index.css';
function FAB({ open = false }: { open?: boolean }) {
  return (<div style={{ width: 'var(--size-fab)', height: 'var(--size-fab)', borderRadius: 'var(--radius-xl)', background: 'var(--color-overlay-light)', backdropFilter: 'blur(12px)', border: '1px solid var(--color-border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', boxShadow: 'var(--shadow-sm)', cursor: 'pointer' }}><span style={{ transform: open ? 'rotate(45deg)' : 'none', transition: `transform var(--duration-medium)`, display: 'block' }}>+</span></div>);
}
const meta: Meta<typeof FAB> = { title: 'Components/Actions/FAB', component: FAB, tags: ['autodocs'], argTypes: { open: { control: 'boolean' } } };
export default meta;
export const Default: StoryObj<typeof FAB> = { args: { open: false } };
export const Open: StoryObj<typeof FAB> = { args: { open: true } };
