import type { Meta, StoryObj } from '@storybook/react';
import '../index.css';
import { HoverBorderGradient } from '../components/ui/HoverBorderGradient';

/**
 * Real HoverBorderGradient from components/ui/HoverBorderGradient.tsx.
 * Conic gradient border that rotates on hover, green accent (#0DBF5A), glow shadow.
 */

const meta: Meta<typeof HoverBorderGradient> = {
  title: 'Components/Feedback/HoverBorderGradient',
  component: HoverBorderGradient,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};
export default meta;

export const Default: StoryObj<typeof HoverBorderGradient> = {
  args: { children: 'Hover me' },
};

export const CallToAction: StoryObj<typeof HoverBorderGradient> = {
  name: 'Call to Action',
  args: { children: 'Get Started →' },
};
