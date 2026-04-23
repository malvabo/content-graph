import type { Meta, StoryObj } from '@storybook/react';
import { useEffect } from 'react';
import '../index.css';
import DesignSystemPanel from '../components/canvas/DesignSystemPanel';

const meta: Meta<typeof DesignSystemPanel> = {
  title: 'Foundations/Design System',
  component: DesignSystemPanel,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--color-bg)' }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof DesignSystemPanel>;

export const Default: Story = {
  name: 'Light mode',
};

export const DarkMode: Story = {
  name: 'Dark mode',
  decorators: [
    (Story) => {
      useEffect(() => {
        document.documentElement.classList.add('dark');
        return () => document.documentElement.classList.remove('dark');
      }, []);
      return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--color-bg)' }}>
          <Story />
        </div>
      );
    },
  ],
};
