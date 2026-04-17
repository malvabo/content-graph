import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import '../index.css';

/**
 * Mirrors CanvasToolbar from components/canvas/CanvasToolbar.tsx.
 * Back button, inline graph name, action buttons (Auto-layout, Clear with confirm, Run All, Publish).
 * Decoupled from stores.
 */

function CanvasToolbar({ graphName = 'My Workflow', isRunning = false, hasNodes = true }: { graphName?: string; isRunning?: boolean; hasNodes?: boolean }) {
  const [name, setName] = useState(graphName);
  const [confirmClear, setConfirmClear] = useState(false);
  const [published, setPublished] = useState(false);

  return (
    <div style={{ position: 'relative', width: '100%', height: 64, background: 'var(--color-bg)' }}>
      {/* Top-left */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <button className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--color-bg-card)', backdropFilter: 'blur(12px)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-tertiary)', transition: 'background 150ms' }}
          aria-label="Back to library">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <input aria-label="Graph name" className="graph-name-input outline-none"
          style={{ fontWeight: 500, fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-fixed)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', letterSpacing: '-.01em', background: 'none', border: 'none', borderBottom: '1px solid transparent', borderRadius: 0, padding: '2px 0' }}
          value={name} placeholder="Untitled" onChange={(e) => setName(e.target.value)} />
      </div>

      {/* Top-right */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        <button className="btn-ghost btn-sm" style={{ borderRadius: 'var(--radius-md)' }}>Auto-layout</button>
        {confirmClear ? (
          <>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger-text)', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>Clear all?</span>
            <button className="btn-ghost btn-sm" style={{ borderRadius: 'var(--radius-md)', color: 'var(--color-danger)' }} onClick={() => setConfirmClear(false)}>Yes</button>
            <button className="btn-ghost btn-sm" style={{ borderRadius: 'var(--radius-md)' }} onClick={() => setConfirmClear(false)}>No</button>
          </>
        ) : (
          <button className="btn-ghost btn-sm" style={{ borderRadius: 'var(--radius-md)' }} onClick={() => setConfirmClear(true)}>Clear</button>
        )}
        <button className={`btn btn-run ${isRunning ? 'loading' : ''}`} disabled={isRunning}>▶ Run All</button>
        <button className="btn btn-outline" disabled={!hasNodes} onClick={() => { setPublished(true); setTimeout(() => setPublished(false), 2000); }}>{published ? '✓ Published' : 'Publish'}</button>
      </div>
    </div>
  );
}

const meta: Meta<typeof CanvasToolbar> = {
  title: 'Components/Navigation/Canvas Toolbar',
  component: CanvasToolbar,
  tags: ['autodocs'],
  argTypes: {
    graphName: { control: 'text' },
    isRunning: { control: 'boolean' },
    hasNodes: { control: 'boolean' },
  },
};
export default meta;

export const Default: StoryObj<typeof CanvasToolbar> = { args: { graphName: 'My Workflow', hasNodes: true } };
export const Running: StoryObj<typeof CanvasToolbar> = { args: { graphName: 'Content Pipeline', isRunning: true, hasNodes: true } };
export const Empty: StoryObj<typeof CanvasToolbar> = { name: 'Empty Canvas', args: { graphName: '', hasNodes: false } };
