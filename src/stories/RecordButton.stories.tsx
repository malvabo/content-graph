import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import '../index.css';
import RecordButton from '../components/canvas/RecordButton';

const meta: Meta<typeof RecordButton> = {
  title: 'Components/Actions/Record Button',
  component: RecordButton,
  tags: ['autodocs'],
  argTypes: {
    state: { control: 'select', options: ['idle', 'recording', 'disabled'] },
    size: { control: { type: 'range', min: 48, max: 192, step: 8 } },
    label: { control: 'text' },
  },
};
export default meta;

export const Idle: StoryObj<typeof RecordButton> = {
  args: { state: 'idle', size: 128, onClick: () => {} },
};

export const Recording: StoryObj<typeof RecordButton> = {
  args: { state: 'recording', size: 128, onClick: () => {} },
};

export const Disabled: StoryObj<typeof RecordButton> = {
  args: { state: 'disabled', size: 128, onClick: () => {} },
};

export const WithLabel: StoryObj<typeof RecordButton> = {
  args: { state: 'idle', size: 128, label: 'Tap to record', onClick: () => {} },
};

export const SizeComparison: StoryObj<typeof RecordButton> = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
      {([64, 96, 128] as const).map((size) => (
        <RecordButton key={size} size={size} state="idle" label={`${size}px`} onClick={() => {}} />
      ))}
    </div>
  ),
};

export const Interactive: StoryObj<typeof RecordButton> = {
  render: () => {
    const [state, setState] = useState<'idle' | 'recording' | 'disabled'>('idle');
    return (
      <RecordButton
        size={128}
        state={state}
        label={state === 'idle' ? 'Click to record' : state === 'recording' ? 'Click to stop' : 'Disabled'}
        onClick={() => setState((s) => (s === 'idle' ? 'recording' : 'idle'))}
      />
    );
  },
};
