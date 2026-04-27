import type { Meta, StoryObj } from '@storybook/react';
import '../index.css';
import GraphSchematic from '../components/ui/GraphSchematic';

const SOURCE = { id: 's1', position: { x: 0, y: 0 }, data: { category: 'source', label: 'Text Source' } };
const LINKEDIN = { id: 'g1', position: { x: 1, y: 0 }, data: { category: 'generate', label: 'LinkedIn Post' } };
const THREAD = { id: 'g2', position: { x: 2, y: 0 }, data: { category: 'generate', label: 'X Thread' } };
const NEWSLETTER = { id: 'g3', position: { x: 3, y: 0 }, data: { category: 'generate', label: 'Newsletter' } };
const REFINE = { id: 't1', position: { x: 1.5, y: 0 }, data: { category: 'transform', label: 'Refine' } };
const EXPORT = { id: 'o1', position: { x: 4, y: 0 }, data: { category: 'output', label: 'Export' } };

const meta: Meta<typeof GraphSchematic> = {
  title: 'Components/Surfaces/Graph Schematic',
  component: GraphSchematic,
  tags: ['autodocs'],
  argTypes: {
    maxVisible: { control: { type: 'range', min: 1, max: 6 } },
    height: { control: { type: 'range', min: 80, max: 200 } },
    showBorder: { control: 'boolean' },
  },
};
export default meta;

export const TwoNode: StoryObj<typeof GraphSchematic> = {
  name: 'Source → Generate',
  args: { nodes: [SOURCE, LINKEDIN] },
};

export const ThreeNode: StoryObj<typeof GraphSchematic> = {
  name: 'Source → Transform → Generate',
  args: { nodes: [SOURCE, REFINE, LINKEDIN] },
};

export const WithOverflow: StoryObj<typeof GraphSchematic> = {
  name: 'Overflow (+N badge)',
  args: { nodes: [SOURCE, LINKEDIN, THREAD, NEWSLETTER, EXPORT], maxVisible: 3 },
};

export const FullChain: StoryObj<typeof GraphSchematic> = {
  name: 'Full Chain',
  args: { nodes: [SOURCE, LINKEDIN, THREAD, NEWSLETTER, EXPORT], maxVisible: 5 },
};

export const NoBorder: StoryObj<typeof GraphSchematic> = {
  args: { nodes: [SOURCE, LINKEDIN, THREAD], showBorder: false },
};
