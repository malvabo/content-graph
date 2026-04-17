import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import '../index.css';
import { NODE_DEFS, CATEGORY_LABELS, BADGE_COLORS, type NodeDef } from '../utils/nodeDefs';
import { NODE_ICONS } from '../utils/nodeIcons';
import type { NodeCategory } from '../store/graphStore';

/**
 * Mirrors NodePalette from components/canvas/NodePalette.tsx.
 * Shows the popover with search, category sections, PaletteItem with badge + description.
 */

const PALETTE_ORDER: NodeCategory[] = ['source', 'generate', 'output', 'transform'];

function PaletteItem({ def }: { def: NodeDef }) {
  const colors = BADGE_COLORS[def.category];
  return (
    <div className="palette-item flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer active:opacity-80">
      <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
        style={{ backgroundColor: colors.bg, color: colors.text }}>
        {NODE_ICONS[def.subtype]?.() ?? def.badge}
      </div>
      <div className="min-w-0">
        <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-fixed)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }} className="truncate">{def.label}</div>
        <div style={{ fontSize: 'var(--text-xs)', lineHeight: '16px', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', marginTop: 2 }} className="truncate">{def.description}</div>
      </div>
    </div>
  );
}

function NodePalettePopover({ search: initialSearch = '' }: { search?: string }) {
  const [search, setSearch] = useState(initialSearch);
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const q = search.toLowerCase().trim();
  const allFiltered = PALETTE_ORDER.flatMap(cat => NODE_DEFS.filter(n => n.category === cat && (!q || n.label.toLowerCase().includes(q) || n.description.toLowerCase().includes(q))));
  const hasResults = allFiltered.length > 0;

  return (
    <div className="w-[280px] max-h-[420px] flex flex-col"
      style={{ background: 'var(--color-bg-popover)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--color-border-subtle)' }}>
      <div style={{ padding: 'var(--space-3) var(--space-3) var(--space-2)' }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search nodes…" className="form-input" />
      </div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', padding: '0 var(--space-2) var(--space-3)' }}>
        {!hasResults && (
          <div style={{ padding: 'var(--space-6) var(--space-3)', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)' }}>No nodes found</div>
        )}
        {PALETTE_ORDER.map((cat, catIdx) => {
          const nodes = NODE_DEFS.filter(n => n.category === cat && (!q || n.label.toLowerCase().includes(q) || n.description.toLowerCase().includes(q)));
          if (!nodes.length) return null;
          const isAdvanced = cat === 'transform';
          return (
            <div key={cat}>
              {catIdx > 0 && hasResults && <div style={{ height: 1, background: 'var(--color-border-subtle)', margin: 'var(--space-2) var(--space-3)' }} />}
              {isAdvanced ? (
                <button className="palette-cat-btn flex items-center gap-1.5 px-3 py-1.5 mb-1 rounded-md text-left"
                  style={{ fontWeight: 500, fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}
                  onClick={() => setAdvancedOpen(!advancedOpen)}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ transform: advancedOpen ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}><path d="m9 18 6-6-6-6"/></svg>
                  {CATEGORY_LABELS[cat]}
                </button>
              ) : (
                <div className="px-3 mb-1 mt-1" style={{ fontWeight: 500, fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{CATEGORY_LABELS[cat]}</div>
              )}
              {(!isAdvanced || advancedOpen) && (
                <div className="flex flex-col gap-0.5">{nodes.map(def => <PaletteItem key={def.subtype} def={def} />)}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const meta: Meta<typeof NodePalettePopover> = {
  title: 'Components/Navigation/Node Palette',
  component: NodePalettePopover,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};
export default meta;

export const Default: StoryObj<typeof NodePalettePopover> = { args: {} };
export const Filtered: StoryObj<typeof NodePalettePopover> = { args: { search: 'linked' } };
export const NoResults: StoryObj<typeof NodePalettePopover> = { name: 'No Results', args: { search: 'zzzzz' } };
