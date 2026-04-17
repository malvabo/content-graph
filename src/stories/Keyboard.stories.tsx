import type { Meta, StoryObj } from '@storybook/react';
import '../index.css';
import { Keyboard } from '../components/ui/keyboard';

/**
 * Real interactive MacBook keyboard from components/ui/keyboard.tsx.
 * Full key layout with per-key sound sprites, press/release animations, and keystroke preview.
 */

const meta: Meta<typeof Keyboard> = {
  title: 'Components/Data Display/Keyboard',
  component: Keyboard,
  tags: ['autodocs'],
  argTypes: {
    enableSound: { control: 'boolean' },
    showPreview: { control: 'boolean' },
  },
  parameters: { layout: 'centered' },
};
export default meta;

export const Default: StoryObj<typeof Keyboard> = { args: { enableSound: false, showPreview: false } };
export const WithPreview: StoryObj<typeof Keyboard> = { name: 'With Keystroke Preview', args: { enableSound: false, showPreview: true } };
export const WithSound: StoryObj<typeof Keyboard> = { name: 'With Sound', args: { enableSound: true, showPreview: true } };
