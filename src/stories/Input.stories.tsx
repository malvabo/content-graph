import type { Meta, StoryObj } from '@storybook/react';
import '../index.css';

function Input({ label = 'Label', placeholder = 'Placeholder', type = 'text', disabled = false, error = false }: { label?: string; placeholder?: string; type?: 'text' | 'textarea'; disabled?: boolean; error?: boolean }) {
  const cls = error ? (type === 'textarea' ? 'form-textarea form-error' : 'form-input form-error') : (type === 'textarea' ? 'form-textarea' : 'form-input');
  return (
    <div style={{ fontFamily: 'var(--font-sans)', maxWidth: 'var(--size-panel)' }}>
      <div className="text-field-label" style={{ marginBottom: 'var(--space-1)' }}>{label}</div>
      {type === 'textarea'
        ? <textarea disabled={disabled} className={cls} style={{ minHeight: 'var(--space-10)' }} placeholder={placeholder} />
        : <input disabled={disabled} className={cls} placeholder={placeholder} />
      }
      {error && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger-text)', marginTop: 'var(--space-1)' }}>This field is required</div>}
    </div>
  );
}

const meta: Meta<typeof Input> = { title: 'Components/Form/Input', component: Input, tags: ['autodocs'], argTypes: { label: { control: 'text' }, placeholder: { control: 'text' }, type: { control: 'select', options: ['text','textarea'] }, disabled: { control: 'boolean' }, error: { control: 'boolean' } } };
export default meta;
export const Default: StoryObj<typeof Input> = { args: { label: 'Field Label', placeholder: 'Enter value...' } };
export const Textarea: StoryObj<typeof Input> = { args: { label: 'Prepare (optional)', placeholder: 'e.g. Extract key arguments only.', type: 'textarea' } };
export const Disabled: StoryObj<typeof Input> = { args: { label: 'Disabled', disabled: true } };
export const ErrorState: StoryObj<typeof Input> = { args: { label: 'Required field', error: true } };
