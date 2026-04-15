import type { Meta, StoryObj } from '@storybook/react';
import '../index.css';
import { NODE_ICONS } from '../utils/nodeIcons';
import { NODE_DEFS, BADGE_COLORS } from '../utils/nodeDefs';
function Badge({ subtype }: { subtype: string }) {
  const def = NODE_DEFS.find((d) => d.subtype === subtype) ?? NODE_DEFS[0];
  const c = BADGE_COLORS[def.category];
  return (<div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontFamily: 'var(--font-sans)' }}>
    <div style={{ width: 'var(--size-badge)', height: 'var(--size-badge)', borderRadius: 'var(--radius-md)', background: c.bg, color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{NODE_ICONS[def.subtype]?.() ?? def.badge}</div>
    <div><div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)' }}>{def.label}</div><div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{def.category}</div></div>
  </div>);
}
const meta: Meta<typeof Badge> = { title: 'Components/Feedback/Badge', component: Badge, tags: ['autodocs'], argTypes: { subtype: { control: 'select', options: NODE_DEFS.map((d) => d.subtype) } } };
export default meta;
export const Source: StoryObj<typeof Badge> = { args: { subtype: 'text-source' } };
export const Generate: StoryObj<typeof Badge> = { args: { subtype: 'linkedin-post' } };
export const Output: StoryObj<typeof Badge> = { args: { subtype: 'export' } };
export const Transform: StoryObj<typeof Badge> = { args: { subtype: 'refine' } };
export const ImagePrompt: StoryObj<typeof Badge> = { args: { subtype: 'image-prompt' } };
