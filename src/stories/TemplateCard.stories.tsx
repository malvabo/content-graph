import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import TemplateCard from '../components/ui/TemplateCard';

function CardWithMenu(props: React.ComponentProps<typeof TemplateCard>) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <TemplateCard {...props} />
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 2 }}>
        <div role="button" onClick={() => setMenuOpen(!menuOpen)}
          style={{ width: 24, height: 24, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', background: 'var(--color-overlay-light)', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
        </div>
        {menuOpen && (
          <div style={{ position: 'absolute', top: 28, right: 0, background: 'var(--color-bg-popover)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', padding: 'var(--space-2)', minWidth: 150 }}>
            {['Rename', 'Duplicate', 'Delete'].map(label => (
              <button key={label} style={{ width: '100%', padding: '8px 12px', background: 'none', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: label === 'Delete' ? 'var(--color-danger-text)' : 'var(--color-text-primary)', textAlign: 'left' }}>{label}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const meta: Meta<typeof TemplateCard> = {
  title: 'Components/TemplateCard',
  component: TemplateCard,
  parameters: { layout: 'centered', backgrounds: { default: 'canvas', values: [{ name: 'canvas', value: '#F2EFE9' }] } },
  decorators: [(Story) => <div style={{ width: 319 }}><Story /></div>],
};
export default meta;
type Story = StoryObj<typeof TemplateCard>;

export const ArticleEverywhere: Story = {
  args: {
    title: 'Article → Everywhere',
    meta: '8 nodes · 17 Apr',
    pills: ['Text', 'LinkedIn Post'],
    extraCount: 6,
  },
};

export const TranscriptSocial: Story = {
  args: {
    title: 'Transcript → Social Pack',
    meta: '6 nodes · 16 Apr',
    pills: ['Text', 'Thread'],
    extraCount: 4,
  },
};

export const ResearchVisual: Story = {
  args: {
    title: 'Research → Visual',
    meta: '5 nodes · 15 Apr',
    pills: ['Text', 'Infographic'],
    extraCount: 3,
  },
};

export const EmptyWorkflow: Story = {
  args: {
    title: '+ Empty Workflow',
    meta: 'Start from scratch',
    pills: [],
  },
};

export const LongTitle: Story = {
  args: {
    title: 'Very Long Template Name That Should Truncate Properly',
    meta: '12 nodes · 20 Apr',
    pills: ['Text', 'LinkedIn Post', 'Newsletter'],
    extraCount: 3,
  },
};

export const WithMenu: Story = {
  render: (args) => <CardWithMenu {...args} />,
  args: {
    title: 'Article → Everywhere',
    meta: '8 nodes · 17 Apr',
    pills: ['Text', 'LinkedIn Post'],
    extraCount: 6,
  },
};
