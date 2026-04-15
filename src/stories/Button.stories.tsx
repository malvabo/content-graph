import type { Meta, StoryObj } from '@storybook/react';
import '../index.css';
function Button({ variant = 'btn-primary', size = 'btn', label = 'Button', disabled = false, loading = false }: { variant?: string; size?: string; label?: string; disabled?: boolean; loading?: boolean }) {
  return <button className={`${size} ${variant} ${loading ? 'loading' : ''}`} disabled={disabled}>{label}</button>;
}
const meta: Meta<typeof Button> = { title: 'Components/Actions/Button', component: Button, tags: ['autodocs'], argTypes: { variant: { control: 'select', options: ['btn-primary','btn-outline','btn-ghost','btn-tonal','btn-destructive','btn-run','btn-micro','btn-link'] }, size: { control: 'select', options: ['btn-xs','btn-sm','btn','btn-lg'] }, label: { control: 'text' }, disabled: { control: 'boolean' }, loading: { control: 'boolean' } } };
export default meta;
export const Default: StoryObj<typeof Button> = { args: { variant: 'btn-primary', label: 'Button' } };
export const Outline: StoryObj<typeof Button> = { args: { variant: 'btn-outline', label: 'Outline' } };
export const Ghost: StoryObj<typeof Button> = { args: { variant: 'btn-ghost', label: 'Ghost' } };
export const Tonal: StoryObj<typeof Button> = { args: { variant: 'btn-tonal', label: 'Tonal' } };
export const Destructive: StoryObj<typeof Button> = { args: { variant: 'btn-destructive', label: 'Destructive' } };
export const RunButton: StoryObj<typeof Button> = { args: { variant: 'btn-run', label: 'Run All' } };
export const Micro: StoryObj<typeof Button> = { args: { variant: 'btn-micro', size: 'btn-xs', label: 'Micro' } };
export const Link: StoryObj<typeof Button> = { args: { variant: 'btn-link', label: 'Link button' } };
export const Disabled: StoryObj<typeof Button> = { args: { disabled: true, label: 'Disabled' } };
export const Loading: StoryObj<typeof Button> = { args: { loading: true, label: 'Loading' } };
export const ExtraSmall: StoryObj<typeof Button> = { args: { size: 'btn-xs', label: 'Extra Small' } };
export const Small: StoryObj<typeof Button> = { args: { size: 'btn-sm', label: 'Small' } };
export const Large: StoryObj<typeof Button> = { args: { size: 'btn-lg', label: 'Large' } };
