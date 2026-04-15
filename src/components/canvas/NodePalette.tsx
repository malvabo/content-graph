import { useState, useRef, useEffect } from 'react';
import { NODE_DEFS, CATEGORY_LABELS, BADGE_COLORS, type NodeDef } from '../../utils/nodeDefs';
import { NODE_ICONS } from '../../utils/nodeIcons';
import type { NodeCategory } from '../../store/graphStore';

const PALETTE_ORDER: NodeCategory[] = ['source', 'generate', 'output', 'transform'];

function PaletteItem({ def, onClick }: { def: NodeDef; onClick: () => void }) {
  const colors = BADGE_COLORS[def.category];
  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/content-graph-node', JSON.stringify(def));
    e.dataTransfer.effectAllowed = 'move';
  };
  return (
    <div draggable onDragStart={onDragStart} onClick={onClick}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-grab active:cursor-grabbing"
      style={{ transition: 'background 100ms' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
      <div className="w-[30px] h-[30px] rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: colors.bg, color: colors.text }}>
        {NODE_ICONS[def.subtype]?.() ?? def.badge}
      </div>
      <div className="min-w-0">
        <div style={{ font: '500 14px/18px var(--font-sans)', color: 'var(--color-text-primary)' }} className="truncate">{def.label}</div>
        <div style={{ font: '400 12px/16px var(--font-sans)', color: 'var(--color-text-tertiary)', marginTop: 1 }} className="truncate">{def.description}</div>
      </div>
    </div>
  );
}

interface Props { onAddNode: (def: NodeDef) => void }

export default function NodePalette({ onAddNode }: Props) {
  const [open, setOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="absolute bottom-4 left-4 z-20">
      {/* Floating + button — iOS fluid style */}
      <button onClick={() => setOpen(!open)}
        aria-label="Add node"
        aria-expanded={open}
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{
          background: 'rgba(255,255,255,0.65)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          color: 'var(--color-text-secondary)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(255,255,255,0.5)',
          border: '1px solid rgba(0,0,0,0.06)',
          transition: 'transform 200ms ease, box-shadow 200ms ease, background 200ms ease, border-color 200ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.85)';
          e.currentTarget.style.boxShadow = '0 6px 28px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(255,255,255,0.7)';
          e.currentTarget.style.transform = 'scale(1.06)';
          e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.65)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(255,255,255,0.5)';
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)';
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#plus-grad)" strokeWidth="2" strokeLinecap="round" style={{ transform: open ? 'rotate(45deg)' : 'none', transition: 'transform 200ms ease' }}>
          <defs><linearGradient id="plus-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse"><stop stopColor="var(--color-text-tertiary)" /><stop offset="1" stopColor="var(--color-text-disabled)" /></linearGradient></defs>
          <path d="M12 5v14"/><path d="M5 12h14"/>
        </svg>
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute bottom-14 left-0 w-[280px] max-h-[420px] overflow-y-auto"
          style={{ background: 'var(--color-bg-popover)', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.08)', border: '1px solid var(--color-border-subtle)', scrollbarWidth: 'thin' }}>
          <div className="px-5 pt-4 pb-2">
            <div style={{ font: '600 15px/1 var(--font-sans)', color: 'var(--color-text-primary)' }}>Add node</div>
          </div>
          {PALETTE_ORDER.map((cat, catIdx) => {
            const nodes = NODE_DEFS.filter((n) => n.category === cat);
            if (!nodes.length) return null;
            const isAdvanced = cat === 'transform';
            return (
              <div key={cat} className="px-2 mb-3">
                {catIdx > 0 && <div style={{ height: 1, background: 'var(--color-border-subtle)', margin: '4px 12px 10px' }} />}
                {isAdvanced ? (
                  <button className="flex items-center gap-1.5 px-3 mb-1.5" style={{ font: '600 11px/1 var(--font-sans)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }} onClick={() => setAdvancedOpen(!advancedOpen)}>
                    <span style={{ fontSize: 10 }}>{advancedOpen ? '▼' : '▶'}</span>
                    {CATEGORY_LABELS[cat]}
                  </button>
                ) : (
                  <div className="px-3 mb-1.5" style={{ font: '600 11px/1 var(--font-sans)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{CATEGORY_LABELS[cat]}</div>
                )}
                {(!isAdvanced || advancedOpen) && (
                  <div className="flex flex-col gap-0.5">{nodes.map((def) => (
                    <PaletteItem key={def.subtype} def={def} onClick={() => { onAddNode(def); setOpen(false); }} />
                  ))}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
