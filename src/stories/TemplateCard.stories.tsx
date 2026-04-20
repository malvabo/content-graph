import type { Meta, StoryObj } from '@storybook/react';
import TemplateCard from '../components/ui/TemplateCard';

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
