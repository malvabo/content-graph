import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import '../index.css';
import {
  Dialog, DialogContent, DialogHeader, DialogFooter,
  DialogTitle, DialogDescription, DialogClose,
} from '../components/ui/dialog';

/* ── Helpers ── */
function Trigger({ label, children }: { label: string; children: (open: boolean, setOpen: (v: boolean) => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>{label}</button>
      {children(open, setOpen)}
    </>
  );
}

/* ── Stories ── */

function DefaultStory() {
  return (
    <Trigger label="Open modal">
      {(open, setOpen) => (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent maxWidth={480}>
            <DialogHeader>
              <DialogTitle>Delete workflow</DialogTitle>
              <DialogDescription>This action cannot be undone. The workflow and all its nodes will be permanently removed.</DialogDescription>
            </DialogHeader>
            <div style={{ height: 'var(--space-2)' }} />
            <DialogFooter>
              <DialogClose asChild>
                <button className="btn btn-outline btn-sm">Cancel</button>
              </DialogClose>
              <button className="btn btn-danger btn-sm" onClick={() => setOpen(false)}>Delete</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Trigger>
  );
}

function SheetStory() {
  return (
    <Trigger label="Open sheet">
      {(open, setOpen) => (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent sheet maxWidth={560}>
            <DialogHeader>
              <DialogTitle>Edit settings</DialogTitle>
              <DialogDescription>Configure how this node generates content.</DialogDescription>
            </DialogHeader>
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-2) var(--space-6) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {['Tone', 'Format', 'Language'].map(label => (
                <div key={label}>
                  <label style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>{label}</label>
                  <select className="form-input" style={{ width: '100%' }}>
                    <option>Default</option>
                    <option>Option A</option>
                    <option>Option B</option>
                  </select>
                </div>
              ))}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <button className="btn btn-outline btn-sm">Cancel</button>
              </DialogClose>
              <button className="btn btn-primary btn-sm" onClick={() => setOpen(false)}>Save</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Trigger>
  );
}

function FormStory() {
  return (
    <Trigger label="Open form modal">
      {(open, setOpen) => (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent maxWidth={560}>
            <DialogHeader>
              <DialogTitle>Create brand kit</DialogTitle>
              <DialogDescription>Give your brand a name and choose its primary color to get started.</DialogDescription>
            </DialogHeader>
            <div style={{ padding: 'var(--space-2) var(--space-6) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Brand name</label>
                <input className="form-input" placeholder="Acme Corp" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Primary color</label>
                <input type="color" defaultValue="#6366f1" style={{ width: 48, height: 36, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-default)', cursor: 'pointer' }} />
              </div>
              <div>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Brand voice</label>
                <textarea className="form-textarea" placeholder="Warm and authoritative. Direct, no jargon." style={{ width: '100%', minHeight: 72 }} />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <button className="btn btn-outline btn-sm">Cancel</button>
              </DialogClose>
              <button className="btn btn-primary btn-sm" onClick={() => setOpen(false)}>Create kit</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Trigger>
  );
}

function WideStory() {
  return (
    <Trigger label="Open wide modal">
      {(open, setOpen) => (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent maxWidth={900} hideClose style={{ height: 560, maxHeight: 'calc(100vh - 48px)' }}>
            <DialogHeader>
              <DialogTitle>Choose a template</DialogTitle>
            </DialogHeader>
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
              <aside style={{ width: 160, flexShrink: 0, padding: 'var(--space-3)', borderRight: '1px solid var(--color-border-subtle)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {['All', 'Repurposing', 'Research', 'Transcript'].map(f => (
                  <button key={f} style={{ textAlign: 'left', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', background: f === 'All' ? 'var(--color-bg-surface)' : 'transparent', border: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: f === 'All' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>{f}</button>
                ))}
              </aside>
              <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-3)', alignContent: 'start' }}>
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-default)', padding: 'var(--space-4)', background: 'var(--color-bg-surface)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'var(--color-bg-muted, var(--color-bg-surface))', border: '1px solid var(--color-border-subtle)' }} />
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)' }}>Template {i + 1}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>Short description of what this template does.</div>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Start from blank canvas</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Trigger>
  );
}

const meta: Meta = {
  title: 'Components/Surfaces/Modal',
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};
export default meta;

export const Default: StoryObj = {
  name: 'Confirm / Destructive',
  render: () => <DefaultStory />,
};

export const Sheet: StoryObj = {
  name: 'Sheet (mobile bottom, desktop center)',
  render: () => <SheetStory />,
};

export const Form: StoryObj = {
  name: 'Form',
  render: () => <FormStory />,
};

export const Wide: StoryObj = {
  name: 'Wide (template picker)',
  render: () => <WideStory />,
};
