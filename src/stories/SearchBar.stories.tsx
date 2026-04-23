import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import '../index.css';
import SearchBar from '../components/ui/SearchBar';

const meta: Meta<typeof SearchBar> = {
  title: 'Components/Inputs/Search Bar',
  component: SearchBar,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
  },
};
export default meta;

type Story = StoryObj<typeof SearchBar>;

export const Default: Story = {
  args: { placeholder: 'Search...' },
};

export const WithValue: Story = {
  name: 'With value',
  render: (args) => {
    const [value, setValue] = useState('workflow');
    return <SearchBar {...args} value={value} onChange={e => setValue((e.target as HTMLInputElement).value)} />;
  },
};

export const Disabled: Story = {
  args: { placeholder: 'Search...', disabled: true },
};

export const Controlled: Story = {
  name: 'Controlled (live results)',
  render: () => {
    const items = ['Workflows', 'Voice recording', 'Script sense', 'Cards', 'Infographics', 'Settings'];
    const [query, setQuery] = useState('');
    const filtered = items.filter(i => i.toLowerCase().includes(query.toLowerCase()));
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 320 }}>
        <SearchBar placeholder="Search views…" onValueChange={setQuery} />
        <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 14px', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)' }}>No results</div>
          ) : filtered.map(item => (
            <div key={item} style={{ padding: '8px 14px', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border-subtle)', cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--color-bg-surface)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
            >{item}</div>
          ))}
        </div>
      </div>
    );
  },
};
