import type { Meta, StoryObj } from '@storybook/react';
import '../index.css';
import SearchPalette, { type PaletteEntry } from '../components/ui/SearchPalette';

// ── Sample entries matching the canvas node-palette style ──────────────────

const TextIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>
  </svg>
);
const FileIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
    <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
  </svg>
);
const ImageIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
  </svg>
);
const MicIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>
  </svg>
);
const LinkedInIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
    <rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>
  </svg>
);
const ThreadIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h16M4 12h16M4 18h10"/>
  </svg>
);

const SAMPLE_ENTRIES: PaletteEntry[] = [
  {
    id: 'text-source',
    icon: <TextIcon />,
    iconBg: 'var(--color-badge-source-bg)',
    iconColor: 'var(--color-badge-source-text)',
    label: 'Text',
    description: 'Paste text, transcript, notes',
    onSelect: () => alert('Text selected'),
  },
  {
    id: 'file-source',
    icon: <FileIcon />,
    iconBg: 'var(--color-badge-source-bg)',
    iconColor: 'var(--color-badge-source-text)',
    label: 'File',
    description: 'Upload .txt .md .docx',
    onSelect: () => alert('File selected'),
  },
  {
    id: 'image-source',
    icon: <ImageIcon />,
    iconBg: 'var(--color-badge-source-bg)',
    iconColor: 'var(--color-badge-source-text)',
    label: 'Image',
    description: 'Product photo, diagram',
    onSelect: () => alert('Image selected'),
  },
  {
    id: 'voice-source',
    icon: <MicIcon />,
    iconBg: 'var(--color-badge-source-bg)',
    iconColor: 'var(--color-badge-source-text)',
    label: 'Voice Note',
    description: 'Select a saved voice note',
    onSelect: () => alert('Voice Note selected'),
  },
  {
    id: 'linkedin-post',
    icon: <LinkedInIcon />,
    iconBg: 'var(--color-badge-generate-bg)',
    iconColor: 'var(--color-badge-generate-text)',
    label: 'LinkedIn Post',
    description: '150–300 word hook post',
    onSelect: () => alert('LinkedIn Post selected'),
  },
  {
    id: 'twitter-thread',
    icon: <ThreadIcon />,
    iconBg: 'var(--color-badge-generate-bg)',
    iconColor: 'var(--color-badge-generate-text)',
    label: 'Twitter Thread',
    description: '5–10 tweet thread',
    onSelect: () => alert('Twitter Thread selected'),
  },
];

const meta: Meta<typeof SearchPalette> = {
  title: 'Components/Search/SearchPalette',
  component: SearchPalette,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'light' },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 280, padding: '48px 0', fontFamily: 'var(--font-sans)' }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    placeholder: { control: 'text' },
    emptyMessage: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof SearchPalette>;

export const Default: Story = {
  args: {
    entries: SAMPLE_ENTRIES,
    placeholder: 'Search nodes…',
    emptyMessage: 'No nodes found',
  },
};

export const PrefilledQuery: Story = {
  name: 'With results (type "li" to see)',
  args: {
    entries: SAMPLE_ENTRIES,
    placeholder: 'Search nodes…',
    emptyMessage: 'No nodes found',
  },
};

export const NoResults: Story = {
  name: 'Empty state',
  args: {
    entries: [],
    placeholder: 'Search nodes…',
    emptyMessage: 'No nodes found',
  },
};

export const NoBadgeColor: Story = {
  name: 'Entries without iconBg (fallback)',
  args: {
    entries: SAMPLE_ENTRIES.map(e => ({ ...e, iconBg: undefined, iconColor: undefined })),
    placeholder: 'Search…',
    emptyMessage: 'Nothing found',
  },
};
