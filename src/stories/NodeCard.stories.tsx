import type { Meta, StoryObj } from '@storybook/react';
import '../index.css';
import { NODE_ICONS } from '../utils/nodeIcons';
import { NODE_DEFS, BADGE_COLORS } from '../utils/nodeDefs';
import type { NodeCategory } from '../store/graphStore';

const STATUS_DOT: Record<string, string> = {
  idle: 'var(--p-status-idle)',
  running: 'var(--p-status-running)',
  complete: 'var(--p-status-complete)',
  error: 'var(--p-status-error)',
};

const STATUS_PILL: Record<string, { bg: string; color: string; border: string }> = {
  idle:     { bg: 'var(--color-bg-surface)', color: 'var(--color-text-disabled)', border: 'transparent' },
  running:  { bg: 'var(--color-warning-bg)', color: 'var(--color-text-secondary)', border: 'var(--color-warning-border)' },
  complete: { bg: 'var(--color-success-bg)', color: 'var(--color-success-text)', border: 'var(--color-success-border)' },
  error:    { bg: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', border: 'var(--color-danger-border)' },
};

function NodeCard({
  subtype = 'text-source',
  status = 'idle',
  selected = false,
  content = 'source',
}: {
  subtype?: string;
  status?: string;
  selected?: boolean;
  content?: 'source' | 'generate' | 'output';
}) {
  const def = NODE_DEFS.find((d) => d.subtype === subtype) ?? NODE_DEFS[0];
  const colors = BADGE_COLORS[def.category as NodeCategory];
  const pill = STATUS_PILL[status] ?? STATUS_PILL.idle;

  return (
    <div style={{
      width: 'var(--size-node)',
      maxWidth: 'var(--size-node)',
      overflow: 'hidden',
      background: 'var(--color-bg-card)',
      border: `${selected ? '2px' : '1px'} solid ${selected ? 'var(--color-accent)' : 'var(--color-border-default)'}`,
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-3) var(--space-4)',
      boxShadow: selected ? 'var(--shadow-md)' : 'none',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* Header: title + badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
        <div style={{ flex: 1, minWidth: 0, font: `var(--weight-medium) var(--text-sm)/var(--leading-fixed) var(--font-sans)`, color: 'var(--color-text-primary)', letterSpacing: 'var(--tracking-tight)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {def.label}
        </div>
        <div style={{ flexShrink: 0, width: 'var(--size-badge)', height: 'var(--size-badge)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, color: colors.text }}>
          {NODE_ICONS[def.subtype]?.() ?? def.badge}
        </div>
      </div>

      {/* Status pill */}
      <div style={{ marginTop: 'var(--space-1)' }}>
        <span className="btn-pill" style={{ cursor: 'default', height: 'var(--space-5)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', background: pill.bg, color: pill.color, borderColor: pill.border }}>
          <div style={{ width: 'var(--size-status-dot)', height: 'var(--size-status-dot)', borderRadius: 'var(--radius-full)', background: STATUS_DOT[status] ?? STATUS_DOT.idle, animation: status === 'running' ? 'pulse 1.2s ease-in-out infinite' : undefined }} />
          {status}
        </span>
      </div>

      {/* Content area */}
      <div style={{ marginTop: 'var(--space-2)' }}>
        {content === 'source' && (
          <div>
            <textarea
              readOnly
              style={{
                width: '100%',
                minHeight: 'var(--space-12)',
                maxHeight: 'calc(var(--space-12) * 2.5)',
                resize: 'vertical',
                fontSize: 'var(--text-sm)',
                lineHeight: 'var(--leading-relaxed)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-2)',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
                background: 'var(--color-bg-card)',
              }}
              placeholder="Paste your article, transcript, or notes..."
            />
            <div style={{ textAlign: 'right', fontSize: 'var(--text-sm)', color: 'var(--color-text-placeholder)', marginTop: 'var(--space-1)' }}>0 / 50,000</div>
          </div>
        )}
        {content === 'generate' && (
          <div style={{ height: 'var(--size-node-content)', overflow: 'hidden' }}>
            {status === 'idle' && (
              <div style={{ display: 'flex', gap: 'var(--space-1)', marginTop: 'var(--space-1)' }}>
                <span className="btn-pill" style={{ cursor: 'default', height: 'var(--space-5)', fontSize: 'var(--text-sm)' }}>Thought leadership</span>
                <span className="btn-pill" style={{ cursor: 'default', height: 'var(--space-5)', fontSize: 'var(--text-sm)' }}>Authoritative</span>
              </div>
            )}
            {status === 'running' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', marginTop: 'var(--space-2)' }}>
                {[100, 85, 95, 70, 90].map((w, i) => (
                  <div key={i} className="skeleton-bar" style={{ height: 'var(--space-2)', borderRadius: 'var(--radius-sm)', width: `${w}%`, animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            )}
            {status === 'complete' && (
              <div>
                <div style={{ maxHeight: 'calc(var(--space-10) * 2)', overflow: 'auto', font: `var(--weight-normal) var(--text-sm)/var(--leading-normal) var(--font-sans)`, color: 'var(--color-text-primary)', scrollbarWidth: 'thin', marginTop: 'var(--space-2)' }}>
                  This is what nobody talks about. After diving deep into this topic, here are the 3 things that stood out...
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-1)', marginTop: 'var(--space-2)' }}>
                  <button className="btn-micro" onMouseDown={(e) => e.stopPropagation()}>Copy</button>
                  <button className="btn-micro" onMouseDown={(e) => e.stopPropagation()}>Read more</button>
                </div>
              </div>
            )}
            {status === 'error' && (
              <div style={{ font: `var(--weight-normal) var(--text-sm)/var(--leading-snug) var(--font-sans)`, color: 'var(--color-danger-text)', marginTop: 'var(--space-2)' }}>
                Unknown error occurred
              </div>
            )}
          </div>
        )}
        {content === 'output' && (
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-placeholder)' }}>Connect nodes to export</div>
        )}
      </div>
    </div>
  );
}

const meta: Meta<typeof NodeCard> = {
  title: 'Components/Surfaces/Node Card',
  component: NodeCard,
  tags: ['autodocs'],
  argTypes: {
    subtype: { control: 'select', options: NODE_DEFS.map((d) => d.subtype) },
    status: { control: 'select', options: ['idle', 'running', 'complete', 'error'] },
    selected: { control: 'boolean' },
    content: { control: 'select', options: ['source', 'generate', 'output'] },
  },
};
export default meta;

export const TextSource: StoryObj<typeof NodeCard> = {
  args: { subtype: 'text-source', status: 'idle', content: 'source' },
};
export const TextSourceSelected: StoryObj<typeof NodeCard> = {
  name: 'Text Source (Selected)',
  args: { subtype: 'text-source', status: 'idle', content: 'source', selected: true },
};
export const GenerateIdle: StoryObj<typeof NodeCard> = {
  name: 'Generate (Idle)',
  args: { subtype: 'linkedin-post', status: 'idle', content: 'generate' },
};
export const GenerateRunning: StoryObj<typeof NodeCard> = {
  name: 'Generate (Running)',
  args: { subtype: 'linkedin-post', status: 'running', content: 'generate' },
};
export const GenerateComplete: StoryObj<typeof NodeCard> = {
  name: 'Generate (Complete)',
  args: { subtype: 'linkedin-post', status: 'complete', content: 'generate' },
};
export const GenerateError: StoryObj<typeof NodeCard> = {
  name: 'Generate (Error)',
  args: { subtype: 'newsletter', status: 'error', content: 'generate' },
};
export const ExportNode: StoryObj<typeof NodeCard> = {
  name: 'Export',
  args: { subtype: 'export', status: 'idle', content: 'output' },
};
export const RefineNode: StoryObj<typeof NodeCard> = {
  name: 'Refine',
  args: { subtype: 'refine', status: 'idle', content: 'source' },
};
