import type { Meta, StoryObj } from '@storybook/react';
import '../index.css';
function Input({ label = 'Label', placeholder = 'Placeholder', type = 'text', disabled = false, error = false }: { label?: string; placeholder?: string; type?: 'text' | 'textarea'; disabled?: boolean; error?: boolean }) {
  const borderColor = error ? 'var(--color-danger-border)' : 'var(--color-border-default)';
  return (<div style={{ fontFamily: 'var(--font-sans)', maxWidth: 'var(--size-panel)' }}>
    <div className="text-field-label" style={{ marginBottom: 'var(--space-1)' }}>{label}</div>
    {type === 'textarea' ? (<textarea disabled={disabled} style={{ width: '100%', minHeight: 'var(--space-10)', borderRadius: 'var(--radius-md)', border: `1px solid ${borderColor}`, padding: 'var(--space-2)', fontSize: 'var(--text-sm)', outline: 'none', fontFamily: 'var(--font-sans)', resize: 'vertical' }} placeholder={placeholder} />) : (<input disabled={disabled} style={{ width: '100%', height: 'var(--size-control-md)', borderRadius: 'var(--radius-md)', border: `1px solid ${borderColor}`, padding: '0 var(--space-2)', fontSize: 'var(--text-sm)', outline: 'none', fontFamily: 'var(--font-sans)' }} placeholder={placeholder} />)}
    {error && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger-text)', marginTop: 'var(--space-1)' }}>This field is required</div>}
  </div>);
}
const meta: Meta<typeof Input> = { title: 'Components/Form/Input', component: Input, tags: ['autodocs'], argTypes: { label: { control: 'text' }, placeholder: { control: 'text' }, type: { control: 'select', options: ['text','textarea'] }, disabled: { control: 'boolean' }, error: { control: 'boolean' } } };
export default meta;
export const Default: StoryObj<typeof Input> = { args: { label: 'Field Label', placeholder: 'Enter value...' } };
export const Textarea: StoryObj<typeof Input> = { args: { label: 'Prepare (optional)', placeholder: 'e.g. Extract key arguments only.', type: 'textarea' } };
export const Disabled: StoryObj<typeof Input> = { args: { label: 'Disabled', disabled: true } };
export const ErrorState: StoryObj<typeof Input> = { args: { label: 'Required field', error: true } };
