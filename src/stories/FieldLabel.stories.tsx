import type { Meta, StoryObj } from '@storybook/react';
import '../index.css';

function FieldLabel({ label = 'Field label', withInput = false }: { label?: string; withInput?: boolean }) {
  return (
    <div style={{ fontFamily: 'var(--font-sans)', maxWidth: 'var(--size-panel)' }}>
      <label className="text-field-label" style={{ display: 'block', marginBottom: 'var(--space-1)' }}>{label}</label>
      {withInput && (
        <input placeholder="Enter value..." style={{ width: '100%', height: 'var(--size-control-md)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-default)', padding: '0 var(--space-3)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)' }} />
      )}
    </div>
  );
}

const meta: Meta<typeof FieldLabel> = {
  title: 'Components/Form/FieldLabel',
  component: FieldLabel,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    withInput: { control: 'boolean' },
  },
};
export default meta;

export const Default: StoryObj<typeof FieldLabel> = { args: { label: 'Goal' } };
export const WithInput: StoryObj<typeof FieldLabel> = { args: { label: 'SEO keyword', withInput: true } };
export const Comparison: StoryObj<typeof FieldLabel> = {
  render: () => (
    <div style={{ fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-disabled)', marginBottom: 8 }}>OLD — uppercase label (.text-label)</div>
        <label className="text-label" style={{ display: 'block', marginBottom: 'var(--space-1)' }}>Goal</label>
        <input placeholder="Thought leadership" style={{ width: 280, height: 'var(--size-control-md)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-default)', padding: '0 var(--space-3)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)' }} />
      </div>
      <div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-disabled)', marginBottom: 8 }}>NEW — sentence case label (.text-field-label)</div>
        <label className="text-field-label" style={{ display: 'block', marginBottom: 'var(--space-1)' }}>Goal</label>
        <input placeholder="Thought leadership" style={{ width: 280, height: 'var(--size-control-md)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-default)', padding: '0 var(--space-3)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)' }} />
      </div>
    </div>
  ),
};
