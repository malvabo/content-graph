import type { Meta, StoryObj } from '@storybook/react';
import '../index.css';
function FloatingPanel({ width = 280, withContent = false }: { width?: number; withContent?: boolean }) {
  return (<div style={{ width, background: 'var(--color-bg-popover)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', padding: 'var(--space-5)', fontFamily: 'var(--font-sans)' }}>
    <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)' }}>Panel Title</div>
    {withContent && (<>
      <div className="text-field-label">Goal</div>
      <div style={{ height: 'var(--size-control-md)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-default)', background: 'var(--color-bg-card)', display: 'flex', alignItems: 'center', padding: '0 var(--space-2)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>Thought leadership</div>
      <div className="text-field-label">Tone</div>
      <div style={{ height: 'var(--size-control-md)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-default)', background: 'var(--color-bg-card)', display: 'flex', alignItems: 'center', padding: '0 var(--space-2)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>Authoritative</div>
    </>)}
    <button className="btn btn-primary" style={{ width: '100%' }}>Action</button>
  </div>);
}
const meta: Meta<typeof FloatingPanel> = { title: 'Components/Surfaces/Floating Panel', component: FloatingPanel, tags: ['autodocs'], argTypes: { width: { control: { type: 'range', min: 200, max: 400 } }, withContent: { control: 'boolean' } } };
export default meta;
export const Default: StoryObj<typeof FloatingPanel> = { args: { width: 280 } };
export const WithContent: StoryObj<typeof FloatingPanel> = { args: { width: 280, withContent: true } };
export const Wide: StoryObj<typeof FloatingPanel> = { args: { width: 360, withContent: true } };
