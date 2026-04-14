import { useState } from 'react';
import { NODE_DEFS, CATEGORY_LABELS, BADGE_COLORS, type NodeDef } from '../../utils/nodeDefs';
import { NODE_ICONS } from '../../utils/nodeIcons';
import type { NodeCategory } from '../../store/graphStore';

const PALETTE_ORDER: NodeCategory[] = ['source', 'generate', 'output', 'transform'];

function PaletteItem({ def }: { def: NodeDef }) {
  const colors = BADGE_COLORS[def.category];
  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/content-graph-node', JSON.stringify(def));
    e.dataTransfer.effectAllowed = 'move';
  };
  return (
    <div draggable onDragStart={onDragStart}
      className="flex items-center gap-3 px-3 py-3 rounded-xl cursor-grab active:cursor-grabbing"
      style={{ transition: 'background 100ms' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cg-surface)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
      <div className="w-[34px] h-[34px] rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: colors.bg, color: colors.text }}>
        {NODE_ICONS[def.subtype]?.() ?? def.badge}
      </div>
      <div className="min-w-0">
        <div style={{ font: '500 14px/18px var(--font-sans)', color: 'var(--cg-ink)', letterSpacing: '-.005em' }} className="truncate">{def.label}</div>
        <div style={{ font: '400 12px/16px var(--font-sans)', color: 'var(--cg-ink-3)', marginTop: 1 }} className="truncate">{def.description}</div>
      </div>
    </div>
  );
}

export default function NodePalette() {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  return (
    <aside className="w-[260px] shrink-0 overflow-y-auto" style={{ background: 'var(--cg-card)', borderRight: '1px solid var(--cg-border)' }}>
      <div className="px-4 pt-5 pb-3">
        <div style={{ font: '500 14px/1 var(--font-sans)', color: 'var(--cg-ink)' }}>Nodes</div>
      </div>
      {PALETTE_ORDER.map((cat) => {
        const nodes = NODE_DEFS.filter((n) => n.category === cat);
        if (!nodes.length) return null;
        const isAdvanced = cat === 'transform';
        return (
          <div key={cat} className="px-2 mb-4">
            {isAdvanced ? (
              <button className="flex items-center gap-1.5 px-3 mb-2" style={{ font: '500 12px/1 var(--font-sans)', color: 'var(--cg-ink-3)' }} onClick={() => setAdvancedOpen(!advancedOpen)}>
                <span style={{ fontSize: 10 }}>{advancedOpen ? '▼' : '▶'}</span>
                {CATEGORY_LABELS[cat]}
              </button>
            ) : (
              <div className="px-3 mb-2" style={{ font: '500 12px/1 var(--font-sans)', color: 'var(--cg-ink-3)' }}>{CATEGORY_LABELS[cat]}</div>
            )}
            {(!isAdvanced || advancedOpen) && (
              <div className="flex flex-col gap-0.5">{nodes.map((def) => <PaletteItem key={def.subtype} def={def} />)}</div>
            )}
          </div>
        );
      })}
    </aside>
  );
}
