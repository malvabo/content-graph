import type { Meta, StoryObj } from '@storybook/react';
import '../index.css';
import { Field, FieldGroup, FieldLabel, FieldDescription } from '../components/ui/field';

const meta: Meta<typeof FieldLabel> = {
  title: 'Components/Form/Field Label',
  component: FieldLabel,
  tags: ['autodocs'],
  argTypes: {
    children: { control: 'text' },
  },
};
export default meta;

export const Default: StoryObj<typeof FieldLabel> = {
  args: { children: 'Goal' },
};

export const WithInput: StoryObj<typeof FieldLabel> = {
  render: () => (
    <Field style={{ maxWidth: 280, fontFamily: 'var(--font-sans)' }}>
      <FieldLabel>SEO keyword</FieldLabel>
      <input className="form-input" placeholder="Enter value..." style={{ width: '100%' }} />
    </Field>
  ),
};

export const WithDescription: StoryObj<typeof FieldLabel> = {
  render: () => (
    <Field style={{ maxWidth: 280, fontFamily: 'var(--font-sans)' }}>
      <FieldLabel>Model</FieldLabel>
      <FieldDescription>Applies to all generate nodes unless overridden.</FieldDescription>
      <input className="form-input" placeholder="claude-sonnet-4" style={{ width: '100%' }} />
    </Field>
  ),
};

export const FieldGroupExample: StoryObj = {
  render: () => (
    <FieldGroup style={{ maxWidth: 320, fontFamily: 'var(--font-sans)' }}>
      <Field>
        <FieldLabel>Goal</FieldLabel>
        <input className="form-input" placeholder="Thought leadership" style={{ width: '100%' }} />
      </Field>
      <Field>
        <FieldLabel>Tone</FieldLabel>
        <FieldDescription>Affects voice across all generate nodes.</FieldDescription>
        <input className="form-input" placeholder="Authoritative" style={{ width: '100%' }} />
      </Field>
    </FieldGroup>
  ),
};
