import type { Meta, StoryObj } from '@storybook/react';
import '../index.css';

/**
 * Mirrors the real ContextMenu from components/canvas/ContextMenu.tsx.
 * Right-click menu for node actions: Duplicate, Delete (danger), Disconnect all, Copy output.
 */
function ContextMenu({ items = ['Duplicate', 'Delete', 'Disconnect all'], withOutput = false }: { items?: string[]; withOutput?: boolean }) {
  const all = withOutput ? [...items, 'Copy output'] : items;
  const isDanger = (label: string) => label.toLowerCase().includes('delete');
  return (
    <div className="ctx-menu-fade bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] rounded-lg shadow-lg py-1 min-w-[160px]" style={{ fontFamily: 'var(--font-sans)' }}>
      {all.map((label) => (
        <button key={label} className={`w-full text-left px-3 py-1.5 text-sm transition ${isDanger(label) ? 'text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]' : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

const meta: Meta<typeof ContextMenu> = {
  title: 'Components/Surfaces/Context Menu',
  component: ContextMenu,
  tags: ['autodocs'],
  argTypes: { withOutput: { control: 'boolean' } },
  parameters: { layout: 'centered' },
};
export default meta;

export const Default: StoryObj<typeof ContextMenu> = { args: {} };
export const WithCopyOutput: StoryObj<typeof ContextMenu> = { name: 'With Copy Output', args: { withOutput: true } };
