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
          { label: 'Rename', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg> },
          { label: 'Duplicate', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> },
          { label: 'Delete', danger: true, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg> },
        ].map(opt => (
          <button key={opt.label} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: 'none', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: opt.danger ? 'var(--color-danger-text)' : 'var(--color-text-primary)', textAlign: 'left' }}>
            <span style={{ color: opt.danger ? 'var(--color-danger-text)' : 'var(--color-text-tertiary)', display: 'flex' }}>{opt.icon}</span>
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
