import type { Meta, StoryObj } from '@storybook/react';
import '../index.css';
import TypewriterLogo from '../components/TypewriterLogo';

const meta: Meta<typeof TypewriterLogo> = {
  title: 'Components/Brand/Typewriter Logo',
  component: TypewriterLogo,
  tags: ['autodocs'],
  argTypes: {
    fontSize: { control: { type: 'range', min: 24, max: 192, step: 8 } },
  },
};
export default meta;

export const Default: StoryObj<typeof TypewriterLogo> = {
  args: { fontSize: 96 },
};

export const Small: StoryObj<typeof TypewriterLogo> = {
  args: { fontSize: 44 },
};

export const Large: StoryObj<typeof TypewriterLogo> = {
  args: { fontSize: 144 },
};

export const SizeComparison: StoryObj<typeof TypewriterLogo> = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {([44, 72, 96, 128] as const).map((size) => (
        <div key={size} style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', width: 32, flexShrink: 0 }}>{size}px</span>
          <TypewriterLogo fontSize={size} />
        </div>
      ))}
    </div>
  ),
};
