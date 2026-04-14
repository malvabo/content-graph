import { useState } from 'react';
import { NODE_DEFS, CATEGORY_LABELS, BADGE_COLORS, type NodeDef } from '../../utils/nodeDefs';
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
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-grab active:cursor-grabbing"
      style={{ transition: 'background 100ms' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cg-surface)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
      <div className="w-[26px] h-[26px] rounded-md flex items-center justify-center shrink-0"
        style={{ fontSize: 11, fontWeight: 500, fontFamily: 'var(--font-mono)', backgroundColor: colors.bg, color: colors.text }}>
        {def.badge}
      </div>
      <div className="min-w-0">
        <div style={{ font: '500 14px/20px var(--font-sans)', color: 'var(--cg-ink)', letterSpacing: '-.005em' }} className="truncate">{def.label}</div>
        <div style={{ font: '400 13px/18px var(--font-sans)', color: 'var(--cg-ink-2)' }} className="truncate">{def.description}</div>
      </div>
    </div>
  );
}

export default function NodePalette() {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  return (
    <aside className="w-[220px] shrink-0 overflow-y-auto" style={{ background: 'var(--cg-card)', borderRight: '1px solid var(--cg-border)' }}>
      <div className="px-3 pt-4 pb-2">
        <div className="text-eyebrow">Nodes</div>
      </div>
      {PALETTE_ORDER.map((cat) => {
        const nodes = NODE_DEFS.filter((n) => n.category === cat);
        if (!nodes.length) return null;
        const isAdvanced = cat === 'transform';
        return (
          <div key={cat} className="px-2 mb-3">
            {isAdvanced ? (
              <button className="flex items-center gap-1 px-1 mb-1.5 text-eyebrow" onClick={() => setAdvancedOpen(!advancedOpen)}>
                <span style={{ fontSize: 8 }}>{advancedOpen ? '▼' : '▶'}</span>
                {CATEGORY_LABELS[cat]}
              </button>
            ) : (
              <div className="text-eyebrow px-1 mb-1.5">{CATEGORY_LABELS[cat]}</div>
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
