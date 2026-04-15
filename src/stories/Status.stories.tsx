import type { Meta, StoryObj } from '@storybook/react';
import '../index.css';
const STATUS_MAP: Record<string, { dot: string; bg: string; color: string; border: string }> = {
  idle: { dot: 'var(--p-status-idle)', bg: 'var(--color-bg-surface)', color: 'var(--color-text-disabled)', border: 'transparent' },
  running: { dot: 'var(--p-status-running)', bg: 'var(--color-warning-bg)', color: 'var(--color-text-secondary)', border: 'var(--color-warning-border)' },
  complete: { dot: 'var(--p-status-complete)', bg: 'var(--color-success-bg)', color: 'var(--color-success-text)', border: 'var(--color-success-border)' },
  error: { dot: 'var(--p-status-error)', bg: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', border: 'var(--color-danger-border)' },
};
function StatusPill({ status = 'idle' }: { status?: string }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.idle;
  return (<span className="btn-pill" style={{ cursor: 'default', height: 'var(--space-5)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', background: s.bg, color: s.color, borderColor: s.border }}>
    <div style={{ width: 'var(--size-status-dot)', height: 'var(--size-status-dot)', borderRadius: 'var(--radius-full)', background: s.dot, animation: status === 'running' ? 'pulse 1.2s ease-in-out infinite' : undefined }} />{status}
  </span>);
}
const meta: Meta<typeof StatusPill> = { title: 'Components/Feedback/Status', component: StatusPill, tags: ['autodocs'], argTypes: { status: { control: 'select', options: ['idle','running','complete','error'] } } };
export default meta;
export const Idle: StoryObj<typeof StatusPill> = { args: { status: 'idle' } };
export const Running: StoryObj<typeof StatusPill> = { args: { status: 'running' } };
export const Complete: StoryObj<typeof StatusPill> = { args: { status: 'complete' } };
export const ErrorState: StoryObj<typeof StatusPill> = { args: { status: 'error' } };
