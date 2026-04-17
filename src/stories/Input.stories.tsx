import type { Meta, StoryObj } from '@storybook/react';
import '../index.css';
import { FormInput, FormTextarea } from '../components/ui/FormField';

function InputDemo({ label, placeholder, type, disabled, error }: { label?: string; placeholder?: string; type?: 'text' | 'textarea'; disabled?: boolean; error?: boolean }) {
  const errMsg = error ? 'This field is required' : undefined;
  return (
    <div style={{ maxWidth: 'var(--size-panel)' }}>
      {type === 'textarea'
        ? <FormTextarea label={label} placeholder={placeholder} disabled={disabled} error={errMsg} style={{ minHeight: 'var(--space-10)' }} />
        : <FormInput label={label} placeholder={placeholder} disabled={disabled} error={errMsg} />
      }
    </div>
  );
}

const meta: Meta<typeof InputDemo> = { title: 'Components/Form/Input', component: InputDemo, tags: ['autodocs'], argTypes: { label: { control: 'text' }, placeholder: { control: 'text' }, type: { control: 'select', options: ['text','textarea'] }, disabled: { control: 'boolean' }, error: { control: 'boolean' } } };
export default meta;
export const Default: StoryObj<typeof InputDemo> = { args: { label: 'Field Label', placeholder: 'Enter value...' } };
export const Textarea: StoryObj<typeof InputDemo> = { args: { label: 'Prepare (optional)', placeholder: 'e.g. Extract key arguments only.', type: 'textarea' } };
export const Disabled: StoryObj<typeof InputDemo> = { args: { label: 'Disabled', disabled: true } };
export const ErrorState: StoryObj<typeof InputDemo> = { args: { label: 'Required field', error: true } };
