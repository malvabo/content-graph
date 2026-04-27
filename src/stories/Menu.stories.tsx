import type { Meta, StoryObj } from '@storybook/react';
import '../index.css';
import { Menu, MenuItem, MenuSeparator } from '../components/ui/Menu';

const meta: Meta = {
  title: 'Components/Overlays/Menu',
  tags: ['autodocs'],
};
export default meta;

export const Default: StoryObj = {
  render: () => (
    <Menu style={{ width: 220 }}>
      <MenuItem>Edit</MenuItem>
      <MenuItem>Duplicate</MenuItem>
      <MenuSeparator />
      <MenuItem danger>Delete</MenuItem>
    </Menu>
  ),
};

export const WithIcons: StoryObj = {
  render: () => (
    <Menu style={{ width: 220 }}>
      <MenuItem icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>}>Edit</MenuItem>
      <MenuItem icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}>Duplicate</MenuItem>
      <MenuItem icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>}>Copy link</MenuItem>
      <MenuSeparator />
      <MenuItem danger icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6 18 20H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>}>Delete</MenuItem>
    </Menu>
  ),
};

export const WithShortcuts: StoryObj = {
  render: () => (
    <Menu style={{ width: 220 }}>
      <MenuItem right="⌘Z">Undo</MenuItem>
      <MenuItem right="⌘⇧Z">Redo</MenuItem>
      <MenuSeparator />
      <MenuItem right="⌘C">Copy</MenuItem>
      <MenuItem right="⌘V">Paste</MenuItem>
      <MenuSeparator />
      <MenuItem right="⌫" danger>Delete</MenuItem>
    </Menu>
  ),
};

export const WithSelectedItem: StoryObj = {
  render: () => (
    <Menu style={{ width: 220 }}>
      <MenuItem>Claude Haiku 4</MenuItem>
      <MenuItem selected>Claude Sonnet 4</MenuItem>
      <MenuItem>Claude Opus 4</MenuItem>
    </Menu>
  ),
};

export const Disabled: StoryObj = {
  render: () => (
    <Menu style={{ width: 220 }}>
      <MenuItem>Edit</MenuItem>
      <MenuItem disabled>Run (no API key)</MenuItem>
      <MenuSeparator />
      <MenuItem danger>Delete</MenuItem>
    </Menu>
  ),
};
