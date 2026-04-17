import type { Meta, StoryObj } from '@storybook/react';
import '../index.css';
import { FormInput, FormTextarea } from '../components/ui/FormField';

/**
 * Real FormInput and FormTextarea from components/ui/FormField.tsx.
 * Uses .form-input, .form-textarea, .text-field-label, .form-error CSS classes.
 */

const inputMeta: Meta<typeof FormInput> = {
  title: 'Components/Forms/FormField',
  component: FormInput,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};
export default inputMeta;

export const Input: StoryObj<typeof FormInput> = {
  args: { label: 'Email', placeholder: 'you@example.com' },
  decorators: [(Story) => <div style={{ width: 320 }}><Story /></div>],
};

export const InputWithError: StoryObj<typeof FormInput> = {
  name: 'Input with Error',
  args: { label: 'API Key', placeholder: 'sk-ant-...', error: 'Invalid key format' },
  decorators: [(Story) => <div style={{ width: 320 }}><Story /></div>],
};

export const Textarea: StoryObj = {
  render: () => (
    <div style={{ width: 320 }}>
      <FormTextarea label="Content" placeholder="Paste your article, transcript, or notes..." rows={4} />
    </div>
  ),
};

export const TextareaWithError: StoryObj = {
  name: 'Textarea with Error',
  render: () => (
    <div style={{ width: 320 }}>
      <FormTextarea label="Prompt" placeholder="Describe what to generate..." rows={3} error="Prompt is required" />
    </div>
  ),
};
