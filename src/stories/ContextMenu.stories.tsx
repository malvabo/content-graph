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
        <button key={label} style={{ display: 'flex', width: '100%', justifyContent: 'flex-start', padding: '6px 12px', fontSize: 'var(--text-sm)', background: 'none', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)', color: isDanger(label) ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
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

/** 3-dot overflow menu as seen on workflow cards — trigger + open dropdown. */
function CardMenu() {
  return (
    <div style={{ fontFamily: 'var(--font-sans)', position: 'relative', display: 'inline-block' }}>
      {/* Trigger */}
      <div style={{ width: 24, height: 24, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-disabled)', cursor: 'pointer' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
      </div>
      {/* Dropdown */}
      <div style={{ position: 'absolute', top: 28, left: 0, zIndex: 50, background: 'var(--color-bg-popover)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', padding: 'var(--space-2)', minWidth: 150 }}>
        {[
          { label: 'Rename' },
          { label: 'Duplicate' },
          { label: 'Delete', danger: true },
        ].map(opt => (
          <button key={opt.label} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: 'var(--space-2) var(--space-3)', background: 'none', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: opt.danger ? 'var(--color-danger-text)' : 'var(--color-text-primary)' }}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export const CardOverflowMenu: StoryObj = {
  name: 'Card Overflow Menu',
  render: () => <CardMenu />,
  parameters: { layout: 'centered' },
};
