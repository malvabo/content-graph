import { useState, useRef, useEffect } from 'react';
import { NODE_DEFS, CATEGORY_LABELS, BADGE_COLORS, type NodeDef } from '../../utils/nodeDefs';
import { NODE_ICONS } from '../../utils/nodeIcons';
import type { NodeCategory } from '../../store/graphStore';

import { motion } from 'motion/react';

const PALETTE_ORDER: NodeCategory[] = ['source', 'generate', 'output', 'transform'];

function PaletteItem({ def, onClick }: { def: NodeDef; onClick: () => void }) {
  const colors = BADGE_COLORS[def.category];
  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/content-graph-node', JSON.stringify(def));
    e.dataTransfer.effectAllowed = 'move';
  };
  return (
    <div draggable onDragStart={onDragStart} onClick={onClick}
      className="palette-item flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer active:opacity-80">
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

interface Props { onAddNode: (def: NodeDef) => void }

export default function NodePalette({ onAddNode }: Props) {
  const [open, setOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const toggle = () => setOpen(o => !o);
    window.addEventListener('toggle-palette', toggle);
    return () => window.removeEventListener('toggle-palette', toggle);
  }, []);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setTimeout(() => searchRef.current?.focus(), 50);
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, [open]);

  const q = search.toLowerCase().trim();
  const allFiltered = PALETTE_ORDER.flatMap(cat => NODE_DEFS.filter(n => n.category === cat && (!q || n.label.toLowerCase().includes(q) || n.description.toLowerCase().includes(q))));
  const hasResults = allFiltered.length > 0;

  return (
    <div ref={ref} className="absolute bottom-4 left-4 z-20">
      {/* Fluid iOS + button */}
      <motion.button
        onClick={() => setOpen(!open)}
        aria-label="Add node" aria-expanded={open}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28, mass: 0.5 }}
        className="relative w-12 h-12 rounded-full flex items-center justify-center overflow-hidden"
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-subtle)',
          boxShadow: 'var(--shadow-sm)',
          color: 'var(--color-text-primary)',
          transition: 'box-shadow 200ms, border-color 200ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = 'var(--color-border-strong)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--color-border-subtle)'; }}
      >
        <motion.svg
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        >
          <path d="M12 5v14"/><path d="M5 12h14"/>
        </motion.svg>
      </motion.button>

      {/* Popover */}
      {open && (
        <div className="palette-popover absolute bottom-14 left-0 w-[280px] max-h-[420px] flex flex-col"
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
          style={{ background: 'var(--color-bg-popover)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--color-border-subtle)' }}>
          {/* Search */}
          <div style={{ padding: 'var(--space-3) var(--space-3) var(--space-2)' }}>
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search nodes…"
              aria-label="Search nodes"
              className="form-input"
            />
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', padding: '0 var(--space-2) var(--space-3)' }}>
            {!hasResults && (
              <div style={{ padding: 'var(--space-6) var(--space-3)', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)' }}>
                No nodes found
              </div>
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
                    <div className="flex flex-col gap-0.5">{nodes.map(def => (
                      <PaletteItem key={def.subtype} def={def} onClick={() => { onAddNode(def); setOpen(false); }} />
                    ))}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
